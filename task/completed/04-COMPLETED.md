# Phase 4 — Poker + Auction Game Types (COMPLETED)

> **Completed:** February 9, 2026
> **Phase:** 4 of 8
> **Status:** Done (contracts written + tested, Python wired up, deployment script ready)

---

## Summary

Phase 4 added two new game types — **Poker** and **Auction** — to the Gaming Arena. This includes Solidity smart contracts with full Foundry test suites (102 tests, all passing), Python web3 wrappers, strategy engines, arena.py CLI commands, opponent bot strategies, a deployment script, and updated SKILL.md documentation. The system now supports 3 game types: RPS, Poker, and Auction.

---

## What Was Done

### 1. `contracts/src/PokerGame.sol` — Simplified Poker Contract

**File:** `contracts/src/PokerGame.sol` (NEW)

Simplified commit-reveal poker with:
- **Hand values (1-100)** — both players privately commit a hand value
- **2 betting rounds** — check, bet, raise, call, or fold
- **Showdown** — both reveal hand values, higher hand wins the pot
- **Fold** — opponent wins without reveal

Key design decisions:
- `GameView` struct for `getGame()` return to avoid stack-too-deep errors
- Max bet = 2x escrow wager, max 2 raises per round
- `currentTurn` is an address — turn passes after each action
- Extra bets tracked per player (p1ExtraBets, p2ExtraBets), paid back to winner
- 5-minute phase timeout with `claimTimeout()` for both commit, betting, and showdown phases
- Integrates with Escrow (settle/settleDraw), AgentRegistry (ELO per game type, matchHistory), ERC-8004 reputation

**Actions enum:** None(0), Check(1), Bet(2), Raise(3), Call(4), Fold(5)
**Phases:** Commit → BettingRound1 → BettingRound2 → Showdown → Complete

### 2. `contracts/test/PokerGame.t.sol` — Poker Tests (25 tests)

**File:** `contracts/test/PokerGame.t.sol` (NEW)

| Test | What It Validates |
|------|-------------------|
| `test_createGame` | Game creation linked to escrow match |
| `test_commitHand` | Hand hash commitment |
| `test_commit_revertDoubleCommit` | No double commits |
| `test_bothCommit_advancesToBetting` | Phase transitions after both commit |
| `test_checkCheck_advancesRound` | Both check → next round |
| `test_checkCheck_bothRounds_goesToShowdown` | Both rounds checked → showdown |
| `test_betCall_advancesRound` | Bet + call flow |
| `test_raise_works` | Raise mechanics |
| `test_bet_revertNotYourTurn` | Turn enforcement |
| `test_bet_revertTooLarge` | Max bet cap |
| `test_check_revertWithActiveBet` | Can't check with active bet |
| `test_fold_opponentWins` | Fold → immediate settlement |
| `test_fold_afterBet_winnerGetsExtraBets` | Fold with extra bets distribution |
| `test_showdown_higherHandWins` | Higher hand wins at showdown |
| `test_showdown_equalHandsDraw` | Equal hands → draw settlement |
| `test_showdown_withBets_winnerGetsAll` | Winner gets base + extra bets |
| `test_reveal_revertHashMismatch` | Hash verification |
| `test_reveal_revertInvalidHandValue` | Hand value bounds (1-100) |
| `test_timeout_commitPhase` | Commit timeout claim |
| `test_timeout_bettingPhase` | Betting timeout claim |
| `test_timeout_showdownPhase` | Showdown timeout claim |
| `test_eloUpdateAfterPokerMatch` | ELO update for Poker game type |
| `test_matchRecordAfterPokerGame` | Match history records |
| `test_reputationFeedbackAfterPoker` | ERC-8004 reputation feedback |
| `test_fullGameFlow_betRaiseCallShowdown` | End-to-end game with betting |

### 3. `contracts/src/AuctionGame.sol` — Sealed-Bid Auction Contract

**File:** `contracts/src/AuctionGame.sol` (NEW)

Sealed-bid auction with:
- Both players commit hashed bids (1 wei to wager amount)
- Both reveal bids
- Higher bid wins the prize pool (2x wager)
- Equal bids → draw (both get their wager back)
- `GameView` struct pattern used from the start

**Phases:** Commit → Reveal → Complete

### 4. `contracts/test/AuctionGame.t.sol` — Auction Tests (17 tests)

**File:** `contracts/test/AuctionGame.t.sol` (NEW)

| Test | What It Validates |
|------|-------------------|
| `test_createGame` | Game creation |
| `test_commitBid` | Bid commitment |
| `test_commit_revertDoubleCommit` | No double commits |
| `test_bothCommit_advancesToReveal` | Phase transition |
| `test_higherBidWins` | Higher bid wins |
| `test_lowerBidLoses` | Lower bid loses |
| `test_equalBids_draw` | Equal bids → draw |
| `test_reveal_revertHashMismatch` | Hash verification |
| `test_reveal_revertBidTooHigh` | Bid ≤ wager enforcement |
| `test_reveal_revertBidZero` | Minimum bid (1 wei) |
| `test_minimumBid` | Edge case: 1 wei bid |
| `test_timeout_commitPhase` | Commit timeout |
| `test_timeout_neitherCommitted_draw` | Timeout draw |
| `test_timeout_revealPhase` | Reveal timeout |
| `test_eloUpdateAfterAuction` | ELO update for Auction game type |
| `test_matchRecordAfterAuction` | Match history records |
| `test_reputationFeedbackAfterAuction` | ERC-8004 reputation feedback |

### 5. `contracts/script/DeployNewGames.s.sol` — Deployment Script

**File:** `contracts/script/DeployNewGames.s.sol` (NEW)

- Deploys PokerGame + AuctionGame using existing AgentRegistry + Escrow
- Authorizes both new contracts in Escrow and AgentRegistry
- Reads `AGENT_REGISTRY_ADDRESS` and `ESCROW_ADDRESS` from env
- Prints deployment summary with addresses to add to `.env`

Usage:
```bash
forge script script/DeployNewGames.s.sol:DeployNewGames \
  --rpc-url monad_testnet --broadcast --verify
```

### 6. `contracts/foundry.toml` — Compiler Fix

**File:** `contracts/foundry.toml` (MODIFIED)

- Added `via_ir = true` to solve stack-too-deep compilation error caused by 17-field `GameView` struct returns

### 7. `.env.example` — New Address Placeholders

**File:** `.env.example` (MODIFIED)

- Added `POKER_GAME_ADDRESS=` and `AUCTION_GAME_ADDRESS=`

### 8. `skills/fighter/lib/contracts.py` — Poker + Auction Web3 Wrappers

**File:** `skills/fighter/lib/contracts.py` (MODIFIED)

Added:
- **Constants:** `POKER_GAME_ADDRESS`, `AUCTION_GAME_ADDRESS` env vars
- **Enums:** `PokerPhase` (5 phases), `PokerAction` (6 actions), `AuctionPhase` (3 phases)
- **ABI loading:** `PokerGame.json`, `AuctionGame.json` from Foundry artifacts
- **Contract getters:** `get_poker_game()`, `get_auction_game()` (lazy-loaded)
- **Poker wrappers (9 functions):**
  - `create_poker_game`, `commit_poker_hand`, `poker_take_action`, `reveal_poker_hand`
  - `get_poker_game_state` (returns dict with 17 fields), `get_next_poker_game_id`
  - `claim_poker_timeout`, `parse_poker_game_id_from_receipt`, `make_poker_hand_hash`
- **Auction wrappers (8 functions):**
  - `create_auction_game`, `commit_auction_bid`, `reveal_auction_bid`
  - `get_auction_game_state` (returns dict with 13 fields), `get_next_auction_game_id`
  - `claim_auction_timeout`, `parse_auction_game_id_from_receipt`, `make_auction_bid_hash`

### 9. `skills/fighter/lib/strategy.py` — Poker + Auction Strategy Modules

**File:** `skills/fighter/lib/strategy.py` (MODIFIED)

Added:
- **`choose_hand_value()`** — Random hand value (1-100) for poker
- **`categorize_hand(value)`** — Weak (1-30), Medium (31-60), Strong (61-80), Premium (81-100)
- **`choose_poker_action(hand_value, phase, current_bet, pot, wager, opponent_addr, model)`** — Full poker decision engine:
  - Bluff probability adjusted by opponent win rate (5-25%)
  - No bet: value bet with strong/premium hands, occasional bluff with weak
  - Facing bet: raise with premium, call with strong, pot-odds check for medium, fold weak
  - Returns `(action_str, amount_wei, strategy_name, confidence)`
- **`choose_auction_bid(wager_wei, opponent_addr, model)`** — Bid shading strategy:
  - Base 55% of wager (optimal for 2-player sealed-bid)
  - Adjusted by opponent history: 45% if dominating, 70% if losing
  - ±10% random variation to prevent exploitation
  - Returns `(bid_wei, strategy_name, confidence)`

### 10. `skills/fighter/scripts/arena.py` — 4 New Commands + Updates

**File:** `skills/fighter/scripts/arena.py` (MODIFIED, 660→1175 lines)

**Updated existing commands:**
- **`register`** — Now registers for all game types (RPS, Poker, Auction) by default; accepts optional comma-separated list
- **`status`** — Shows ELO for each registered game type separately
- **`find-opponents`** — Accepts optional game type argument (`rps`, `poker`, `auction`)

**New poker commands:**
- **`challenge-poker <opponent> <wager_MON>`** — Creates escrow match → waits for accept → creates poker game → plays (commit hand → betting rounds → showdown)
- **`accept-poker <match_id>`** — Accepts poker challenge and plays
- **`_play_poker_game()`** — Full game loop: commit phase, betting phases (strategy-driven), showdown reveal, result display, opponent model update
- **`_wait_for_poker_game_or_create()`** — Waits 10s then creates if needed

**New auction commands:**
- **`challenge-auction <opponent> <wager_MON>`** — Creates escrow match → waits for accept → creates auction game → plays (commit bid → reveal bid)
- **`accept-auction <match_id>`** — Accepts auction challenge and plays
- **`_play_auction_game()`** — Full game loop: commit phase, reveal phase, result display, opponent model update
- **`_wait_for_auction_game_or_create()`** — Waits 10s then creates if needed

### 11. `opponents/base_bot.py` — Multi-Game Bot Base Class

**File:** `opponents/base_bot.py` (MODIFIED)

Added:
- **Contract instances:** Poker + Auction contracts loaded if addresses are set
- **Registration:** Registers for all available game types
- **Game type detection:** `_determine_game_contract()` checks match's gameContract address
- **Overridable strategy methods:**
  - `choose_hand_value() -> int` (default: random 1-100)
  - `choose_poker_action(hand_value, phase, current_bet, pot, wager) -> (action, value)` (default: check/call)
  - `choose_auction_bid(wager_wei) -> int` (default: 50% of wager)
- **Game finders:** `find_poker_game_for_match()`, `find_auction_game_for_match()`
- **Game creators:** `wait_for_poker_game_or_create()`, `wait_for_auction_game_or_create()`
- **Tick functions:** `play_poker_tick()`, `play_auction_tick()` (full commit-reveal game loops)
- **Result printers:** `_print_poker_result()`, `_print_auction_result()`
- **Main loop:** Now handles RPS + Poker + Auction games concurrently with separate tracking sets

### 12. Five Opponent Bots — Poker + Auction Strategies

Each bot now overrides `choose_poker_action()` and `choose_auction_bid()`:

| Bot | Poker Strategy | Auction Strategy |
|-----|---------------|-----------------|
| **Rock Bot** | Very tight — folds to bets unless hand >70, never bluffs | Conservative — bids 30% |
| **Gambler Bot** | Loose-aggressive — bluffs 50%, always calls, sometimes raises | Aggressive — bids 70-80% |
| **Mirror Bot** | Matches opponent bet proportionally to hand strength | Neutral — bids 50% |
| **Random Bot** | Pure random actions (check/bet/call/fold/raise) | Random — bids 20-80% |
| **Counter Bot** | Calls most bets to catch bluffs, only folds hand <20 | Slightly above average — bids 55-65% |

### 13. `skills/fighter/SKILL.md` — Full Documentation Update

**File:** `skills/fighter/SKILL.md` (REWRITTEN)

- Updated description: "plays RPS, Poker, and Auction"
- New Quick Start section covering all 3 game types
- Strategy Workflow with game type selection guidance
- Command Reference for all 12 commands
- Step-by-step game flow for each type (RPS, Poker, Auction)
- Updated contract addresses section (Poker/Auction placeholders)
- Updated Important Rules

---

## Test Results

All 102 tests pass across 5 suites:

| Suite | Tests | Status |
|-------|-------|--------|
| AgentRegistry.t.sol | 16 | PASS |
| Escrow.t.sol | 17 | PASS |
| RPSGame.t.sol | 27 | PASS |
| PokerGame.t.sol | 25 | PASS |
| AuctionGame.t.sol | 17 | PASS |
| **Total** | **102** | **ALL PASS** |

---

## Files Created/Modified

```
/Users/marcus/Projects/molteee/
├── contracts/
│   ├── src/
│   │   ├── PokerGame.sol                        # NEW (simplified poker)
│   │   └── AuctionGame.sol                      # NEW (sealed-bid auction)
│   ├── test/
│   │   ├── PokerGame.t.sol                      # NEW (25 tests)
│   │   └── AuctionGame.t.sol                    # NEW (17 tests)
│   ├── script/
│   │   └── DeployNewGames.s.sol                 # NEW (deploy poker + auction)
│   └── foundry.toml                             # MODIFIED (added via_ir = true)
├── skills/fighter/
│   ├── SKILL.md                                 # REWRITTEN (all 3 game types)
│   ├── scripts/
│   │   └── arena.py                             # MODIFIED (4 new commands, 1175 lines)
│   └── lib/
│       ├── contracts.py                         # MODIFIED (~20 new wrappers)
│       └── strategy.py                          # MODIFIED (poker + auction strategies)
├── opponents/
│   ├── base_bot.py                              # MODIFIED (poker + auction game loops)
│   ├── rock_bot.py                              # MODIFIED (poker/auction strategies)
│   ├── gambler_bot.py                           # MODIFIED (poker/auction strategies)
│   ├── mirror_bot.py                            # MODIFIED (poker/auction strategies)
│   ├── random_bot.py                            # MODIFIED (poker/auction strategies)
│   └── counter_bot.py                           # MODIFIED (poker/auction strategies)
└── .env.example                                 # MODIFIED (POKER_GAME_ADDRESS, AUCTION_GAME_ADDRESS)
```

---

## Gate Checklist

- [x] `PokerGame.sol` implements commit-reveal poker with betting rounds and fold
- [x] `AuctionGame.sol` implements sealed-bid commit-reveal auction
- [x] Both contracts integrate with Escrow, AgentRegistry (ELO), and ERC-8004 reputation
- [x] `GameView` struct pattern used in both to avoid stack-too-deep
- [x] 25 poker tests pass (including full game flow, ELO, reputation)
- [x] 17 auction tests pass (including all bid scenarios, timeouts, reputation)
- [x] All 102 tests across 5 suites pass
- [x] `DeployNewGames.s.sol` ready to deploy both contracts
- [x] `contracts.py` has 17 new wrapper functions (9 poker, 8 auction)
- [x] `strategy.py` has poker decision engine + auction bid shading
- [x] `arena.py` has 4 new commands (challenge-poker, accept-poker, challenge-auction, accept-auction)
- [x] `arena.py` register/status/find-opponents updated for multi-game-type support
- [x] `base_bot.py` handles poker + auction game loops with overridable strategy methods
- [x] All 5 bots have unique poker + auction strategies
- [x] `SKILL.md` fully documents all 3 game types
- [x] All Python files pass syntax check
- [x] `.env.example` updated with new address placeholders

---

## What's Next

### Immediate: Deploy to Monad Testnet
```bash
cd contracts
forge script script/DeployNewGames.s.sol:DeployNewGames \
  --rpc-url monad_testnet --broadcast --verify
```
Then add `POKER_GAME_ADDRESS` and `AUCTION_GAME_ADDRESS` to `.env`.

### Phase 3 Gauntlet (Still Pending)
1. Fund opponent wallets 2-5 (~0.5 MON each)
2. Run `python3.13 opponents/run_all.py`
3. Play 5+ RPS matches via `arena.py challenge`
4. Verify >50% win rate

### Phase 5+: Tournament, Demo, Submission
- Optional: `Tournament.sol` for bracket-style multi-agent tournaments
- Demo recording with OpenClaw agent running autonomously
- README.md and moltiverse.dev submission

---

## Known Issues / Notes

1. **Poker hand values are simple (1-100)** — no actual card hands. This is intentional for hackathon simplicity.
2. **Auction is single-round** — no ascending bid mechanism. Sealed-bid only.
3. **Poker/Auction contracts not yet deployed** — `DeployNewGames.s.sol` is ready but needs to be run.
4. **`via_ir = true` slows compilation** — but necessary for `GameView` struct returns.
5. **`simple_bot.py` not updated** — only handles RPS. Use specialized bots for multi-game testing.
6. **Poker bet validation** — bots may attempt invalid bet amounts in edge cases; the contract will revert and the bot retries next tick.
7. **Opponent model for poker/auction** — currently stores hand/bid values as "round history" which isn't ideal for cross-game modeling. Works for hackathon scope.
