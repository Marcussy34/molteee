# Phase 7 + 8: Complete App — Demo, Polish, Prediction Market, Spectator, Advanced Tournaments

## Context

Phases 1-6 are COMPLETE. 6 contracts deployed, 124 tests passing, 17 CLI commands, 5 opponent bots, ERC-8004 integration. Deadline: Feb 15, 2026 (6 days). Phase 8 is treated as CORE. Goal: ship everything before submission.

**Production-grade design:** PredictionMarket resolution must be fully trustless on-chain. This requires adding a `winners` mapping to Escrow.sol so any contract can read the winner of a settled match without trust assumptions. This triggers a full contract redeployment (v3).

---

## Block 0: Escrow v3 + Full Redeployment

**CRITICAL PREREQUISITE — must happen before PredictionMarket or TournamentV2.**

### Escrow.sol Changes (2 lines)

```solidity
// Add to storage section:
mapping(uint256 => address) public winners;

// Add to settle() function, before payout:
winners[_matchId] = _winner;
```

`settleDraw()` needs no change — `winners[matchId]` stays `address(0)` (naturally means draw).

### Redeployment Chain

| Contract | Action | Reason |
|----------|--------|--------|
| AgentRegistry | **KEEP** existing `0x9672...` | No Escrow dependency. Re-authorize new game contracts. |
| ERC-8004 Registries | **KEEP** existing | Singletons, no change |
| Escrow | **REDEPLOY** | Add `winners` mapping |
| RPSGame | **REDEPLOY** | Constructor takes Escrow address (immutable) |
| PokerGame | **REDEPLOY** | Constructor takes Escrow address (immutable) |
| AuctionGame | **REDEPLOY** | Constructor takes Escrow address (immutable) |
| Tournament | **REDEPLOY** | Points to Escrow + game contracts |
| PredictionMarket | **NEW DEPLOY** | Reads `escrow.winners()` — fully trustless |
| TournamentV2 | **NEW DEPLOY** | Points to new Escrow + game contracts |

### Deployment Script

**New file:** `contracts/script/DeployV3.s.sol` — deploys full stack in one tx:
1. Deploy Escrow (with `winners` mapping)
2. Deploy RPSGame, PokerGame, AuctionGame (pointing to new Escrow + existing Registry)
3. Deploy Tournament (pointing to new Escrow + existing Registry + new game contracts)
4. Deploy PredictionMarket (pointing to new Escrow)
5. Deploy TournamentV2 (pointing to new Escrow + existing Registry + new game contracts)
6. Authorize RPSGame, PokerGame, AuctionGame on new Escrow
7. Authorize RPSGame, PokerGame, AuctionGame on existing AgentRegistry (re-authorize)
8. Print all new addresses

### Post-Deploy Updates

- `.env` — update all addresses except AGENT_REGISTRY_ADDRESS and ERC-8004 addresses
- `.env.example` — add PREDICTION_MARKET_ADDRESS, TOURNAMENT_V2_ADDRESS
- Python `contracts.py` — addresses auto-read from env, no code change needed
- Opponent bots — read addresses from env, no code change needed
- Existing match history — preserved on old contracts (queryable forever)
- ELO/registration — preserved (AgentRegistry kept)

---

## Summary of What Needs to Be Built

| # | Feature | Phase | New Files | Modified Files |
|---|---------|-------|-----------|----------------|
| 0 | Escrow v3 + full redeployment | 8 | 1 sol script | Escrow.sol, .env |
| 1 | PredictionMarket.sol (AMM) | 8 | 2 sol | contracts.py, arena.py |
| 2 | TournamentV2.sol (round-robin + double-elim) | 8 | 2 sol | contracts.py, arena.py |
| 3 | Spectator Skill | 8 | 4 py + SKILL.md | — |
| 4 | Psychology Module | 7 | 1 py | arena.py, strategy.py |
| 5 | Enhanced Terminal Output | 7 | 1 py | arena.py |
| 6 | Moltbook Integration | 7 | 1 py | arena.py, .env |
| 7 | SKILL.md + README + Demo Script | 7 | 1 py | SKILL.md, README.md |
| 8 | React Dashboard | 7 | ~15 tsx/ts | — |
| 9 | Testnet E2E (deploy + run) | 7+8 | — | .env, completion docs |

---

## Block 1: PredictionMarket.sol + Tests

**New files:**
- `contracts/src/PredictionMarket.sol` (~200 lines)
- `contracts/test/PredictionMarket.t.sol` (~400 lines)

(Deployment handled by `DeployV3.s.sol` in Block 0)

**Design: Constant-product AMM (x*y=k)**
- Simpler than LMSR (no log/exp math). Pure integer mul/div.
- Binary outcome: YES (player1 wins) / NO (player2 wins)

**Contract structure:**
```
struct Market {
    uint256 matchId;        // Escrow match ID
    uint256 reserveYES;     // YES token reserve
    uint256 reserveNO;      // NO token reserve
    uint256 seedLiquidity;  // initial seed amount
    address player1;        // YES = player1 wins
    bool resolved;
    address winner;
}

Functions:
  createMarket(matchId) payable → marketId     // seed liquidity, link to escrow match
  buyYES(marketId) payable                      // buy YES tokens (MON in, tokens out)
  buyNO(marketId) payable                       // buy NO tokens
  sellYES(marketId, amount)                     // sell tokens back
  sellNO(marketId, amount)
  resolve(marketId, winner)                     // verify escrow Settled + correct player
  redeem(marketId)                              // winning token holders claim MON
  getPrice(marketId) → (yesPrice, noPrice)      // price = opposite_reserve / total
  getMarket(marketId) → Market
```

**Resolution design (TRUSTLESS):** `resolve(marketId)` — no parameters needed:
```solidity
function resolve(uint256 _marketId) external {
    Market storage m = markets[_marketId];
    require(!m.resolved, "already resolved");

    // Fully trustless — reads winner directly from Escrow v3 storage
    address winner = escrow.winners(m.matchId);
    require(winner != address(0), "match not settled or was a draw");

    m.resolved = true;
    m.winner = winner;
}
```
Anyone can call. No trust assumptions. Reads winner from Escrow's `winners` mapping.
For draws (`winners[matchId] == address(0)`), a separate `resolveAsDraw()` refunds all bettors proportionally.

**Tests (~12):**
- createMarket, buyYES/NO, price movement, constant product invariant
- resolve after settlement, redeem winning tokens
- revert: resolve unsettled, double resolve, redeem losing tokens
- full lifecycle: create → buy → match → resolve → redeem

---

## Block 2: TournamentV2.sol + Tests

**New files:**
- `contracts/src/TournamentV2.sol` (~350 lines)
- `contracts/test/TournamentV2.t.sol` (~500 lines)

(Deployment handled by `DeployV3.s.sol` in Block 0)

**Design: Single contract with format enum**

```
enum TournamentFormat { RoundRobin, DoubleElim }

RoundRobin:
  - N players, N*(N-1)/2 matches total
  - 3 points per win, 0 per loss
  - Winner = most points; tiebreaker = head-to-head
  - All matches in single "round" with pairwise scheduling
  - Game type rotates per match index (matchIdx % 3)

DoubleElim:
  - Winners bracket + losers bracket
  - Lose once → drop to losers bracket
  - Lose twice → eliminated
  - Final: winners champ vs losers champ
  - 4 or 8 players supported
```

**Shared infrastructure:** Same Escrow + AgentRegistry + game contracts. Same reportResult pattern (verify escrow settlement).

**Key mappings:**
```
// Round-robin
mapping(tournamentId => mapping(player => points)) public rrPoints;
mapping(tournamentId => matchIndex => BracketMatch) public rrMatches;

// Double-elimination
mapping(tournamentId => bracket => round => matchIndex => BracketMatch) public deMatches;
mapping(tournamentId => player => lossCount) public losses;
```

**Tests (~15):**
- Round-robin: creation, schedule generation, point tracking, winner determination, 4-player full lifecycle
- Double-elim: creation, losers bracket drop, must-lose-twice, finals, 4-player full lifecycle
- Prize distribution for both formats
- Edge cases: odd player counts, all draws (round-robin)

If contract size is too large, split into `TournamentRoundRobin.sol` and `TournamentDoubleElim.sol`.

---

## Block 3: Python Wrappers + CLI Commands

**Modified files:**
- `skills/fighter/lib/contracts.py` — add PredictionMarket + TournamentV2 wrappers
- `skills/fighter/scripts/arena.py` — add ~10 new commands

**contracts.py additions:**
- `PREDICTION_MARKET_ADDRESS`, `TOURNAMENT_V2_ADDRESS` from env
- Lazy getters: `get_prediction_market()`, `get_tournament_v2()`
- ~15 wrapper functions for both contracts

**arena.py new commands:**
| Command | Description |
|---------|-------------|
| `create-market <match_id>` | Create prediction market for a match |
| `bet <market_id> <yes\|no> <amount>` | Buy YES/NO tokens |
| `market-status <market_id>` | Show prices and positions |
| `resolve-market <market_id>` | Resolve after match settles |
| `redeem <market_id>` | Redeem winning tokens |
| `create-round-robin <fee> <wager> <n>` | Create round-robin tournament |
| `create-double-elim <fee> <wager> <n>` | Create double-elim tournament |
| `play-rr <id>` | Play next round-robin match |
| `play-de <id>` | Play next double-elim match |

---

## Block 4: Spectator Skill

**New files:**
```
skills/spectator/
├── SKILL.md                    # Skill manifest for OpenClaw
├── scripts/
│   └── spectate.py             # CLI dispatcher (5 commands)
├── lib/
│   ├── contracts.py            # PredictionMarket + Escrow wrappers
│   └── estimator.py            # ELO-based outcome estimation
└── data/
    └── predictions.json        # Historical prediction tracking
```

**SKILL.md frontmatter:**
```yaml
name: "spectator"
description: "Spectator Agent — monitors arena matches, estimates outcomes, places prediction market bets."
requires:
  bins: ["python3.13"]
  env: ["MONAD_RPC_URL", "DEPLOYER_PRIVATE_KEY"]
```

**Commands:**
| Command | Description |
|---------|-------------|
| `watch` | Scan for active matches, show current state |
| `analyze <match_id>` | ELO-based win probability estimate |
| `bet <market_id> <yes\|no> <amount>` | Place bet on prediction market |
| `portfolio` | Show current positions and P&L |
| `accuracy` | Historical prediction accuracy stats |

**estimator.py:** Uses standard ELO expected score formula: `E = 1 / (1 + 10^((R2-R1)/400))` plus head-to-head history adjustment.

**Match discovery:** Polls `Escrow.nextMatchId()`, scans recent IDs for Active status. Same pattern as existing opponent bots.

---

## Block 5: Psychology Module

**New file:** `skills/fighter/scripts/psychology.py` (~200 lines)

**Four tactics:**

1. **Timing Manipulation** — `get_commit_delay(round, state)` returns seconds to sleep before commit. Modes: fast (0.5s, confidence), slow (3-8s, deliberation), erratic (random 0.5-10s), escalating (start fast, get slower).

2. **Pattern Seeding** — `should_seed_pattern(round, total)` returns True for first ~35% of rounds. `get_seeded_move()` returns a deliberate pattern (e.g., Rock x3). After seeding, `get_exploitation_move(model)` predicts opponent's counter and counters THAT.

3. **Tilt Induction** — `should_tilt_challenge(opponent, model)` returns recommendation to re-challenge at 2x wager after a win, within Kelly limits.

4. **Reputation Manipulation** — `should_sandbag(elo, target)` for lowering ELO to face weaker opponents. `get_elo_pumping_targets(agents, our_elo)` ranks easy wins.

**Integration into arena.py:**
- Before `commit_move()`: call `psychology.get_commit_delay()` + `time.sleep()`
- In strategy selection: check `psychology.should_seed_pattern()` → override move
- After match: check `psychology.should_tilt_challenge()` → print recommendation
- Config stored in `data/psychology_config.json`

---

## Block 6: Enhanced Terminal Output

**New file:** `skills/fighter/lib/output.py` (~150 lines)

- ANSI color codes (GREEN/RED/YELLOW/CYAN/BOLD/DIM)
- `print_match_header(game_type, opponent, wager, elo_diff)`
- `print_round_result(round, my_move, opp_move, winner, strategy, confidence)`
- `print_match_summary(won, scores, elo_before/after, balance_before/after, tx_hash)`
- `print_strategy_reasoning(strategy_name, confidence, alternatives)`
- `print_opponent_model_state(model)` — move distribution, pattern detections

**Modify arena.py** to replace plain `print()` calls with styled output functions.

---

## Block 7: Moltbook Integration

**New file:** `skills/fighter/lib/moltbook.py` (~100 lines)

- `register_agent(name, description)` → `POST /api/v1/agents/register`
- `post_match_result(game_type, opponent, result, wager, elo_change, strategy)` → `POST /api/v1/posts` to submolt "moltiversehackathon"
- Rate limit tracking (1 post per 30 min) in `data/moltbook_state.json`
- `can_post()` check, `get_api_key()` from credentials

**arena.py additions:**
- `moltbook-register` command
- `moltbook-post <text>` command
- Auto-post at end of each game function (rate-limited)

**New env vars:** `MOLTBOOK_API_KEY` in `.env`

---

## Block 8: React Dashboard

**New directory:** `dashboard/`

Simple React app (Vite+React) showing:
- **Live match feed** — polls Escrow for recent matches, shows status/players/game type
- **Bankroll chart** — line chart of MON balance over time (from match history)
- **ELO progression** — line chart of ELO ratings per game type over time
- **Opponent profiles** — cards showing each opponent's stats, win rate against them
- **Win rates by game type** — bar chart (RPS/Poker/Auction)
- **Prediction market prices** — live YES/NO prices for active markets
- **Tournament brackets** — visual bracket display

**Tech:** Vite + React + Tailwind CSS + shadcn/ui + recharts (for charts) + viem/wagmi (for chain reads)

**Data sources:**
- On-chain: AgentRegistry (ELO, match history), Escrow (match data), PredictionMarket (prices)
- Local: `data/*.json` opponent models (optional, for detailed opponent cards)

**Pages:**
- `/` — Dashboard overview: bankroll, ELO, recent matches
- `/matches` — Full match history table
- `/opponents` — Opponent profile cards
- `/markets` — Active prediction markets with live prices
- `/tournaments` — Tournament brackets and standings

**Key components:**
- `MatchFeed` — polls chain every 10s, shows latest matches
- `BankrollChart` — recharts LineChart with MON balance history
- `EloChart` — recharts LineChart with per-game ELO
- `OpponentCard` — shadcn Card showing opponent stats
- `MarketTicker` — shows YES/NO prices updating live
- `BracketView` — single-elim and round-robin visual brackets

Runs locally during demo: `npm run dev` → `localhost:5173`

---

## Block 9: SKILL.md + README + Demo Script + Completion Docs

**Modified:** `skills/fighter/SKILL.md`
- Add psychology tactics section
- Add prediction market commands
- Add TournamentV2 commands
- Add Moltbook commands

**Modified:** `README.md`
- Add Tournament section (single-elim + round-robin + double-elim)
- Add PredictionMarket section
- Add Spectator skill section
- Add Psychology module section
- Add Moltbook section
- Add Dashboard section
- Update architecture diagram
- Update test count (124 + new)
- Update project structure tree

**New:** `skills/fighter/scripts/demo.py`
- Scripted sequence: status → register → scan → RPS match (with psychology + color output) → create prediction market → spectator bet → tournament → Moltbook post → final stats
- Timed for 3-5 minutes

**Modified:** `task/completed/07-COMPLETED.md` and `task/completed/08-COMPLETED.md`

---

## Implementation Order

| Step | Block | Est. Time | Dependencies |
|------|-------|-----------|--------------|
| 0 | Escrow v3 change + DeployV3.s.sol | 1h | None |
| 1 | PredictionMarket.sol + tests | 3-4h | Block 0 (Escrow `winners`) |
| 2 | TournamentV2.sol + tests | 3-4h | Block 0 (parallel with 1) |
| 3 | `forge test` all + Deploy v3 to Monad testnet | 30min | Blocks 0+1+2 |
| 4 | Python wrappers + CLI commands | 1.5h | Block 3 |
| 5 | Spectator Skill | 2-3h | Block 4 (PredictionMarket wrappers) |
| 6 | Psychology Module | 1.5-2h | None |
| 7 | Enhanced Terminal Output | 1h | None |
| 8 | Moltbook Integration | 1-1.5h | None |
| 9 | React Dashboard | 4-6h | Block 3 (contract addresses needed) |
| 10 | SKILL.md + README + Demo Script | 1.5h | All above |
| 11 | E2E testnet validation | 1-2h | All above |

**Total: ~22-28 hours of implementation**

Steps 1+2 can run in parallel. Steps 6+7+8 can run in parallel. Dashboard (9) can overlap with 6+7+8.

---

## Verification Plan

1. `cd contracts && forge test` — all tests pass (124 existing + ~27 new = ~151+)
2. PredictionMarket deployed, `arena.py create-market` works
3. TournamentV2 deployed, `arena.py create-round-robin` works
4. Spectator skill: `spectate.py watch` finds active matches, `bet` places bets
5. Psychology: visible timing delays + pattern seeding in RPS match output
6. Enhanced output: color-coded match results with strategy reasoning
7. Moltbook: `moltbook-register` succeeds, `moltbook-post` delivers to moltbook.com
8. React dashboard: `npm run dev` shows live data from chain (matches, ELO, markets)
9. Demo script runs 3-5 min sequence end-to-end on testnet
10. Full tournament (round-robin or double-elim) completes with 4 agents
11. Prediction market lifecycle: create → bet → match → resolve → redeem

---

## Files Created/Modified Summary

| File | Action |
|------|--------|
| `contracts/src/Escrow.sol` | MODIFY (add `winners` mapping + 1 line in `settle()`) |
| `contracts/src/PredictionMarket.sol` | CREATE |
| `contracts/test/PredictionMarket.t.sol` | CREATE |
| `contracts/src/TournamentV2.sol` | CREATE |
| `contracts/test/TournamentV2.t.sol` | CREATE |
| `contracts/script/DeployV3.s.sol` | CREATE (full stack deploy) |
| `skills/spectator/SKILL.md` | CREATE |
| `skills/spectator/scripts/spectate.py` | CREATE |
| `skills/spectator/lib/contracts.py` | CREATE |
| `skills/spectator/lib/estimator.py` | CREATE |
| `skills/fighter/scripts/psychology.py` | CREATE |
| `skills/fighter/lib/output.py` | CREATE |
| `skills/fighter/lib/moltbook.py` | CREATE |
| `skills/fighter/scripts/demo.py` | CREATE |
| `dashboard/` (Vite+React app) | CREATE |
| `skills/fighter/lib/contracts.py` | MODIFY |
| `skills/fighter/scripts/arena.py` | MODIFY |
| `skills/fighter/SKILL.md` | MODIFY |
| `README.md` | MODIFY |
| `.env` + `.env.example` | MODIFY |
| `task/completed/07-COMPLETED.md` | MODIFY |
| `task/completed/08-COMPLETED.md` | CREATE |
