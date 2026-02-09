# Phase 7+8 Blocks 0-3 — Contracts + Next.js Dashboard (COMPLETE)

> **Date:** February 9-10, 2026
> **Phase:** 7+8 (Blocks 0-3)
> **Status:** COMPLETE — Contracts deployed (160 tests), Next.js dashboard built with live on-chain data

---

## Summary

Blocks 0-2 implement three major contract upgrades: (1) Escrow v3 adds a `winners` mapping so external contracts can trustlessly read match outcomes, (2) PredictionMarket.sol provides a constant-product AMM for binary outcome betting on matches, and (3) TournamentV2.sol adds round-robin and double-elimination tournament formats. All contracts were deployed in a single DeployV3 script that redeploys the full stack with the new Escrow.

Block 3 adds a full Next.js dashboard (`frontend/`) that reads on-chain data from all deployed contracts via viem, displaying agent stats, match history, prediction markets, and tournaments with a dark-mode gaming aesthetic.

---

## What Was Completed

### Block 0 — Escrow v3 (winners mapping)

**2-line change to Escrow.sol:**
- Added `mapping(uint256 => address) public winners;` storage variable
- Added `winners[_matchId] = _winner;` in the `settle()` function
- This enables PredictionMarket and TournamentV2 to trustlessly read match winners without needing callbacks

### Block 1 — PredictionMarket.sol

**Deployed to Monad testnet:** `0xeb40a1f092e7e2015a39e4e5355a252b57440563`

Constant-product AMM for binary outcome betting on escrow matches:

- **Market creation:** Anyone can create a market for an Active escrow match with seed liquidity
- **YES/NO tokens:** YES = player1 wins, NO = player2 wins
- **AMM pricing:** Uses `k = reserveYES * reserveNO` constant-product formula
- **Buy/Sell:** buyYES(), buyNO(), sellYES(), sellNO() with automatic price adjustment
- **Trustless resolution:** Reads `Escrow.winners(matchId)` — no oracle needed
- **Draw handling:** resolveAsDraw() for settled matches with no winner (proportional refund)
- **Redemption:** Winners redeem tokens proportional to their share of total winning tokens
- **Rounding protection:** Payout capped to available contract balance

**Test Suite — 15 tests covering:**
- Market creation (valid, duplicate prevention, inactive match rejection)
- Token buying (YES/NO, price movement, zero-MON rejection)
- Token selling (both sides, insufficient balance)
- Resolution (winner determination, draw handling, premature resolution)
- Redemption (winner payout, draw proportional refund)
- Full lifecycle (create → buy → resolve → redeem)

### Block 2 — TournamentV2.sol

**Deployed to Monad testnet:** `0x90a4facae37e8d98c36404055ab8f629be64b30e`

Round-robin and double-elimination tournament formats:

- **Two formats:** `TournamentFormat.RoundRobin` and `TournamentFormat.DoubleElim`
- **Round-Robin:**
  - N*(N-1)/2 pairwise matches generated automatically
  - Points system: 3 points per win
  - Winner determined by most points (tiebreak by head-to-head)
  - Game type rotation: matchIndex % 3 → RPS/Poker/Auction
- **Double-Elimination:**
  - Winners bracket, losers bracket, grand final
  - Players eliminated after 2 losses
  - Sequential seeding (1vN, 2v(N-1))
  - 4-player: 6 matches, 8-player: 14 matches
- **Trustless results:** Reads `Escrow.winners(escrowMatchId)` — same pattern as PredictionMarket
- **Prize distribution:** 70% winner, 30% runner-up
- **Cancel with refunds:** During registration phase only

**Test Suite — 21 tests covering:**
- Tournament creation (both formats, invalid player counts)
- Registration (entry fee locking, full rejection, duplicate prevention)
- Round-robin schedule generation (correct pairings)
- Round-robin result reporting (points tracking, winner determination)
- Double-elimination bracket (winners/losers bracket, grand final)
- Prize distribution (70/30 split, runner-up identification)
- Cancel with refunds
- Full 4-player round-robin lifecycle
- Full 4-player double-elimination lifecycle

### DeployV3.s.sol

Full stack redeployment script that:
1. Deploys new Escrow v3 (with winners mapping)
2. Deploys RPSGame, PokerGame, AuctionGame pointing to new Escrow
3. Deploys Tournament (v1) pointing to new stack
4. Deploys PredictionMarket pointing to new Escrow
5. Deploys TournamentV2 pointing to new stack
6. Authorizes all game contracts in Escrow and AgentRegistry
7. Prints update instructions for .env

---

## Deployed Contract Addresses (V3 Stack)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x96728e0962d7B3fA3B1c632bf489004803C165cE` *(kept)* |
| Escrow v3 | `0x6a52bd7fe53f022bb7c392de6285bfec2d7dd163` |
| RPSGame | `0x4f66f4a355ea9a54fb1f39ec9be0e3281c2cf415` |
| PokerGame | `0xb7b9741da4417852f42267fa1d295e399d11801c` |
| AuctionGame | `0x1fc358c48e7523800eec9b0baed5f7c145e9e847` |
| Tournament | `0xb9a2634e53ea9df280bb93195898b7166b2cadab` |
| **PredictionMarket** | **`0xeb40a1f092e7e2015a39e4e5355a252b57440563`** |
| **TournamentV2** | **`0x90a4facae37e8d98c36404055ab8f629be64b30e`** |

---

## Files Created / Modified

```
contracts/
├── src/
│   ├── Escrow.sol                        # MODIFIED — added winners mapping (2 lines)
│   ├── PredictionMarket.sol              # CREATED — constant-product AMM (358 lines)
│   └── TournamentV2.sol                  # CREATED — round-robin + double-elim (483 lines)
├── test/
│   ├── PredictionMarket.t.sol            # CREATED — 15 tests
│   └── TournamentV2.t.sol               # CREATED — 21 tests
├── script/
│   └── DeployV3.s.sol                    # CREATED — full stack redeploy
└── broadcast/
    └── DeployV3.s.sol/10143/             # Deployment records

.env.example                              # MODIFIED — added PREDICTION_MARKET_ADDRESS, TOURNAMENT_V2_ADDRESS
```

---

## Test Summary

| Contract | Tests | Status |
|----------|-------|--------|
| AgentRegistry | 16 | PASS |
| Escrow | 17 | PASS |
| RPSGame | 27 | PASS |
| PokerGame | 25 | PASS |
| AuctionGame | 17 | PASS |
| Tournament | 22 | PASS |
| **PredictionMarket** | **15** | **PASS** |
| **TournamentV2** | **21** | **PASS** |
| **Total** | **160** | **ALL PASS** |

---

## Gate Checklist

- [x] Escrow v3 compiles with `winners` mapping, existing tests pass (17)
- [x] PredictionMarket.sol compiles, 15 tests pass
- [x] TournamentV2.sol compiles, 21 tests pass
- [x] Full stack deployed via DeployV3.s.sol (all 7 new contracts)
- [x] PredictionMarket address in .env: `0xeb40a1f092e7e2015a39e4e5355a252b57440563`
- [x] TournamentV2 address in .env: `0x90a4facae37e8d98c36404055ab8f629be64b30e`
- [x] 160 total tests passing across 8 test suites
- [x] .env.example updated with new address fields

### Block 3 — Next.js Dashboard (`frontend/`)

**Tech stack:** Next.js 16 (Pages Router) + shadcn/ui + Tailwind CSS 4 + viem + recharts

Client-side dashboard reading on-chain data from all 8 deployed contracts on Monad testnet:

- **Layout:** Sidebar navigation (5 pages) + header with fighter address and MON balance
- **Dark mode:** Always-on via `class="dark"` on `<html>`, gaming aesthetic
- **Data fetching:** 4 custom hooks with 30s polling via `useEffect` + `setInterval`
- **No wallet connection:** Hardcoded fighter address (`0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf`), read-only via viem `publicClient`

**Pages:**

| Page | Route | Data Source |
|------|-------|-------------|
| Dashboard | `/` | AgentRegistry (balance, ELO, match count) — 4 stat cards + ELO bar chart + recent matches |
| Matches | `/matches` | AgentRegistry.getMatchHistory — full table with date, opponent, game type, result, wager |
| Opponents | `/opponents` | Match history grouped by opponent — cards with win rate, record, total wagered |
| Markets | `/markets` | PredictionMarket (all markets) — cards with YES/NO price bars, resolution status |
| Tournaments | `/tournaments` | Tournament V1 + V2 — cards with entry fee, prize pool, players, expandable participants |

**ABIs:** Extracted view-only functions from Foundry build artifacts into `lib/abi/*.ts` with `as const` for viem type inference.

**Build:** `npm run build` passes with zero TypeScript errors.

**Files created (~30 files):**

```
frontend/
├── lib/
│   ├── contracts.ts                    # CREATED — viem client, Monad testnet chain, all contract addresses
│   └── abi/
│       ├── AgentRegistry.ts            # CREATED — 8 view functions
│       ├── Escrow.ts                   # CREATED — 7 view functions
│       ├── PredictionMarket.ts         # CREATED — 13 view functions
│       ├── Tournament.ts              # CREATED — 18 view functions
│       └── TournamentV2.ts            # CREATED — 25 view functions
├── hooks/
│   ├── useAgentData.ts                 # CREATED — balance, ELO, match count, registration
│   ├── useMatchHistory.ts              # CREATED — full match history array
│   ├── useMarkets.ts                   # CREATED — all prediction markets + prices
│   └── useTournaments.ts              # CREATED — V1 + V2 tournaments + participants
├── components/
│   ├── ui/                             # CREATED — 8 shadcn components (card, table, badge, etc.)
│   ├── layout/
│   │   ├── DashboardLayout.tsx         # CREATED — sidebar + header + content wrapper
│   │   ├── Sidebar.tsx                 # CREATED — 5 nav links with active state, lucide icons
│   │   └── Header.tsx                  # CREATED — fighter address badge + MON balance
│   ├── dashboard/
│   │   ├── StatCard.tsx                # CREATED — reusable icon + title + value card
│   │   ├── RecentMatches.tsx           # CREATED — last 10 matches with result badges
│   │   └── EloChart.tsx                # CREATED — recharts bar chart, 3 game types
│   ├── matches/
│   │   └── MatchTable.tsx              # CREATED — full table with date, opponent, game, result, wager
│   ├── opponents/
│   │   └── OpponentCard.tsx            # CREATED — per-opponent stats with groupByOpponent helper
│   ├── markets/
│   │   └── MarketCard.tsx              # CREATED — YES/NO price bars, resolution status
│   └── tournaments/
│       ├── TournamentCard.tsx          # CREATED — V1/V2 info with format labels
│       └── StandingsTable.tsx          # CREATED — participant list with "You" highlight
├── pages/
│   ├── _app.tsx                        # MODIFIED — wrapped with DashboardLayout
│   ├── _document.tsx                   # MODIFIED — added class="dark" to <html>
│   ├── index.tsx                       # REPLACED — dashboard overview with stat cards + charts
│   ├── matches.tsx                     # CREATED — match history table page
│   ├── opponents.tsx                   # CREATED — opponent cards grid page
│   ├── markets.tsx                     # CREATED — prediction market cards page
│   └── tournaments.tsx                 # CREATED — tournament cards with expandable standings
└── package.json                        # MODIFIED — added viem, recharts
```

---

## Dashboard Gate Checklist

- [x] `npm run build` succeeds with zero errors
- [x] Dashboard page shows 4 stat cards (Balance, Matches, Win Rate, Best ELO)
- [x] ELO bar chart displays ratings across 3 game types (RPS, Poker, Auction)
- [x] Recent matches list with WIN/LOSS badges and wager amounts
- [x] Sidebar navigation with 5 pages and active state highlighting
- [x] Match history table with date, opponent, game type, result, wager columns
- [x] Opponent cards grouped by address with win rate and match records
- [x] Prediction market cards with YES/NO price bars and resolution status
- [x] Tournament cards (V1 + V2) with expandable participant standings
- [x] Dark mode renders correctly with gaming aesthetic
- [x] All data reads from Monad testnet via viem publicClient
- [x] 30-second polling on all data hooks
