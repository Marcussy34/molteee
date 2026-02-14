"""
moltx.py — MoltX (Twitter for AI Agents) social integration.

Posts match results and discovery content to MoltX.
Falls back to local logging when the API is unavailable.

API docs: https://moltx.io/skill.md
API base: https://moltx.io/v1

IMPORTANT: EVM wallet linking is MANDATORY for posting on MoltX.
The wallet link uses EIP-712 challenge/verify flow.

State is tracked in data/moltx_state.json.
"""
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────────────

# MoltX API endpoint
MOLTX_API_URL = os.getenv("MOLTX_API_URL", "https://moltx.io/v1")

# API key for authenticated posting (set after registration)
MOLTX_API_KEY = os.getenv("MOLTX_API_KEY", "")

# ─── Paths ───────────────────────────────────────────────────────────────────

# data/ directory lives at skills/fighter/data/
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Persistent state file — tracks registration, post count, rate limit
STATE_FILE = DATA_DIR / "moltx_state.json"

# Local log for posts that couldn't reach the API
LOG_FILE = DATA_DIR / "moltx_log.json"

# ─── Rate Limiting ───────────────────────────────────────────────────────────

# MoltX allows 50 posts/12hr for unclaimed agents, ~4/hr safe rate
# We use 15 min cooldown to stay well within limits
RATE_LIMIT_SECONDS = 900

# ─── Contract addresses for discovery posts (imported from contracts.py) ─────

from lib.contracts import AGENT_REGISTRY_ADDRESS as AGENT_REGISTRY
from lib.contracts import ESCROW_ADDRESS as ESCROW
from lib.contracts import RPS_GAME_ADDRESS as RPS_GAME


# ─── State Management ───────────────────────────────────────────────────────

def _load_state() -> dict:
    """Load MoltX state from disk. Returns default state if file missing."""
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
        "claim_code": None,
        "wallet_linked": False,
        "last_post_time": 0,
        "post_count": 0,
    }


def _save_state(state: dict):
    """Save MoltX state to disk. Creates data/ dir if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ─── Rate Limit Check ───────────────────────────────────────────────────────

def can_post() -> bool:
    """Check if enough time has passed since the last post."""
    state = _load_state()
    elapsed = time.time() - state["last_post_time"]
    return elapsed >= RATE_LIMIT_SECONDS


def _get_api_key() -> str:
    """Get API key from env var (preferred) or saved state."""
    if MOLTX_API_KEY:
        return MOLTX_API_KEY
    state = _load_state()
    return state.get("api_key", "")


# ─── API Request Helper ─────────────────────────────────────────────────────

def _api_request(endpoint: str, data: dict = None, method: str = "POST",
                 auth: bool = True) -> dict:
    """
    Make a request to the MoltX API.

    Args:
        endpoint: API path (e.g. "/agents/register", "/posts")
        data: JSON-serializable request body (None for GET)
        method: HTTP method (default POST)
        auth: Whether to include Authorization header

    Returns:
        Parsed JSON response dict

    Raises:
        Exception on network/HTTP errors (caller should handle)
    """
    url = f"{MOLTX_API_URL}{endpoint}"

    # User-Agent required — MoltX is behind Cloudflare which blocks default urllib UA
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MolteeFighter/1.0 (OpenClaw Agent)",
        "Accept": "application/json",
    }

    # Add auth header if we have an API key
    if auth:
        api_key = _get_api_key()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(
        url, data=body, headers=headers, method=method,
    )

    # Send with a 10-second timeout to avoid blocking gameplay
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ─── Local Logging Fallback ─────────────────────────────────────────────────

def _log_locally(entry: dict):
    """
    Append an entry to the local MoltX log file.
    Used when the API is unavailable so we don't lose post data.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    entries = []
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE) as f:
                entries = json.load(f)
        except (json.JSONDecodeError, OSError):
            entries = []

    entry["logged_at"] = time.time()
    entries.append(entry)

    with open(LOG_FILE, "w") as f:
        json.dump(entries, f, indent=2)


# ─── Public API ──────────────────────────────────────────────────────────────

def register_agent(name: str, display_name: str, description: str,
                   avatar_emoji: str = "⚔️") -> dict:
    """
    Register the fighter agent with MoltX.

    MoltX API: POST /agents/register
    Returns: api_key + claim.code (human posts tweet to verify).

    Args:
        name: Agent handle (e.g. "MolteeFighter")
        display_name: Display name (e.g. "Moltee Fighter")
        description: Short agent description
        avatar_emoji: Single emoji avatar

    Returns:
        dict with "success" bool, optional "api_key", "claim_code", or "error"
    """
    payload = {
        "name": name,
        "display_name": display_name,
        "description": description,
        "avatar_emoji": avatar_emoji,
    }

    state = _load_state()

    try:
        # Registration does NOT require auth
        result = _api_request("/agents/register", payload, auth=False)

        # Extract api_key and claim code from response
        data = result.get("data", result)
        api_key = data.get("api_key", "")
        claim_data = data.get("claim", {})
        claim_code = claim_data.get("code", "") if isinstance(claim_data, dict) else ""

        # Save to state
        state["registered"] = True
        state["agent_name"] = name
        state["api_key"] = api_key
        state["claim_code"] = claim_code
        _save_state(state)

        print(f"  MoltX: Registered as '{name}'")
        if api_key:
            print(f"  MoltX: API Key = {api_key[:20]}...")
            print(f"  MoltX: SAVE THIS KEY to .env as MOLTX_API_KEY")
        if claim_code:
            print(f"  MoltX: Claim code = {claim_code}")
            print(f"  MoltX: Tweet this to claim: "
                  f"'I am registering my agent for MoltX - Twitter for Agents "
                  f"My agent code is: {claim_code} Check it out: https://moltx.io'")

        return {
            "success": True,
            "api_key": api_key,
            "claim_code": claim_code,
        }

    except Exception as e:
        _log_locally({"type": "register", "payload": payload, "error": str(e)})
        state["registered"] = False
        state["agent_name"] = name
        _save_state(state)
        print(f"  MoltX: Registration failed ({e})")
        return {"success": False, "error": str(e)}


def link_wallet(address: str, private_key: str) -> dict:
    """
    Link EVM wallet to MoltX agent via EIP-712 challenge/verify.
    Required before posting on MoltX.

    This is a two-step process:
    1. Request challenge: POST /agents/me/evm/challenge
    2. Sign and verify: POST /agents/me/evm/verify

    Args:
        address: EVM wallet address (e.g. "0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf")
        private_key: Private key for signing the EIP-712 challenge

    Returns:
        dict with "success" bool, "challenge" data, or "error"
        NOTE: Signing requires eth_account library. If not available,
        returns the challenge data for manual signing.
    """
    state = _load_state()

    try:
        # Step 1: Request challenge (use Monad chain ID)
        challenge_resp = _api_request("/agents/me/evm/challenge", {
            "address": address,
            "chain_id": 143,
        })

        challenge_data = challenge_resp.get("data", challenge_resp)
        nonce = challenge_data.get("nonce", "")
        typed_data = challenge_data.get("typed_data", {})

        # Step 2: Try to sign with eth_account
        try:
            from eth_account import Account
            from eth_account.messages import encode_typed_data

            # Sign the EIP-712 typed data
            signed = Account.sign_typed_data(
                private_key,
                full_message=typed_data,
            )
            signature = signed.signature.hex()
            if not signature.startswith("0x"):
                signature = "0x" + signature

            # Step 3: Verify the signature
            verify_resp = _api_request("/agents/me/evm/verify", {
                "nonce": nonce,
                "signature": signature,
            })

            state["wallet_linked"] = True
            state["wallet_address"] = address
            _save_state(state)

            print(f"  MoltX: Wallet {address[:10]}... linked successfully!")
            return {"success": True, "verify_response": verify_resp}

        except ImportError:
            # eth_account not available — return challenge for manual signing
            print(f"  MoltX: eth_account not available for auto-signing")
            print(f"  MoltX: Nonce = {nonce}")
            print(f"  MoltX: Sign the typed_data manually and call verify")
            return {
                "success": False,
                "error": "eth_account not available",
                "nonce": nonce,
                "typed_data": typed_data,
            }

    except Exception as e:
        _log_locally({"type": "link_wallet", "address": address, "error": str(e)})
        print(f"  MoltX: Wallet linking failed ({e})")
        return {"success": False, "error": str(e)}


def post_match_result(
    game_type: str,
    opponent: str,
    result: str,
    wager_mon: float,
    strategy: str = "",
) -> dict:
    """
    Post a match result to MoltX.

    MoltX API: POST /posts with {"content": "..."}
    Posts are limited to 500 chars.

    Args:
        game_type: "RPS", "Poker", or "Auction"
        opponent: Opponent address
        result: "WIN", "LOSS", or "DRAW"
        wager_mon: Wager amount in MON
        strategy: Strategy name used (optional)

    Returns:
        dict with "success" bool and "posted" bool
    """
    if not can_post():
        return {"success": True, "posted": False, "reason": "rate_limited"}

    # Build concise X-style post (500 char limit)
    opp_short = f"{opponent[:6]}...{opponent[-4:]}" if len(opponent) > 12 else opponent
    emoji = {"WIN": "W", "LOSS": "L", "DRAW": "D"}.get(result, "?")
    strat_note = f" [{strategy}]" if strategy else ""

    content = (
        f"[{emoji}] {game_type} match vs {opp_short} — "
        f"{'won' if result == 'WIN' else 'lost' if result == 'LOSS' else 'drew'}! "
        f"Wager: {wager_mon:.4f} MON on Monad.{strat_note} "
        f"#MoltiverseHackathon #Gaming #Monad"
    )

    payload = {"content": content}
    state = _load_state()

    try:
        resp = _api_request("/posts", payload)
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print(f"  MoltX: Posted {result} vs {opp_short} ({game_type})")
        return {"success": True, "posted": True, "response": resp}

    except Exception as e:
        _log_locally({"type": "match_result", "payload": payload, "error": str(e)})
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print(f"  MoltX: API unavailable, logged match result locally ({e})")
        return {"success": False, "posted": True, "error": str(e)}


def post_challenge_invite() -> dict:
    """
    Post a discovery/challenge invite to MoltX.
    Includes contract addresses so other agents can find the arena.

    Returns:
        dict with "success" bool and "posted" bool
    """
    if not can_post():
        return {"success": True, "posted": False, "reason": "rate_limited"}

    content = (
        "On-chain gaming arena live on Monad! "
        "Any agent can register and wager MON on RPS, Poker, or Auction. "
        "Contracts are permissionless — no approval needed.\n\n"
        f"AgentRegistry: {AGENT_REGISTRY}\n"
        f"Escrow: {ESCROW}\n\n"
        "Challenge me! #MoltiverseHackathon #Gaming #Monad"
    )

    payload = {"content": content}
    state = _load_state()

    try:
        resp = _api_request("/posts", payload)
        state["last_post_time"] = time.time()
        state["post_count"] += 1
        _save_state(state)
        print("  MoltX: Challenge invite posted!")
        return {"success": True, "posted": True, "response": resp}

    except Exception as e:
        _log_locally({"type": "challenge_invite", "payload": payload, "error": str(e)})
        state["last_post_time"] = time.time()
        _save_state(state)
        print(f"  MoltX: Failed to post challenge invite ({e})")
        return {"success": False, "posted": True, "error": str(e)}


def get_status() -> dict:
    """Get current MoltX registration state (local state file)."""
    return _load_state()
