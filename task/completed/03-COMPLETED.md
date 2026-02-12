# Phase 3 — Opponents + RPS Strategy Engine (COMPLETED)

> **Completed:** February 6, 2026
> **Phase:** 3 of 8
> **Status:** Done

---

## Summary

Phase 3 built 5 distinct opponent bots with different exploitable strategies, implemented a multi-signal RPS strategy engine (frequency analysis, Markov chain, sequence detection, anti-exploitation), added Kelly criterion bankroll management, and integrated everything into the arena.py CLI with two new commands (`select-match`, `recommend`). All 6 unit tests pass. The fighter agent now makes strategic move selections instead of random, and persists opponent models to disk for cross-game learning.

---

## What Was Done

### 1. `skills/fighter/lib/strategy.py` — Multi-Signal Strategy Engine

**File:** `skills/fighter/lib/strategy.py` (NEW, ~200 lines)

Four strategy modules + combined selector:

| Strategy | How It Works | Best Against |
|----------|-------------|--------------|
| **Frequency Analysis** | Counts opponent move distribution; if one move >40%, counter it | Rock Bot (70% rock bias) |
| **Markov Chain (1st order)** | Builds transition matrix P(next\|last); predicts most likely next move | Mirror Bot (deterministic transitions) |
| **Sequence Detection** | Detects repeating cycles (R→P→S) and win-stay/lose-shift patterns | Bots with fixed rotation |
| **Anti-Exploitation** | If recent win rate <35% over last 5 rounds, switches to random | Counter Bot (prevents being counter-exploited) |

**Combined selector logic:**
1. Anti-exploitation check first (emergency override to random)
2. Run all three predictive strategies on full history (current game + persisted model)
3. Pick highest-confidence prediction (minimum threshold 0.4)
4. Fall back to random if no strong signal
5. Returns `(move, strategy_name, confidence)` tuple for logging

### 2. `skills/fighter/lib/opponent_model.py` — Opponent Profiling + Persistence

**File:** `skills/fighter/lib/opponent_model.py` (NEW, ~150 lines)

**`OpponentModel` class per opponent address:**
- `move_counts` — total move frequencies (Counter)
- `transitions` — Markov transition matrix (nested Counters)
- `match_results` — list of `{won, my_score, opp_score, timestamp}` dicts
- `round_history` — cumulative `(my_move, opp_move)` list across all games
- `update(game_round_history, won, scores)` — updates all statistical models
- `save(path)` / `load(path)` — JSON serialization to `skills/fighter/data/{address}.json`
- `get_win_rate()`, `get_total_games()`, `get_all_round_history()`

**`OpponentModelStore` class:**
- Manages loading/saving all models with in-memory cache
- `get(addr)` — loads from disk or returns empty model
- `save(addr)` / `save_all()` — persists to disk

### 3. `skills/fighter/lib/bankroll.py` — Kelly Criterion Wager Sizing

**File:** `skills/fighter/lib/bankroll.py` (NEW, ~100 lines)

**`recommend_wager(balance, win_prob, min_wager, max_wager)`:**
- Kelly fraction for even-money bets: `f* = 2p - 1`
- Half-Kelly safety margin (f*/2)
- Capped at 5% of bankroll
- Floor: minimum wager if balance < 10x min wager
- Returns 0 edge → minimum wager

**`estimate_win_prob(opponent_addr, model_store)`:**
- Uses historical match data with Bayesian regression toward 0.5
- Weight formula: `games / (games + 5)` — more games = more trust in observed rate
- Unknown opponents → 0.5 (no edge assumed)

**`format_recommendation(balance, win_prob, wager)`:**
- Human-readable output: balance, win prob, edge, wager (% of bankroll), EV per match

### 4. `opponents/base_bot.py` — Reusable Bot Base Class

**File:** `opponents/base_bot.py` (NEW, ~300 lines)

Extracted from `simple_bot.py` into a reusable base class:

- `BaseBot(wallet_num, name)` — same web3 setup, registration, match scanning, game lifecycle
- **Abstract method:** `choose_move(game_id, current_round, history) -> int`
  - `history` = list of `(my_move, opponent_move)` tuples for prior rounds
  - Built by `_build_round_history()` querying on-chain `getRound()` data
- `play_game_tick()` calls `choose_move()` instead of `random.choice()`
- Configurable `MIN_WAGER_MON`, `MAX_WAGER_MON`, `BOT_NAME` class attributes
- Prints bot name with each move for identification in logs

### 5. Five Opponent Bots

All bots extend `BaseBot` and override `choose_move()`:

| Bot | File | Wallet | Strategy | Wager Range |
|-----|------|--------|----------|-------------|
| **Rock Bot** | `opponents/rock_bot.py` | 1 (`0xCD40Da...`) | 70% rock, 20% paper, 10% scissors | 0.001–0.1 MON |
| **Gambler Bot** | `opponents/gambler_bot.py` | 2 (`0x37D06C...`) | Uniform random, accepts big bets | 0.001–1.0 MON |
| **Mirror Bot** | `opponents/mirror_bot.py` | 3 (`0x8290c3...`) | Copies opponent's last move (tit-for-tat) | 0.001–0.1 MON |
| **Random Bot** | `opponents/random_bot.py` | 4 (`0x3828B0...`) | Pure 33/33/33 random baseline | 0.001–0.1 MON |
| **Counter Bot** | `opponents/counter_bot.py` | 5 (`0xA56766...`) | Counters opponent's most frequent move | 0.001–0.1 MON |

Each bot is a standalone script: `python3.13 opponents/<bot>.py`

### 6. `opponents/run_all.py` — Multi-Bot Launcher

**File:** `opponents/run_all.py` (NEW, ~100 lines)

- Spawns all 5 bots as daemon threads in a single process
- Uses `threading.Event` for clean shutdown on Ctrl+C
- Each bot has patched `run()` that checks `_shutdown` flag each iteration
- Skips bots with insufficient balance (< 0.001 MON)
- Usage: `python3.13 opponents/run_all.py`

### 7. `skills/fighter/scripts/arena.py` — Strategy Integration + New Commands

**File:** `skills/fighter/scripts/arena.py` (MODIFIED)

**Changes to existing commands:**

- **`challenge`**: Now accepts optional wager (auto-sizes via Kelly criterion if omitted). Uses strategy engine for all moves. Updates opponent model after game settles.
- **`accept`**: Uses strategy engine. Updates opponent model after game.

**`_play_game()` rewritten:**
- Loads opponent model from `OpponentModelStore`
- Before each commit: builds round history from on-chain `getRound()` data
- Calls `strategy.choose_move()` instead of `random.choice()`
- Prints strategy name + confidence with each move (e.g., `[frequency 70%] Committing Paper...`)
- After game settles: updates opponent model with full round history, saves to disk
- Added `_build_round_history_from_chain()` helper

**New commands:**

| Command | Description |
|---------|-------------|
| `select-match` | Gets all open opponents, estimates win probability from model, calculates Kelly wager + EV, ranks by EV descending. Recommends best matchup. |
| `recommend <opponent>` | Shows detailed Kelly criterion recommendation: opponent ELO, games played, historical win rate, balance, win prob, edge, wager, EV. |

### 8. `skills/fighter/SKILL.md` — Updated Documentation

**File:** `skills/fighter/SKILL.md` (MODIFIED)

- Updated description to mention strategy engine
- Added **Strategy Workflow** section (scout → recommend → challenge → review)
- Added `select-match` and `recommend` command documentation
- Added note about `references/rps-strategy.md` for detailed strategy docs
- Updated `challenge` syntax to show optional wager
- Updated "Important Rules" with strategy-related notes

### 9. `skills/fighter/references/rps-strategy.md` — Strategy Reference

**File:** `skills/fighter/references/rps-strategy.md` (NEW)

Detailed strategy documentation for LLM context:
- Overview of all 4 strategy modules
- How each strategy works + what opponents it targets
- Combined selector logic
- Opponent model persistence explanation
- Kelly criterion bankroll management
- Expected win rates per opponent type
- Available commands

---

## Unit Tests

All 6 tests pass:

| Test | Validates | Result |
|------|-----------|--------|
| Frequency Analysis (Rock-Heavy) | Detects 70% rock → plays Paper at 70% confidence | PASS |
| Markov Chain (Tit-for-Tat) | Detects mirror pattern → predicts next transition at 100% confidence | PASS |
| Sequence Detection (Cycle) | Detects R→P→S cycle → counters next in cycle at 60% confidence | PASS |
| Anti-Exploitation (Low Win Rate) | Triggers at <35% recent win rate → switches to anti-exploit strategy | PASS |
| Opponent Model Save/Load | Roundtrip persistence: update → save → load → verify state | PASS |
| Kelly Criterion Bankroll | Min wager at 50% WP, scales at 70%, caps at 90% WP | PASS |

---

## Files Created/Modified

```
/Users/marcus/Projects/molteee/
├── skills/fighter/
│   ├── SKILL.md                              # MODIFIED (strategy workflow + new commands)
│   ├── scripts/
│   │   └── arena.py                          # MODIFIED (strategy engine + select-match + recommend)
│   ├── lib/
│   │   ├── strategy.py                       # NEW (multi-signal strategy engine)
│   │   ├── opponent_model.py                 # NEW (opponent profiling + JSON persistence)
│   │   └── bankroll.py                       # NEW (Kelly criterion wager sizing)
│   ├── references/
│   │   └── rps-strategy.md                   # NEW (strategy docs for LLM context)
│   └── data/                                 # NEW (directory for opponent model JSON files)
├── opponents/
│   ├── base_bot.py                           # NEW (reusable bot base class)
│   ├── rock_bot.py                           # NEW (70% rock, wallet 1)
│   ├── gambler_bot.py                        # NEW (uniform random, high wagers, wallet 2)
│   ├── mirror_bot.py                         # NEW (tit-for-tat, wallet 3)
│   ├── random_bot.py                         # NEW (pure random baseline, wallet 4)
│   ├── counter_bot.py                        # NEW (counters most frequent, wallet 5)
│   ├── run_all.py                            # NEW (multi-bot launcher, all 5 in parallel)
│   └── simple_bot.py                         # KEPT (backward compat, unchanged)
```

---

## Gate Checklist

- [x] `strategy.py` implements frequency, Markov, sequence, and anti-exploitation strategies
- [x] Combined selector picks highest-confidence signal (min threshold 0.4)
- [x] `opponent_model.py` persists per-opponent stats to JSON files
- [x] `bankroll.py` implements Kelly criterion with half-Kelly safety + 5% cap
- [x] `base_bot.py` extracted from simple_bot.py with pluggable `choose_move()`
- [x] 5 distinct opponent bots created (Rock, Gambler, Mirror, Random, Counter)
- [x] `run_all.py` launches all 5 bots in parallel threads
- [x] `arena.py` integrates strategy engine in `_play_game()`
- [x] `arena.py` has `select-match` command (ranks opponents by EV)
- [x] `arena.py` has `recommend` command (Kelly wager recommendation)
- [x] `arena.py` auto-sizes wager if omitted from `challenge` command
- [x] Round history built from on-chain `getRound()` data
- [x] Opponent model updated + saved after each game
- [x] Strategy name + confidence printed with each move for transparency
- [x] `SKILL.md` updated with strategy workflow + new commands
- [x] `references/rps-strategy.md` created for LLM context
- [x] All 6 unit tests pass (strategy, model, bankroll)
- [x] All imports verified (library + bot modules)
- [x] All files compile without syntax errors

---

## Pre-requisites for Gauntlet Testing

1. **Fund wallets 2-5** with ~0.5 MON each (wallet 1 has ~0.3 MON from Phase 2)
2. **Register all bots**: run each bot or `run_all.py` to auto-register
3. **Start all bots**: `python3.13 opponents/run_all.py`
4. **Run gauntlet** via arena.py or OpenClaw agent

---

## Known Issues / Notes for Phase 4

1. **Wallets 2-5 unfunded**: Need MON from faucet or deployer transfer before bots can register/play
2. **Anti-exploitation cooldown**: Currently switches to random immediately; could add a 3-round cooldown counter for more nuanced behavior
3. **Model cold start**: First game against any opponent uses pure random (no data). Win rate improves after 2-3 games as model builds up
4. **Sequence detection window**: Only checks windows 2-4; longer patterns may be missed
5. **simple_bot.py kept**: Backward compatible but not updated to use BaseBot. Could be deprecated in favor of random_bot.py
6. **Thread safety**: `run_all.py` uses daemon threads with shared web3 provider. No known issues but not stress-tested
7. **Strategy logging**: Each move prints `[strategy_name confidence%]` — helpful for LLM context but verbose in long games
