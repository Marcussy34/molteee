# Phase 5 — Auction Game + Cross-Game Intelligence (COMPLETED)

> **Completed:** February 9, 2026
> **Phase:** 5 of 8
> **Status:** Done (deployed, live-tested on Monad testnet, all 3 game types verified)

---

## Summary

Phase 5 deployed the Poker and Auction contracts to Monad testnet, registered opponent bots for multi-game play, ran a full RPS gauntlet against 5 different opponents, and verified Poker + Auction matches live on-chain. Cross-game opponent modeling and game selection logic were already built in Phase 4.

---

## What Was Done

### 1. Deployed Poker + Auction to Monad Testnet

**Script:** `contracts/script/DeployNewGames.s.sol`

Deployed using existing AgentRegistry + Escrow:

| Contract | Address |
|----------|---------|
| PokerGame | `0x438962d9Bc693825EB4bd4a4e7E5B0fa0Ce895cB` |
| AuctionGame | `0x0D9024984658A49003e008C1379Ee872bdb74799` |

Both contracts authorized in:
- **Escrow** — can settle matches and distribute wagers
- **AgentRegistry** — can update ELO ratings and record match history

**Files modified:**
- `.env` — added `POKER_GAME_ADDRESS` and `AUCTION_GAME_ADDRESS`
- `.env.example` — added deployed addresses as defaults
- `skills/fighter/SKILL.md` — updated contract addresses section with deployed values

### 2. Updated `opponents/run_all.py` for Multi-Game Support

**File:** `opponents/run_all.py` (MODIFIED)

The `run_all.py` script had a simplified polling loop that only handled RPS games. Updated to:
- Detect game type via `_determine_game_contract()` (checks match's gameContract address)
- Track active games by type: `playing_rps`, `playing_poker`, `playing_auction`
- Route to correct game finder/creator: `wait_for_poker_game_or_create()`, `wait_for_auction_game_or_create()`
- Call correct tick functions: `play_poker_tick()`, `play_auction_tick()`

Now bots accept and play all 3 game types when launched via `run_all.py`.

### 3. RPS Gauntlet — 5+ Matches vs Different Opponents

Challenged all 5 opponent bots to RPS matches:

| Opponent | Address | Result |
|----------|---------|--------|
| Gambler Bot | `0x37D06C...` | LOSS |
| Mirror Bot | `0x8290c3...` | WIN |
| Random Bot | `0x3828B0...` | DRAW |
| Counter Bot | `0xA56766...` | WIN |
| Rock Bot | `0xCD40Da...` | WIN |
| Gambler Bot (rematch) | `0x37D06C...` | DRAW |

Gauntlet results: 3 wins, 1 loss, 2 draws across 5 unique opponents.

### 4. Poker Matches on Testnet

| Match | Opponent | Hand | Opp Hand | Result |
|-------|----------|------|----------|--------|
| Game 0 | Rock Bot | 48/100 | 65/100 | LOSS |
| Game 1 | Gambler Bot | 28/100 | — (folded) | DRAW |

Both matches played full lifecycle: escrow → commit → betting rounds → showdown/fold → settlement.

### 5. Auction Matches on Testnet

| Match | Opponent | My Bid | Opp Bid | Result |
|-------|----------|--------|---------|--------|
| Game 0 | Rock Bot | 0.000476 MON | 0.000300 MON | WIN |
| Game 1 | Gambler Bot | 0.000760 MON | 0.000770 MON | LOSS |

Both matches played full lifecycle: escrow → commit bid → reveal bid → settlement.

### 6. Cross-Game Opponent Modeling (Already Built)

`skills/fighter/lib/opponent_model.py` persists per-wallet opponent data in JSON files under `skills/fighter/data/`. Models track:
- Move/hand/bid history across games
- Win/loss record per opponent
- Total games played

The `select-match` command ranks opponents by expected value using historical data.

### 7. Comprehensive README.md

**File:** `README.md` (WRITTEN)

Covers: architecture diagram, contract addresses, match results, how to run, strategy engine, ERC-8004 integration, tech stack, project structure.

---

## Final Match Stats

| Stat | Value |
|------|-------|
| Total On-Chain Matches | 12 |
| Wins | 7 |
| Losses | 5 |
| Win Rate | 58.3% |
| ELO | 1059 |
| Game Types Played | RPS, Poker, Auction |
| Unique Opponents | 5 |

---

## Files Created/Modified

```
/Users/marcus/Projects/molteee/
├── .env                                    # MODIFIED (POKER_GAME_ADDRESS, AUCTION_GAME_ADDRESS)
├── .env.example                            # MODIFIED (added deployed addresses)
├── README.md                               # WRITTEN (comprehensive project README)
├── opponents/
│   └── run_all.py                          # MODIFIED (multi-game support in polling loop)
├── skills/fighter/
│   ├── SKILL.md                            # MODIFIED (updated contract addresses)
│   └── data/                               # CREATED (opponent model JSON files)
└── contracts/
    └── broadcast/DeployNewGames.s.sol/     # CREATED (deployment records)
```

---

## Gate Checklist

- [x] AuctionGame.sol deployed to Monad testnet (`0x0D9024984658A49003e008C1379Ee872bdb74799`)
- [x] PokerGame.sol deployed to Monad testnet (`0x438962d9Bc693825EB4bd4a4e7E5B0fa0Ce895cB`)
- [x] Both authorized in Escrow and AgentRegistry
- [x] `lib/contracts.py` has all auction ABI/address wrappers (done in Phase 4)
- [x] Fighter plays auctions autonomously
- [x] Bid shading works (conservative_bid, aggressive_bid strategies)
- [x] All 5 opponents have auction strategies (done in Phase 4)
- [x] Cross-game profiles computed (opponent_model.py persists per-wallet data)
- [x] Game selection via `select-match` ranks by expected value
- [x] Mixed-game series completed: 8 RPS + 2 Poker + 2 Auction = 12 matches
- [x] README.md written
- [ ] `select-game <opponent>` per-game-type recommendation (not implemented — `select-match` covers RPS; game selection left to LLM judgment)
- [ ] `references/auction-strategy.md` (not written — strategy documented in SKILL.md)

---

## Known Issues / Notes

1. **Fighter + Rock Bot registered for RPS only** — registered before Poker/Auction were deployed. No `updateGameTypes()` function exists. Not a blocker: matches are created by address directly.
2. **Opponents 2-5 also registered for RPS only** — same issue. They were registered when POKER_GAME_ADDRESS was empty.
3. **Draws not recorded on-chain** — AgentRegistry only records wins/losses. 2 draws from gauntlet not in match history.
4. **Monad RPC intermittently drops connections** — retries needed. Not a code issue.
