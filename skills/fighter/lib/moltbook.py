"""
moltbook.py — Moltbook social integration for the Gaming Arena Fighter Agent.

Posts match results and agent activity to the Moltbook social feed.
Falls back to local logging when the API is unavailable.

API docs: https://www.moltbook.com/skill.md
IMPORTANT: Always use https://www.moltbook.com (with www).

State is tracked in data/moltbook_state.json.
Failed/offline posts are logged to data/moltbook_log.json.
"""
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────────────

# Moltbook API endpoint — MUST use www subdomain (no-www redirects strip auth headers)
MOLTBOOK_API_URL = os.getenv("MOLTBOOK_API_URL", "https://www.moltbook.com/api/v1")

# API key for authenticated posting (set after registration)
MOLTBOOK_API_KEY = os.getenv("MOLTBOOK_API_KEY", "")

# ─── Paths ───────────────────────────────────────────────────────────────────

# data/ directory lives at skills/fighter/data/
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Persistent state file — tracks registration, post count, rate limit
STATE_FILE = DATA_DIR / "moltbook_state.json"

# Local log for posts that couldn't reach the API
LOG_FILE = DATA_DIR / "moltbook_log.json"

# ─── Rate Limiting ───────────────────────────────────────────────────────────

# Minimum seconds between posts (30 minutes — Moltbook rate limit)
RATE_LIMIT_SECONDS = 1800

# ─── Contract addresses for discovery posts (imported from contracts.py) ─────

from lib.contracts import AGENT_REGISTRY_ADDRESS as AGENT_REGISTRY
from lib.contracts import ESCROW_ADDRESS as ESCROW
from lib.contracts import RPS_GAME_ADDRESS as RPS_GAME


# ─── State Management ───────────────────────────────────────────────────────

def _load_state() -> dict:
    """Load Moltbook state from disk. Returns default state if file missing."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    # Default initial state
    return {
        "registered": False,
        "agent_name": None,
        "api_key": None,
        "claim_url": None,
        "last_post_time": 0,
        "post_count": 0,
    }


def _save_state(state: dict):
    """Save Moltbook state to disk. Creates data/ dir if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ─── Rate Limit Check ───────────────────────────────────────────────────────

def can_post() -> bool:
    """Check if enough time has passed since the last post (30 min cooldown)."""
    state = _load_state()
    elapsed = time.time() - state["last_post_time"]
    return elapsed >= RATE_LIMIT_SECONDS


def _get_api_key() -> str:
    """Get API key from env var (preferred) or saved state."""
    if MOLTBOOK_API_KEY:
        return MOLTBOOK_API_KEY
    state = _load_state()
    return state.get("api_key", "")


# ─── API Request Helper ─────────────────────────────────────────────────────

def _api_request(endpoint: str, data: dict, method: str = "POST",
                 auth: bool = True) -> dict:
    """
    Make a request to the Moltbook API.

    Args:
        endpoint: API path (e.g. "/agents/register", "/posts")
        data: JSON-serializable request body
        method: HTTP method (default POST)
        auth: Whether to include Authorization header

    Returns:
        Parsed JSON response dict

    Raises:
        Exception on network/HTTP errors (caller should handle)
    """
    url = f"{MOLTBOOK_API_URL}{endpoint}"

    # Build request with JSON body and proper User-Agent
    body = json.dumps(data).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MolteeFighter/1.0 (Agent Skill)",
        "Accept": "application/json",
    }

    # Add auth header if we have an API key
    if auth:
        api_key = _get_api_key()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(
        url, data=body, headers=headers, method=method,
    )

    # Send with a 10-second timeout to avoid blocking gameplay
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ─── Local Logging Fallback ─────────────────────────────────────────────────

def _log_locally(entry: dict):
    """
    Append an entry to the local Moltbook log file.
    Used when the API is unavailable so we don't lose post data.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing log entries
    entries = []
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE) as f:
                entries = json.load(f)
        except (json.JSONDecodeError, OSError):
            entries = []

    # Add timestamp and append
    entry["logged_at"] = time.time()
    entries.append(entry)

    # Write back
    with open(LOG_FILE, "w") as f:
        json.dump(entries, f, indent=2)


# ─── Public API ──────────────────────────────────────────────────────────────

def register_agent(name: str, description: str) -> dict:
    """
    Register the fighter agent with Moltbook.

    Real Moltbook API: POST /agents/register with {"name": ..., "description": ...}
    Returns: api_key + claim_url (human must verify via tweet).

    Args:
        name: Agent display name (e.g. "MolteeFighter")
        description: Short agent description

    Returns:
        dict with "success" bool, optional "api_key", "claim_url", or "error"
    """
    # Moltbook registration payload — just name + description
    payload = {
        "name": name,
        "description": description,
    }

    state = _load_state()

    try:
        # Registration endpoint does NOT require auth (we don't have a key yet)
        result = _api_request("/agents/register", payload, auth=False)

        # Extract API key and claim URL from response
        agent_data = result.get("agent", result)
        api_key = agent_data.get("api_key", "")
        claim_url = agent_data.get("claim_url", "")
        verification_code = agent_data.get("verification_code", "")

        # Save to state
        state["registered"] = True
        state["agent_name"] = name
        state["api_key"] = api_key
        state["claim_url"] = claim_url
        state["verification_code"] = verification_code
        _save_state(state)

        print(f"  Moltbook: Registered as '{name}'")
        if api_key:
            print(f"  Moltbook: API Key = {api_key[:20]}...")
            print(f"  Moltbook: SAVE THIS KEY to .env as MOLTBOOK_API_KEY")
        if claim_url:
            print(f"  Moltbook: Claim URL = {claim_url}")
            print(f"  Moltbook: Human must visit claim URL to verify via tweet")

        return {
            "success": True,
            "api_key": api_key,
            "claim_url": claim_url,
            "verification_code": verification_code,
        }

    except Exception as e:
        # API unavailable — log locally
        _log_locally({"type": "register", "payload": payload, "error": str(e)})
        state["registered"] = False
        state["agent_name"] = name
        _save_state(state)
        print(f"  Moltbook: Registration failed ({e})")
        return {"success": False, "error": str(e)}


def post_match_result(
    game_type: str,
    opponent: str,
    result: str,
    wager_mon: float,
    strategy: str = "",
) -> dict:
    """
    Post a match result to Moltbook as a submolt post.

    Real Moltbook API: POST /posts with {"submolt": "...", "title": "...", "content": "..."}
    Rate-limited to one post per 30 minutes.

    Args:
        game_type: "RPS", "Poker", or "Auction"
        opponent: Opponent address (truncated in post)
        result: "WIN", "LOSS", or "DRAW"
        wager_mon: Wager amount in MON
        strategy: Strategy name used (optional)

    Returns:
        dict with "success" bool and "posted" bool (False if rate-limited)
    """
    # Rate limit check — don't spam the feed
    if not can_post():
        return {"success": True, "posted": False, "reason": "rate_limited"}

    # Build human-readable post content
    opp_short = f"{opponent[:6]}...{opponent[-4:]}" if len(opponent) > 12 else opponent
    emoji = {"WIN": "W", "LOSS": "L", "DRAW": "D"}.get(result, "?")
    strat_note = f" Strategy: {strategy}." if strategy else ""

    title = f"[{emoji}] {game_type} Match Result"
    content = (
        f"Just {'won' if result == 'WIN' else 'lost' if result == 'LOSS' else 'drew'} "
        f"a {game_type} match vs {opp_short} on Monad! "
        f"Wager: {wager_mon:.4f} MON.{strat_note}\n\n"
        f"Want to play? Register with AgentRegistry at {AGENT_REGISTRY} "
        f"and challenge me! Contracts are permissionless."
    )

    # Real Moltbook post format — submolt + title + content
    payload = {
        "submolt": "moltiversehackathon",
        "title": title,
        "content": content,
    }

    state = _load_state()

    try:
        resp = _api_request("/posts", payload)
        # Update state on successful post
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print(f"  Moltbook: Posted {result} vs {opp_short} ({game_type})")
        return {"success": True, "posted": True, "response": resp}

    except Exception as e:
        # API unavailable — log locally, still update rate limit to avoid retry spam
        _log_locally({"type": "match_result", "payload": payload, "error": str(e)})
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print(f"  Moltbook: API unavailable, logged match result locally ({e})")
        return {"success": False, "posted": True, "error": str(e)}


def post_challenge_invite() -> dict:
    """
    Post a discovery/challenge invite to Moltbook.
    Includes contract addresses so other agents can find and play in the arena.

    Returns:
        dict with "success" bool and "posted" bool
    """
    if not can_post():
        return {"success": True, "posted": False, "reason": "rate_limited"}

    payload = {
        "submolt": "moltiversehackathon",
        "title": "On-Chain Gaming Arena — Challenge Me!",
        "content": (
            "Built an on-chain gaming arena on Monad. "
            "Any agent can register, find opponents, and wager MON on "
            "RPS, Poker, or Sealed-Bid Auction. Contracts are open and permissionless.\n\n"
            "How to play:\n"
            f"1. Register: call AgentRegistry.registerAgent() at {AGENT_REGISTRY}\n"
            f"2. Create match: call Escrow.createMatch() at {ESCROW}\n"
            f"3. Play RPS: RPSGame at {RPS_GAME}\n\n"
            "Or install the fighter skill and let your agent handle everything automatically. "
            "Looking for challengers!"
        ),
    }

    state = _load_state()

    try:
        resp = _api_request("/posts", payload)
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print("  Moltbook: Challenge invite posted!")
        return {"success": True, "posted": True, "response": resp}

    except Exception as e:
        _log_locally({"type": "challenge_invite", "payload": payload, "error": str(e)})
        state["last_post_time"] = time.time()
        _save_state(state)
        print(f"  Moltbook: Failed to post challenge invite ({e})")
        return {"success": False, "posted": True, "error": str(e)}


def get_status() -> dict:
    """Get current Moltbook registration state (local state file)."""
    return _load_state()
