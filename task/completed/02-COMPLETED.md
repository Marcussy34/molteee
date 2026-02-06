# Phase 2 — First Working Fighter Skill (COMPLETED)

> **Completed:** February 6, 2026
> **Phase:** 2 of 8
> **Status:** Done

---

## Summary

Phase 2 implemented the full Python script layer for the fighter skill, enabling autonomous on-chain RPS gameplay on Monad testnet. The OpenClaw agent can now discover opponents, create escrow matches, play commit-reveal rounds, and track results. Three matches played end-to-end (2W/1L, ELO 1015). OpenClaw integration verified — the LLM agent autonomously ran status, find-opponents, challenge, and history commands.

---

## What Was Done

### 1. `skills/fighter/lib/contracts.py` — Web3 Wrapper Layer

**File:** `skills/fighter/lib/contracts.py` (full rewrite)

Features implemented:
- **`load_dotenv()` at module load** — fixes bug where env vars were empty at runtime
- **Enums**: `MatchStatus` (CREATED/ACTIVE/SETTLED/CANCELLED), `GamePhase` (COMMIT/REVEAL/COMPLETE)
- **Lazy Web3 init**: `get_w3()` → connects to Monad RPC, `get_account()` → from DEPLOYER_PRIVATE_KEY
- **Contract getters**: `get_registry()`, `get_escrow()`, `get_rps_game()` — lazy, load ABIs on first call
- **`send_tx(func, value=0)`** — build, estimate gas (×1.2 buffer, fallback 500k), sign, send, wait for receipt, raise on revert
- **`load_abis()` made idempotent** — guard with `_abis_loaded` flag

**Typed wrapper functions (16 total):**

| Function | Contract | Type |
|---|---|---|
| `register_agent(game_types, min_wager, max_wager)` | AgentRegistry | Write |
| `get_agent_info(address)` | AgentRegistry | Read → dict |
| `get_open_agents(game_type)` | AgentRegistry | Read → address[] |
| `get_elo(address, game_type)` | AgentRegistry | Read → uint256 |
| `get_match_history(address)` | AgentRegistry | Read → list |
| `get_match_count(address)` | AgentRegistry | Read → uint256 |
| `create_escrow_match(opponent, game_contract, wager_wei)` | Escrow | Write, payable |
| `accept_escrow_match(match_id, wager_wei)` | Escrow | Write, payable |
| `get_escrow_match(match_id)` | Escrow | Read → dict |
| `get_next_match_id()` | Escrow | Read |
| `create_rps_game(escrow_match_id, total_rounds)` | RPSGame | Write |
| `commit_move(game_id, move_hash)` | RPSGame | Write |
| `reveal_move(game_id, move, salt)` | RPSGame | Write |
| `get_game(game_id)` | RPSGame | Read → dict |
| `get_round(game_id, round_index)` | RPSGame | Read → dict |
| `claim_timeout(game_id)` | RPSGame | Write |

**Utility functions:**
- `make_commit_hash(move_int, salt_bytes32)` — matches Solidity's `keccak256(abi.encodePacked(uint8, bytes32))`
- `generate_salt()` — 32 random bytes via `secrets.token_bytes(32)`
- `get_balance(address)`, `wei_to_mon(wei)`, `mon_to_wei(mon)`
- `parse_match_id_from_receipt(receipt)`, `parse_game_id_from_receipt(receipt)` — extract from events

### 2. `skills/fighter/scripts/arena.py` — CLI Dispatcher

**File:** `skills/fighter/scripts/arena.py` (full rewrite, replaced all stubs)

6 commands implemented:

| Command | Description |
|---------|-------------|
| `status` | Shows wallet address, MON balance, registration status, ELO, match count. Handles "not registered" gracefully. |
| `register` | Registers for RPS with wager range 0.001–1.0 MON. Skips if already registered. |
| `find-opponents` | Lists open agents for RPS, excluding self. Shows address, ELO, wager range per opponent. |
| `challenge <opponent> <wager> [rounds]` | **Blocking, full lifecycle**: create escrow → poll for accept → create game → play all rounds. |
| `accept <match_id> [rounds]` | Accept escrow match → wait for/create game → play all rounds. |
| `history` | Shows match history, W/L count, win rate, ELO, recent 10 matches. |

**Shared `_play_game(game_id)` function:**
- Polls game state every 3 seconds
- Commit phase: picks random move, generates salt, computes hash, commits, saves move/salt
- Reveal phase: reveals saved move + salt
- Timeout: claims if opponent hasn't acted past deadline
- Settled: prints score and WIN/LOSS/DRAW result

**Removed:** `play-rps` command (replaced by game loop inside challenge/accept)

### 3. `opponents/simple_bot.py` — Standalone Testing Bot

**File:** `opponents/simple_bot.py` (NEW)

Standalone Python script, no OpenClaw needed. Own web3 setup + wallet.

Usage: `python3.13 opponents/simple_bot.py [--wallet N]` (N=1-5, default 1)

Features:
- Loads opponent wallet from `OPPONENT_N_PRIVATE_KEY` in `.env`
- Auto-registers if not registered (RPS, 0.001–1.0 MON)
- **Poll loop**: scans new escrow matches where `player2 == bot_address && status == CREATED`
- Auto-accepts challenges, waits for/creates game, plays all rounds with random moves
- **Action dedup**: tracks `acted` set per game to prevent repeated transaction attempts on error
- Skips existing matches on startup (only watches for new ones)
- Game creation fallback: waits 10s for challenger, then creates game itself

### 4. `skills/fighter/SKILL.md` — LLM Instructions

**File:** `skills/fighter/SKILL.md` (full rewrite)

Contents:
- YAML frontmatter: name, description, requires (`python3.13`, env vars)
- **Quick Start** — 5-step numbered sequence
- **Command Reference** — syntax, description, bash examples for each command
- **Step-by-Step: Playing a Match** — exact on-chain operation sequence
- **Important Rules** — `python3.13` requirement, small wagers first, timeout handling, blocking commands
- **Contract Addresses** — all 3 deployed contracts + ERC-8004 registries
- Removed references to `play-rps`, non-existent `references/` docs, venv instructions

### 5. OpenClaw Integration

- **Skill symlinked** into `~/.openclaw/workspace/skills/fighter` → discovered as workspace skill
- **`~/.openclaw/workspace/TOOLS.md` updated** — added Python 3.13 note + fighter skill working directory
- **`~/.openclaw/.env` updated** — new OpenAI API key for gpt-5-mini
- **Model set** to `openai/gpt-5-mini` via `openclaw models set`
- **Gateway tested** — `openclaw gateway --port 18789` runs successfully

### 6. Python Path Fix

- System `python3` (`/usr/bin/python3`) lacks web3 — causes `ModuleNotFoundError`
- Homebrew `python3.13` (`/opt/homebrew/bin/python3.13`) has web3.py installed
- Updated shebangs in `arena.py` and `simple_bot.py` to `#!/usr/bin/env python3.13`
- Updated all SKILL.md command examples to use `python3.13`
- Updated SKILL.md `requires.bins` from `python3` to `python3.13`

### 7. Opponent Wallet Funded

- Transferred 0.6 MON total from deployer to Opponent 1 (`0xCD40Da...`)
- Required for gas + wager deposits during testing

---

## Matches Played on Monad Testnet

| Match ID | Game ID | Challenger | Opponent | Wager | Result | How Run |
|----------|---------|-----------|----------|-------|--------|---------|
| 0 | 0 | Fighter (manual) | Bot #1 | 0.001 MON | DRAW (timeout) | CLI standalone |
| 1 | 1 | Fighter (manual) | Bot #1 | 0.001 MON | WIN (1-0) | CLI standalone |
| 2 | 2 | Fighter (OpenClaw exec) | Bot #1 | 0.001 MON | LOSS (0-1) | OpenClaw agent (exec timeout) |
| 3 | 3 | Fighter (OpenClaw process) | Bot #1 | 0.001 MON | LOSS (0-1) | OpenClaw agent (process tool) |

**Final state:** 3 recorded matches (2W/1L), ELO 1015, Balance ~1.5 MON

### OpenClaw Agent Verification

| Test | Result |
|------|--------|
| Skill discovery (`openclaw skills list`) | `✓ ready`, source: `openclaw-workspace`, 308 chars injected |
| `status` via agent | Agent read SKILL.md, ran command, returned wallet/ELO correctly |
| `find-opponents` via agent | Agent found bot at `0xCD40Da...` (ELO, wager range) |
| `challenge` via agent (exec tool) | Created escrow match #2, but exec timed out during blocking wait |
| `challenge` via agent (process tool) | Created escrow match #3, ran in background, bot accepted + played |
| `history` via agent | Reported 3 matches (2W/1L, 66.7% win rate, ELO 1015) |

---

## Files Created/Modified

```
/Users/marcus/Projects/molteee/
├── skills/fighter/
│   ├── SKILL.md                              # MODIFIED (full rewrite with python3.13)
│   ├── scripts/
│   │   └── arena.py                          # MODIFIED (6 working commands, shebang python3.13)
│   └── lib/
│       └── contracts.py                      # MODIFIED (full web3 wrappers, 16 functions)
├── opponents/
│   └── simple_bot.py                         # NEW (standalone bot, auto-accept + random play)
└── ~/.openclaw/workspace/
    ├── skills/fighter → (symlink)            # NEW (skill discovery)
    └── TOOLS.md                              # MODIFIED (added python3.13 + fighter notes)
```

---

## Gate Checklist

- [x] `contracts.py` has typed wrappers for all 3 contracts (16 functions)
- [x] `arena.py` has 6 working commands (status, register, find-opponents, challenge, accept, history)
- [x] `simple_bot.py` auto-registers, auto-accepts, plays random moves
- [x] SKILL.md has accurate command reference for LLM agent
- [x] `python3.13` used everywhere (shebangs, SKILL.md, TOOLS.md)
- [x] Fighter agent registered on-chain (ELO 1015, 3 matches)
- [x] Opponent wallet funded (0.6 MON transferred)
- [x] At least 1 complete match played end-to-end on Monad testnet
- [x] OpenClaw skill discovery verified (fighter shows as `✓ ready`)
- [x] OpenClaw agent ran status, find-opponents, challenge, history autonomously

---

## Known Issues / Notes for Phase 3

1. **Blocking commands vs OpenClaw exec**: The `challenge` and `accept` commands block for minutes. OpenClaw's exec tool can timeout. Workaround: use `process` tool for background execution. Consider making commands non-blocking in Phase 3.
2. **Random moves only**: All moves are `random.choice([ROCK, PAPER, SCISSORS])`. Strategy/pattern recognition comes in Phase 3.
3. **Bot gas exhaustion**: Bot #1 ran out of gas after ~2 matches (0.1 MON wasn't enough). Funded with additional 0.5 MON. Ensure bots have sufficient MON before extended testing.
4. **Match 0 timeout**: First match ended in DRAW because bot ran out of gas mid-reveal. The `claim_timeout` path works correctly.
5. **No error recovery in challenge flow**: If the challenger's process dies mid-match, the game continues on-chain but there's no way to resume from arena.py. Could add a `resume <game_id>` command.
6. **`references/` directory still empty** — strategy docs for Phase 3+.
