# Phase 9 — Social Discovery (Moltbook + MoltX) (COMPLETE)

> **Date:** February 10, 2026
> **Phase:** Social Integration (post Phase 7+8)
> **Status:** COMPLETE — Registered on both platforms, MoltX posting live, Moltbook pending claim

---

## Summary

Made the arena discoverable for agent-vs-agent play by integrating both social platforms in the Moltiverse ecosystem: Moltbook (Reddit for AI agents) and MoltX (Twitter for AI agents). Fixed the broken Moltbook API integration, built a new MoltX integration from scratch, wired both into all 3 game types, and registered the fighter agent on both platforms.

---

## What Was Completed

### 1. Fixed `moltbook.py` — Correct API + Endpoints

**File:** `skills/fighter/lib/moltbook.py` (full rewrite)

- Fixed API URL: `https://www.moltbook.com/api/v1` (was `https://moltbook.moltiverse.dev/api` — wrong)
- Fixed registration: `POST /agents/register` with `{name, description}` → returns `api_key` + `claim_url`
- Fixed posting: `POST /posts` with `{submolt, title, content}` format (was wrong `/posts/match`)
- Added `post_challenge_invite()` for arena discovery posts
- Added `get_status()` for status display
- Added `_get_api_key()` helper (reads from env or saved state)
- Added proper `User-Agent` header to avoid bot detection blocks
- State tracks: `registered`, `agent_name`, `api_key`, `claim_url`, `verification_code`

### 2. Created `moltx.py` — New MoltX Integration

**File:** `skills/fighter/lib/moltx.py` (new, ~300 lines)

Full MoltX integration following MoltX SKILL.md v0.23.1 API spec:
- `register_agent()` — `POST /agents/register` with name, display_name, description, avatar_emoji
- `link_wallet()` — EIP-712 challenge/verify flow using `eth_account` library
- `post_match_result()` — `POST /posts` with 500-char X-style format + hashtags
- `post_challenge_invite()` — Discovery post with contract addresses
- `can_post()` — 15-minute rate limit (within MoltX's 50/12hr unclaimed limit)
- `get_status()` — Returns local state
- **Cloudflare fix:** Custom `User-Agent` header required — MoltX returns 1010 error without it

### 3. Registered on Both Platforms

**Moltbook:**
- Agent name: `MolteeFighter`
- API key: saved to `.env` as `MOLTBOOK_API_KEY`
- Claim URL: `https://moltbook.com/claim/moltbook_claim_EZcL-kAw7GyLrfsLoCO0JIAscXO14Nj8`
- Status: Registered, pending human claim (rate-limited on claim page, retry in ~1hr)
- Owner account: `molteee` (email verified, dashboard accessible)

**MoltX:**
- Agent name: `MolteeFighter` (display: "Moltee Fighter")
- API key: saved to `.env` as `MOLTX_API_KEY`
- Claim code: `molt-OK`
- Wallet linked: `0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf` (EIP-712 verified)
- Status: Fully operational, posting works

### 4. Wired Social Posts into arena.py

**File:** `skills/fighter/scripts/arena.py`

- Added `_post_to_social()` helper — posts to both Moltbook and MoltX, never raises
- **RPS settlement** (line ~625): replaced Moltbook-only post with dual-platform `_post_to_social()`
- **Poker settlement** (line ~950): added social posting after opponent model update
- **Auction settlement** (line ~1215): added social posting after opponent model update
- All social posting is wrapped in try/except — never breaks gameplay

### 5. Added 5 New CLI Commands

| Command | Description |
|---------|-------------|
| `social-register` | Register on both Moltbook and MoltX in one call |
| `social-status` | Show registration status, API key status, post counts |
| `moltbook-post` | Post challenge invite to Moltbook (m/moltiversehackathon) |
| `moltx-post` | Post challenge invite to MoltX with #hashtags |
| `moltx-link-wallet` | Link EVM wallet to MoltX via EIP-712 |

### 6. Updated SKILL.md

Added Social Commands section with all 5 commands + Social Discovery section with profile URLs.

### 7. Posted Initial Discovery Content

- **MoltX:** Challenge invite posted live — includes contract addresses and #MoltiverseHackathon tag
- **Moltbook:** Pending human claim completion

### 8. Updated `cmd_status()`

Status command now shows social registration: `Social: Moltbook=yes, MoltX=yes`

---

## Files Created/Modified

| File | Action |
|------|--------|
| `skills/fighter/lib/moltbook.py` | REWRITE — correct API URL, endpoints, registration flow |
| `skills/fighter/lib/moltx.py` | CREATE — full MoltX integration with EIP-712 wallet linking |
| `skills/fighter/scripts/arena.py` | MODIFY — dual social posting, 5 new commands, status display |
| `skills/fighter/SKILL.md` | MODIFY — Social Commands + Discovery section |
| `skills/fighter/data/moltbook_state.json` | RESET — real registration data |
| `skills/fighter/data/moltx_state.json` | CREATE — MoltX registration data |
| `.env` | MODIFY — added MOLTBOOK_API_KEY, MOLTX_API_KEY |

---

## Verification Results

- [x] `arena.py social-status` — shows both platforms registered with API keys
- [x] `arena.py status` — shows `Social: Moltbook=yes, MoltX=yes`
- [x] `arena.py moltx-post` — challenge invite posted to MoltX successfully
- [x] `arena.py moltx-link-wallet` — EVM wallet linked via EIP-712
- [x] MoltX profile live at `https://moltx.io/MolteeFighter`
- [x] Syntax check passes for all 3 modified Python files
- [ ] `arena.py moltbook-post` — blocked pending human claim (rate limit on claim page)

---

## What This Enables (Agent-vs-Agent Discovery)

After Moltbook claim completes:
1. **Agent A** sees a Moltbook/MoltX post about the arena
2. **Agent A** reads the contract addresses from the post
3. **Agent A** calls `AgentRegistry.registerAgent()` directly (permissionless)
4. **Agent A** calls `Escrow.createMatch()` targeting our fighter's address
5. Our fighter agent (via OpenClaw) auto-detects the challenge and plays
6. Match result is posted to social feed — creating a flywheel

The contracts are already permissionless. The missing piece was **discoverability** — now solved.

---

## Remaining Human Actions

1. **Claim Moltbook:** Wait for rate limit to expire (~55 min), then visit claim URL and complete tweet verification
2. **Claim MoltX (optional):** Tweet claim code `molt-OK`, then call `/v1/agents/claim` API — unlocks higher rate limits and verified badge
3. **Post to Moltbook:** After claiming, run `arena.py moltbook-post`
