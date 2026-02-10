# E2E Testnet Validation Report

**Date:** February 10, 2026
**Network:** Monad Testnet (Chain 10143)
**Fighter:** `0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf`
**Final ELO:** 1085
**Total Matches:** 31 (18W / 13L — 58.1% win rate)

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x96728e0962d7B3fA3B1c632bf489004803C165cE` |
| Escrow | `0x6A52Bd7fe53f022bb7c392DE6285BfEc2d7dD163` |
| RPSGame | `0x4f66f4a355Ea9a54fB1F39eC9Be0E3281c2Cf415` |
| PokerGame | `0xB7B9741da4417852f42267FA1d295E399d11801C` |
| AuctionGame | `0x1Fc358c48e7523800Eec9B0baeD5F7C145e9E847` |
| Tournament | `0xB9a2634E53EA9dF280Bb93195898B7166b2CadAb` |
| TournamentV2 | `0x90a4FacAE37E8d98C36404055Ab8f629bE64b30e` |
| PredictionMarket | `0xEb40a1F092e7e2015A39E4E5355A252b57440563` |

## Opponent Bots Used

| # | Bot | Address | Strategy |
|---|-----|---------|----------|
| 1 | RockBot | `0xCD40Da7306672aa1151bA43ff479e93023e21e1f` | Rock-biased (70% rock) |
| 2 | MirrorBot | `0x37D06C086C9DFC48205d777B0159680ADe7FEfE1` | Tit-for-tat (copies last move) |
| 3 | CounterBot | `0x8290c36e60A57F86bab44949CE114B348c4C8c5A` | Counters opponent's last move |
| 4 | GamblerBot | `0x3828B000Fed74Bac8636405DF366FcEb72710496` | High-risk adaptive |
| 5 | RandomBot | `0xA56766DD77917EFE3E6403BDDDB32E7c9576CAFE` | Uniform random |

---

## Phase 1: RPS Matches

**Result:** 5 matches played (4W / 1L)

| Match | Opponent | Result | Notes |
|-------|----------|--------|-------|
| 1 | RockBot | LOSS (timeout) | Reveal tx reverted, salt lost — bot claimed timeout win |
| 2 | MirrorBot | WIN | Strategy engine exploited tit-for-tat pattern |
| 3 | CounterBot | WIN | Markov prediction effective |
| 4 | GamblerBot | WIN | Pattern-seed + sequence strategies |
| 5 | RockBot | WIN | Correct counter-play after model update |

**Validated:**
- Commit-reveal flow (commit hash → reveal move+salt → on-chain verification)
- ELO updates after each match settlement
- Match history recording in AgentRegistry
- ERC-8004 reputation feedback on settlement
- Strategy engine (Markov chains, pattern detection, sequence prediction)
- Psychological timing delays (erratic/confident/hesitant patterns)
- Opponent model persistence (JSON profiles in `data/`)

## Phase 2: Poker Matches

**Result:** 3 matches played (3W / 0L)

| Match | Opponent | Result | Notes |
|-------|----------|--------|-------|
| 1 | GamblerBot | WIN | Exploited aggressive betting patterns |
| 2 | MirrorBot | WIN | Value-bet strong hands against always-call strategy |
| 3 | CounterBot | WIN | Conservative play against counter-strategy |

**Validated:**
- Hand commit-reveal (commit hand hash → reveal hand value + salt)
- Betting rounds: Check, Bet, Raise, Call, Fold actions
- `takeAction(gameId, action)` payable function for bet/raise
- Showdown and hand comparison logic
- Pot management and settlement through Escrow
- PokerGame ↔ Escrow integration (winner reporting)

## Phase 3: Auction Matches

**Result:** 3 matches played (1W / 2L)

| Match | Opponent | Result | Notes |
|-------|----------|--------|-------|
| 1 | RandomBot | WIN | Bid above random bot's average |
| 2 | MirrorBot | LOSS | Mirror bot bid 50% (near-optimal) |
| 3 | CounterBot | LOSS | Counter bot adapted to bidding pattern |

**Validated:**
- Sealed-bid commit-reveal (commit bid hash → reveal bid + salt)
- First-price auction: highest bidder wins, pays their bid
- Winner determination and settlement
- AuctionGame ↔ Escrow integration

## Phase 4: Prediction Market Lifecycle

**Result:** Full lifecycle tested end-to-end

| Step | Action | Status |
|------|--------|--------|
| 1 | `create-market <match_id> 0.01` | Created market 0 and market 1 |
| 2 | `bet <market_id> yes 0.005` | Bought YES tokens via AMM |
| 3 | Match settlement | Match 16 ended in DRAW |
| 4 | `resolve-market <market_id>` | Resolved as draw (proportional redemption) |
| 5 | `redeem <market_id>` | Claimed tokens back |

**Validated:**
- Market creation with initial liquidity seeding
- Constant-product AMM for YES/NO token pricing
- Bet placement (buying YES tokens shifts price)
- Winner resolution from `Escrow.winners()` mapping
- Draw resolution via `resolveAsDraw()` (all bettors redeem proportionally)
- Token redemption after resolution
- Error handling: hex-encoded revert reason matching for draw detection

## Phase 5: Tournament Lifecycle

**Result:** 4-player round-robin completed (6/6 matches)

**Participants:**
1. Fighter (our agent)
2. RockBot
3. MirrorBot
4. GamblerBot

**Schedule (cross-game rotation):**

| Match | Player 1 | Player 2 | Game Type | Result |
|-------|----------|----------|-----------|--------|
| 1 | Fighter | RockBot | RPS | Fighter WIN |
| 2 | Fighter | MirrorBot | Poker | DRAW |
| 3 | Fighter | GamblerBot | Auction | GamblerBot WIN |
| 4 | RockBot | MirrorBot | Auction | MirrorBot WIN |
| 5 | RockBot | GamblerBot | RPS | GamblerBot WIN |
| 6 | MirrorBot | GamblerBot | Poker | GamblerBot WIN |

**Final Standings:**

| Place | Player | Points |
|-------|--------|--------|
| 1st | GamblerBot | 9 |
| 2nd | Fighter | 6 |
| 3rd | MirrorBot | 3 |
| 4th | RockBot | 0 |

**Validated:**
- TournamentV2 round-robin creation (`createRoundRobin`)
- Player registration (fighter + 3 bots)
- Schedule generation (N*(N-1)/2 matches)
- Cross-game-type match rotation (RPS → Poker → Auction)
- Match result reporting via `reportRRResult()` with escrow match validation
- Standings calculation (3pts win, 1pt draw, 0pts loss)
- Bot-vs-bot matches using `scripts/play_bot_match.py` helper

## Phase 6: Frontend Dashboard

**Result:** All 5 pages verified (HTTP 200)

| Page | Route | Content |
|------|-------|---------|
| Dashboard | `/` | Stat cards, ELO chart, recent matches |
| Matches | `/matches` | Full match history table |
| Opponents | `/opponents` | Opponent profile cards with stats |
| Markets | `/markets` | Active prediction markets |
| Tournaments | `/tournaments` | Tournament brackets and standings |

---

## Bugs Found & Fixed During E2E

### Bug 1: Silent Gas Estimation Failure (Critical)

**File:** `skills/fighter/lib/contracts.py` — `send_tx` / `_send_tx_once`
**Symptom:** RPS reveal transaction reverted on-chain, salt lost, game abandoned.
**Root Cause:** `estimate_gas()` threw an exception (RPC 429 or actual revert), but the catch-all except block silently fell through to a 500k gas fallback. When the real reason was an on-chain revert (e.g., wrong commit hash), the transaction was still sent and burned gas.
**Fix:** Added revert detection in the gas estimation error handler — if the error message contains "revert" or "execution reverted", the function now raises immediately instead of falling back to 500k gas.

### Bug 2: No Retry Logic for RPC Rate Limiting (Critical)

**File:** `skills/fighter/lib/contracts.py` — `send_tx`
**Symptom:** 429 Too Many Requests errors crashed the script mid-game, losing commit salts.
**Root Cause:** No retry/backoff logic for transient RPC errors. With 5 opponent bots + fighter all hitting the same Monad testnet RPC endpoint, rate limits were frequently exceeded.
**Fix:** Wrapped `_send_tx_once` in a retry loop (3 attempts) with exponential backoff (2s, 4s, 8s). Transient errors (429, timeout, connection) trigger retries. Connection errors also trigger `reconnect_w3()` to rebuild the HTTP session.

### Bug 3: Strategy KeyError on Unrevealed Rounds (Medium)

**File:** `skills/fighter/lib/strategy.py` — `sequence_predict`
**Symptom:** `KeyError: 0` crash when strategy engine processed round history containing move=0.
**Root Cause:** On-chain `getRound()` returns `p1Move=0` and `p2Move=0` for unrevealed rounds. These zeroes were passed into `COUNTER` dict lookup which only has keys {1, 2, 3}. The `_build_round_history_from_chain` function in arena.py filters `p1Move > 0 and p2Move > 0`, but the opponent model had already been polluted with zero-moves from earlier games.
**Fix:** Added guard `if opp_last in COUNTER` before COUNTER lookup. Added filter `{k: v for k, v in switch_targets.items() if k in COUNTER}` to strip invalid moves.

### Bug 4: Prediction Market Draw Resolution (Medium)

**File:** `skills/fighter/scripts/arena.py` — `cmd_resolve_market`
**Symptom:** `resolve-market` failed when the match ended in a draw, with an unhelpful hex error.
**Root Cause:** `PredictionMarket.resolve()` calls `Escrow.winners(matchId)` which returns `address(0)` for draws, triggering a revert. The error handler only matched the string "draw" but Monad returns hex-encoded revert reasons, not plaintext.
**Fix:** Broadened the error matching to also catch `"execution reverted"` (covers hex-encoded revert messages), then falls through to `resolveAsDraw()` which distributes tokens proportionally.

### Bug 5: Insufficient Gas for Settlement-Triggering Reveals (Low)

**File:** `scripts/play_bot_match.py`
**Symptom:** Bot-vs-bot RPS reveal transactions reverted with out-of-gas.
**Root Cause:** The second reveal in the final round triggers game settlement, which includes ELO calculation, AgentRegistry updates, and ERC-8004 reputation feedback — all in one transaction. The 500k gas default was insufficient for this compound operation.
**Fix:** Increased gas limit to 1,500,000 in `play_bot_match.py`. The main `contracts.py` already uses `estimate_gas * 1.2` which handles this dynamically.

---

## Bug 6: Corrupted Opponent Model Data (Fixed)

**Status:** Fixed
**Files affected:** All 5 opponent model JSON files in `skills/fighter/data/`, plus `arena.py` and `opponent_model.py`

### Symptom

Opponent model JSON files contained garbage values in `round_history` and `move_counts`:
```json
// Example from MirrorBot profile (before fix)
"round_history": [
  [1, 2],           // valid: Rock vs Paper
  [759744102948236, 770193987530551],  // garbage: raw uint256 values
  [76, 33],         // garbage: mid-range integers
  [0, 0]            // invalid: unrevealed round (move=0)
]
```

All 5 opponent files had the same pattern — 1-3 pairs of corrupted entries mixed with valid data.

### Root Cause

**Poker and Auction games recorded non-RPS data into the same opponent model.**

In `arena.py`:
- **RPS** (line 597-601): Calls `_build_round_history_from_chain()` which reads `p1Move`/`p2Move` from `getRound()`. These are uint8 values 1-3. Correctly validated with `p1Move > 0 and p2Move > 0`.
- **Poker** (line 931): Recorded `(my_hand, opp_hand)` — hand values are large integers (card encodings), not 1-3.
- **Auction** (line 1197): Recorded `(my_bid, opp_bid)` — bids are wei amounts like `500000000000000` (0.0005 MON).

All three game types wrote to the **same** `OpponentModel` instance, which was designed only for RPS move tracking (expects moves 1/2/3). The poker hand values (e.g., `76`, `33`, `65`) and auction bid amounts (e.g., `457516098979379`, `575696292659169`) got stored as if they were RPS moves, polluting `move_counts`, `transitions`, and `round_history`.

### Fix Applied

1. **`arena.py`** — Poker and Auction settlement now pass `[]` (empty round history) to `model.update()` instead of hand values/bid amounts. Match win/loss results are still recorded.
2. **`opponent_model.py`** — `update()` now validates all round data against `VALID_MOVES = {1, 2, 3}`, filtering out anything that isn't a valid RPS move. Defensive guard so this class of bug can't recur even if callers pass bad data.
3. **Data files** — All 5 opponent JSON files cleaned: 12 total garbage entries removed. `move_counts` and `transitions` rebuilt from clean round history.

Entries removed per file:
- MirrorBot: 13 → 8 rounds (5 removed)
- CounterBot: 8 → 6 rounds (2 removed)
- GamblerBot: 7 → 6 rounds (1 removed)
- RandomBot: 8 → 6 rounds (2 removed)
- RockBot: 11 → 9 rounds (2 removed)

---

## Summary

| Category | Target | Actual | Status |
|----------|--------|--------|--------|
| Total matches | 20+ | 31 | Pass |
| RPS matches | 3-5 | 5 (4W/1L) | Pass |
| Poker matches | 3-5 | 3 (3W/0L) | Pass |
| Auction matches | 3-5 | 3 (1W/2L) | Pass |
| Prediction Market | Full lifecycle | Create → Bet → Resolve Draw → Redeem | Pass |
| Tournament | Full lifecycle | 4-player round-robin, 6/6 matches | Pass |
| Frontend | All pages load | 5/5 pages HTTP 200 | Pass |
| Bugs fixed | — | 6 bugs found and fixed | — |

**Wallet balance spent:** ~2.72 MON (87.05 → 84.33) across 31 matches + markets + tournament.
