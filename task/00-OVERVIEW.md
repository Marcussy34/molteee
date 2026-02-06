# Task 00 — Master Plan & Dependency Graph

> **DISCLAIMER:** Before starting any phase, reference official and up-to-date documentation for all tools, frameworks, and APIs (OpenClaw, Foundry, Monad, ethers.js). Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Project Summary

**Gaming Arena Agent** — An autonomous OpenClaw agent that competes across three game types (RPS, Poker, Blind Auction) on Monad testnet, using adaptive strategy, bluffing, negotiation, psychological tactics, bankroll management, and tournament play. All matches are wagered in testnet MON, all transactions are on-chain, all without human intervention.

**Hackathon:** Moltiverse by Nad.fun & Monad
**Bounty:** Gaming Arena Agent ($10,000)
**Chain:** Monad testnet (EVM-compatible L1)
**Agent Framework:** OpenClaw

---

## Phase Overview

| Phase | Name | Key Output | Est. Days |
|-------|------|------------|-----------|
| 1 | Foundation & Environment | 3 core contracts deployed, Foundry + OpenClaw ready | 1–2 |
| 2 | Basic Fighter Agent | Agent completes 1 autonomous RPS match | 1–2 |
| 3 | Opponents + RPS Strategy | 5 opponents deployed, fighter wins >50% in RPS | 1–2 |
| 4 | Poker | PokerGame contract + bluffing strategy module | 1–2 |
| 5 | Auction + Cross-Game Intel | AuctionGame contract + cross-game opponent profiling | 1–2 |
| 6 | Tournament + ELO | Tournament contract + ranking system | 1–2 |
| 7 | Demo & Polish | Psychological tactics, logging, demo video, submission | 1–2 |
| 8 | Bonus (Stretch) | Prediction market, spectator skill, advanced formats | If time |

---

## Dependency Graph

```
Phase 1: Foundation
    └──▶ Phase 2: Basic Agent
             └──▶ Phase 3: Opponents + RPS Strategy
                      ├──▶ Phase 4: Poker
                      │        └──▶ Phase 5: Auction + Cross-Game
                      │                     └──▶ Phase 6: Tournament + ELO
                      │                                  └──▶ Phase 7: Demo & Polish
                      │                                               └──▶ Phase 8: Bonus
                      └──▶ (Phase 4 and 5 can run in parallel if contracts are independent)
```

**Linear critical path:** 1 → 2 → 3 → 4 → 5 → 6 → 7

**Parallelizable:** Phases 4 (Poker) and 5 (Auction) contract work can overlap if both depend only on Phase 3 outputs. Cross-game profiling in Phase 5 requires Phase 4 poker data though, so the agent-side work is sequential.

---

## Critical Path (Minimum Viable Submission)

A submission that hits ALL core requirements and most bonus points:

| Must Have | Phase |
|-----------|-------|
| Core contracts (Registry, Escrow, RPS) deployed on Monad | Phase 1 |
| Agent completes autonomous matches | Phase 2 |
| 5+ matches against different opponents | Phase 3 |
| Adaptive strategy with positive win rate | Phase 3 |
| Proper wager handling via escrow | Phase 1–2 |

| Should Have (Bonus Points) | Phase |
|----------------------------|-------|
| Multiple game types (Poker, Auction) | Phase 4–5 |
| Bluffing, negotiation, psychological play | Phase 4–5, 7 |
| Cross-game opponent modeling | Phase 5 |
| Tournament or ranking system | Phase 6 |
| Bankroll optimization (Kelly criterion) | Phase 3 |

**Minimum submission = Phases 1 + 2 + 3 + 7 (demo/polish)**

---

## Success Metrics (Aligned to Hackathon Judging)

| Metric | Target | Judging Criteria |
|--------|--------|------------------|
| Autonomous matches completed | 5+ against distinct opponents | Core requirement |
| Win rate across all games | > 50% overall | Success criterion |
| Game types supported | 3 (RPS, Poker, Auction) | Bonus: multiple game types |
| Bluffing demonstrated on-chain | At least 2 successful poker bluffs | Bonus: bluffing/negotiation |
| Bankroll growth | Positive over demo run | Success criterion |
| ELO rating climb | Visible increase during demo | Bonus: ranking system |
| Tournament completed | 1 full bracket (4+ agents) | Bonus: tournament system |
| On-chain verifiability | All tx hashes logged and browsable | Core requirement |
| Cross-game adaptation | Agent selects game type strategically | Bonus: meta-game learning |
| Psychological tactics visible | Timing variation, tilt exploitation in logs | Bonus: psychological play |

---

## Submission Checklist

- [ ] All smart contracts deployed to Monad testnet
- [ ] Fighter agent registered on Agent Registry
- [ ] 5 opponent agents registered on Agent Registry
- [ ] 5+ matches completed autonomously
- [ ] Demo video recorded showing full match sequence
- [ ] README with setup, architecture, and run instructions
- [ ] All tx hashes documented and verifiable on block explorer
- [ ] Submitted on moltiverse.dev
- [ ] Code pushed to repository
- [ ] Moltbook integration working (if applicable)

---

## Smart Contracts (7 Total)

| Contract | Phase | Purpose |
|----------|-------|---------|
| AgentRegistry.sol | 1 | Registration, discovery, ELO ratings, match history |
| Escrow.sol | 1 | Wager locking and payout (shared across all games) |
| RPSGame.sol | 1 | Commit-reveal Rock-Paper-Scissors |
| PokerGame.sol | 4 | Simplified heads-up poker with betting rounds |
| AuctionGame.sol | 5 | Sealed-bid blind auction |
| Tournament.sol | 6 | Bracket tournaments with game rotation |
| PredictionMarket.sol | 8 | Bonus: spectator betting AMM |

---

## Agent Skills (OpenClaw, TypeScript)

| Skill | Phase | Purpose |
|-------|-------|---------|
| Fighter Skill | 2–7 | Core deliverable — matchmaking, strategy, bankroll |
| Opponent Skills (×5) | 3 | Rock, Gambler, Mirror, Random, Counter |
| Spectator Skill | 8 | Bonus: prediction market bettor |

---

## Phase Documents

- [Phase 1: Foundation & Environment](./01-FOUNDATION.md)
- [Phase 2: Basic Fighter Agent](./02-BASIC-AGENT.md)
- [Phase 3: Opponents + RPS Strategy](./03-OPPONENTS-AND-STRATEGY.md)
- [Phase 4: Poker](./04-POKER.md)
- [Phase 5: Auction + Cross-Game Intelligence](./05-AUCTION-AND-CROSS-GAME.md)
- [Phase 6: Tournament + ELO](./06-TOURNAMENT-AND-RANKING.md)
- [Phase 7: Demo & Polish](./07-DEMO-AND-POLISH.md)
- [Phase 8: Bonus (Stretch Goals)](./08-BONUS.md)
