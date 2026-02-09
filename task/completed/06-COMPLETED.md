# Phase 6 — Tournament System + ELO Ranking (COMPLETE)

> **Date:** February 9, 2026
> **Phase:** 6 of 8
> **Status:** COMPLETE — Tournament.sol deployed, tested, and verified on Monad testnet

---

## Summary

Phase 6 implements a single-elimination bracket tournament system on top of the existing gaming arena infrastructure. Tournament.sol orchestrates multi-round tournaments with game type rotation (RPS → Poker → Auction), escalating stakes, and prize distribution. Combined with the ELO rating system from Phase 1, this provides a complete competitive ranking and tournament framework.

---

## What Was Completed

### Tournament.sol Smart Contract

**Deployed to Monad testnet:** `0xc152cA4E8d992a36cDf61fffc16c2Aa81afa8Aed`

Single-elimination bracket tournament contract that orchestrates matches across existing game contracts:

- **Tournament lifecycle:** Registration → Active → Complete/Cancelled
- **Player support:** 4 or 8 players per tournament
- **Entry fees:** Configurable per-tournament, pooled for prizes
- **Bracket generation:** Sequential seeding (1v4, 2v3 for 4-player)
- **Game type rotation:** Round 0=RPS, Round 1=Poker, Round 2=Auction (round % 3)
- **Escalating stakes:** `baseWager * 2^round` (doubles each round)
- **Result verification:** Validates escrow match is settled, participants match, correct game type
- **Prize distribution:** 60% winner, 25% runner-up, 7.5% each semifinalist
- **Cancel with refunds:** Full entry fee refund during registration phase

**Key design insight:** Tournament reads Escrow state but never calls settle() or updateELO() directly — game contracts handle that. So Tournament does NOT need authorization in Escrow/Registry.

### Test Suite — 22 Tests, All Passing

**Total test count: 124 tests (102 existing + 22 new)**

New Tournament tests cover:
- Tournament creation (4-player, 8-player, invalid player counts)
- Registration (entry fee locking, full rejection, wrong fee, duplicate prevention)
- Bracket generation (correct seeding, premature generation)
- Result reporting (valid settlement, wrong players, wrong game type)
- Round advancement (round 0 → round 1 → Complete)
- Full 4-player tournament (end-to-end with RPS + Poker)
- Prize distribution (correct 60/25/7.5/7.5 split, revert if not complete)
- Escalating stakes (baseWager * 2^round)
- Game type rotation (RPS/Poker/Auction cycle)
- Cancel tournament with refunds
- View functions (getParticipants, getMatchCountForRound)

### Deployment Script

`contracts/script/DeployTournament.s.sol` — follows existing pattern from DeployNewGames.s.sol. Reads all existing contract addresses from env, deploys Tournament, prints address.

### Python Integration

**contracts.py additions:**
- `TournamentStatus` enum class
- `TOURNAMENT_ADDRESS` from env
- `get_tournament()` lazy contract getter
- 12 wrapper functions: create, register, generateBracket, reportResult, distributePrizes, cancelTournament, getTournamentInfo, getParticipants, getBracketMatch, getRoundWager, getGameTypeForRound, getMatchCountForRound

**arena.py additions — 5 new commands:**
| Command | Description |
|---------|-------------|
| `tournaments` | List open tournaments (Registration or Active) |
| `create-tournament <fee> <wager> <n>` | Create a tournament (n=4 or 8) |
| `join-tournament <id>` | Register + lock entry fee; auto-generates bracket if full |
| `play-tournament <id>` | Find bracket match, play game, report result |
| `tournament-status <id>` | Show full bracket with results per round |

**bankroll.py addition:**
- `recommend_tournament_entry()` — evaluates tournament entry using expected cost/return analysis, recommends entry if positive EV and total cost < 20% of bankroll

### SKILL.md Updated

Tournament section added with:
- 5 command descriptions
- Tournament match flow (find → evaluate → join → play rounds → prizes)
- Contract address

### ELO Rating System (Verified from Phase 1)

The AgentRegistry ELO system continues working correctly:

- **Per-game-type ELO** — separate ratings for RPS, Poker, Auction
- **Updated after every match** — including tournament matches
- **On-chain and queryable** — `elo(address, GameType)` public mapping

---

## On-Chain Tournament Results

### Tournament #0 (4-Player, Monad Testnet)

| Round | Game | Wager | Match | Player 1 | Player 2 | Winner |
|-------|------|-------|-------|----------|----------|--------|
| 0 | RPS | 0.001 MON | 0 | Fighter (Seed 1) | Opponent 3 (Seed 4) | Fighter |
| 0 | RPS | 0.001 MON | 1 | Opponent 1 (Seed 2) | Opponent 2 (Seed 3) | Opponent 1 |
| 1 | Poker | 0.002 MON | 0 | Fighter | Opponent 1 | **Fighter** |

**Tournament Champion:** Fighter (`0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf`)
**Runner-Up:** Opponent 1 (`0xCD40Da7306672aa1151bA43ff479e93023e21e1f`)

**Prize Distribution (0.004 MON pool):**
- Winner (Fighter): 0.0024 MON (60%)
- Runner-Up (Opponent 1): 0.001 MON (25%)
- Semifinalist (Opponent 2): 0.0003 MON (7.5%)
- Semifinalist (Opponent 3): 0.0003 MON (7.5%)

---

## Deployed Contract Addresses

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x96728e0962d7B3fA3B1c632bf489004803C165cE` |
| Escrow | `0x16d9CD10c426B4c82d07E4f90B7fB7E02b2715Bc` |
| RPSGame | `0x2A622c1878335149c251Be32dE5660297609A12f` |
| PokerGame | `0x438962d9Bc693825EB4bd4a4e7E5B0fa0Ce895cB` |
| AuctionGame | `0x0D9024984658A49003e008C1379Ee872bdb74799` |
| **Tournament** | **`0xc152cA4E8d992a36cDf61fffc16c2Aa81afa8Aed`** |

---

## Gate Checklist

- [x] Tournament.sol compiles, tests pass (22 new tests, 124 total)
- [x] Deployed to Monad testnet (`0xc152cA4E8d992a36cDf61fffc16c2Aa81afa8Aed`)
- [x] ELO per-game working (RPS, Poker, Auction — updated after every match)
- [x] Tournament CLI commands work (5 commands: tournaments, create, join, play, status)
- [x] Full 4-player tournament completed on testnet with game rotation (RPS → Poker)
- [x] Prize distribution verified (60/25/7.5/7.5 split)
- [x] ELO changes visible after tournament matches
- [x] Match history queryable on-chain for all participants
- [x] Escalating stakes working (baseWager * 2^round)
- [x] Bracket seeding correct (1v4, 2v3)
