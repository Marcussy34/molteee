"""
moltbook.py — Moltbook social integration for the Gaming Arena Fighter Agent.

Posts match results and agent activity to the Moltbook social feed.
Falls back to local logging when the API is unavailable.

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

# Moltbook API endpoint (configurable via env)
MOLTBOOK_API_URL = os.getenv("MOLTBOOK_API_URL", "https://moltbook.moltiverse.dev/api")

# API key for authenticated posting
MOLTBOOK_API_KEY = os.getenv("MOLTBOOK_API_KEY", "")

# ─── Paths ───────────────────────────────────────────────────────────────────

# data/ directory lives at skills/fighter/data/
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Persistent state file — tracks registration, post count, rate limit
STATE_FILE = DATA_DIR / "moltbook_state.json"

# Local log for posts that couldn't reach the API
LOG_FILE = DATA_DIR / "moltbook_log.json"

# ─── Rate Limiting ───────────────────────────────────────────────────────────

# Minimum seconds between posts (30 minutes)
RATE_LIMIT_SECONDS = 1800


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
        "agent_id": None,
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


# ─── API Request Helper ─────────────────────────────────────────────────────

def _api_request(endpoint: str, data: dict) -> dict:
    """
    Make an authenticated POST request to the Moltbook API.

    Args:
        endpoint: API path (e.g. "/agents/register", "/posts/match")
        data: JSON-serializable request body

    Returns:
        Parsed JSON response dict

    Raises:
        Exception on network/HTTP errors (caller should handle)
    """
    url = f"{MOLTBOOK_API_URL}{endpoint}"

    # Build request with JSON body and auth header
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MOLTBOOK_API_KEY}",
        },
        method="POST",
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

    Tries the API first. If it fails, logs the registration locally.
    Always updates local state regardless of API success.

    Args:
        name: Agent display name (e.g. "MolteeFighter")
        description: Short agent description

    Returns:
        dict with "success" bool and optional "agent_id" or "error"
    """
    payload = {
        "name": name,
        "description": description,
        "platform": "monad-testnet",
    }

    state = _load_state()

    try:
        result = _api_request("/agents/register", payload)
        # Mark as registered with the returned agent ID
        state["registered"] = True
        state["agent_id"] = result.get("agent_id", result.get("id"))
        _save_state(state)
        print(f"  Moltbook: Registered as {state['agent_id']}")
        return {"success": True, "agent_id": state["agent_id"]}

    except Exception as e:
        # API unavailable — log locally and mark as locally registered
        _log_locally({"type": "register", "payload": payload, "error": str(e)})
        state["registered"] = True
        state["agent_id"] = "local-pending"
        _save_state(state)
        print(f"  Moltbook: API unavailable, logged registration locally ({e})")
        return {"success": False, "error": str(e)}


def post_match_result(
    game_type: str,
    opponent: str,
    result: str,
    wager_mon: float,
    strategy: str = "",
) -> dict:
    """
    Post a match result to Moltbook.

    Rate-limited to one post per 30 minutes. Tries API first, falls back
    to local log. Never raises — safe to call from game loops.

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

    # Build the post payload
    payload = {
        "game_type": game_type,
        "opponent": opponent,
        "result": result,
        "wager_mon": wager_mon,
        "strategy": strategy,
        "timestamp": int(time.time()),
    }

    state = _load_state()

    try:
        resp = _api_request("/posts/match", payload)
        # Update state on successful post
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print(f"  Moltbook: Posted {result} vs {opponent[:10]}... ({game_type})")
        return {"success": True, "posted": True, "response": resp}

    except Exception as e:
        # API unavailable — log locally, still update rate limit to avoid retry spam
        _log_locally({"type": "match_result", "payload": payload, "error": str(e)})
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print(f"  Moltbook: API unavailable, logged match result locally ({e})")
        return {"success": False, "posted": True, "error": str(e)}
