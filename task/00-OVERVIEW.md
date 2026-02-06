# Task 00 — Master Plan & Dependency Graph

> **DISCLAIMER:** Before starting any phase, reference official and up-to-date documentation for all tools, frameworks, and APIs (OpenClaw, Foundry, Monad, web3.py). Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Project Summary

**Gaming Arena Agent** — An autonomous OpenClaw agent that competes across three game types (RPS, Poker, Blind Auction) on Monad testnet, using adaptive strategy, bluffing, negotiation, psychological tactics, bankroll management, and tournament play. All matches are wagered in testnet MON, all transactions are on-chain, all driven by an LLM agent through OpenClaw skills.

**Hackathon:** Moltiverse by Nad.fun & Monad
**Bounty:** Gaming Arena Agent ($10,000)
**Chain:** Monad testnet (EVM-compatible L1)
**Agent Framework:** OpenClaw (LLM-powered autonomous agent runtime)

---

## Architecture: How OpenClaw Skills Work

OpenClaw is an **LLM-powered agent runtime**. It runs locally, connects to an LLM (Claude, GPT-4, etc.), and uses **skills** to teach the LLM what to do. Our project builds skills — NOT standalone applications.

### Skill = SKILL.md + Scripts

```
skills/fighter/
  SKILL.md                  # Manifest (YAML frontmatter) + LLM instructions (markdown)
  scripts/                  # Executable code the LLM calls via bash
    arena.py                # Main CLI dispatcher
    play_rps.py             # RPS commit-reveal flow
    play_poker.py           # Poker game flow
    play_auction.py         # Auction bid flow
    strategy.py             # Opponent modeling + strategy selection
    bankroll.py             # Kelly criterion wager sizing
    registry.py             # AgentRegistry contract interaction
    escrow.py               # Escrow contract interaction
    tournament.py           # Tournament bracket navigation
    psychology.py           # Timing manipulation, pattern seeding
  lib/
    contracts.py            # Contract ABIs + Monad deployed addresses
    opponent_model.py       # Cross-game profiling data structures
    game_state.py           # Game state tracking + persistence
  references/
    rps-strategy.md         # Detailed RPS strategy docs for LLM
    poker-strategy.md       # Poker bluffing/betting docs
    auction-strategy.md     # Auction bidding docs
    bankroll-management.md  # Kelly criterion explanation
  config.json               # Monad RPC URL, wallet path, settings
  pyproject.toml            # Python dependencies (web3, etc.)
```

### How It Runs

1. **OpenClaw agent loop**: OpenClaw reads SKILL.md metadata, injects skill name + description into the LLM system prompt
2. **Skill invocation**: When the LLM decides to play games, it reads the full SKILL.md for instructions
3. **Script execution**: The LLM calls `python3 scripts/arena.py play rps <opponent> <wager>` via bash
4. **Scripts handle on-chain work**: Python scripts use web3.py to interact with Monad contracts directly
5. **Results returned to LLM**: Script output goes back to the LLM, which reasons about next actions

### Fighter vs. Opponents

- **Fighter Agent** = OpenClaw instance + Fighter Skill (LLM-powered, strategic, adaptive)
- **Opponent Agents** = Standalone Python scripts with hardcoded strategies (no LLM needed, just bots)
- Opponents run independently, listen for challenges, play with fixed strategies
- Only the fighter needs OpenClaw — opponents are simple automation

---

## Phase Overview

| Phase | Name | Key Output | Est. Days |
|-------|------|------------|-----------|
| 1 | Foundation & Environment | OpenClaw running, 3 core contracts deployed, skill scaffold ready | 1–2 |
| 2 | Basic Fighter Skill | Fighter skill completes 1 autonomous RPS match via OpenClaw | 1–2 |
| 3 | Opponents + RPS Strategy | 5 opponent bots deployed, fighter wins >50% in RPS | 1–2 |
| 4 | Poker | PokerGame contract + poker strategy scripts | 1–2 |
| 5 | Auction + Cross-Game Intel | AuctionGame contract + cross-game opponent profiling | 1–2 |
| 6 | Tournament + ELO | Tournament contract + ranking system | 1–2 |
| 7 | Demo & Polish | Psychological tactics, logging, demo video, submission | 1–2 |
| 8 | Bonus (Stretch) | Prediction market, spectator skill, advanced formats | If time |

---

## Dependency Graph

```
Phase 1: Foundation (OpenClaw + Contracts)
    └──▶ Phase 2: Basic Fighter Skill
             └──▶ Phase 3: Opponents + RPS Strategy
                      ├──▶ Phase 4: Poker
                      │        └──▶ Phase 5: Auction + Cross-Game
                      │                     └──▶ Phase 6: Tournament + ELO
                      │                                  └──▶ Phase 7: Demo & Polish
                      │                                               └──▶ Phase 8: Bonus
                      └──▶ (Phase 4 and 5 contract work can overlap;
                            agent-side cross-game profiling is sequential)
```

**Linear critical path:** 1 → 2 → 3 → 4 → 5 → 6 → 7

---

## Critical Path (Minimum Viable Submission)

| Must Have | Phase |
|-----------|-------|
| OpenClaw running with fighter skill | Phase 1–2 |
| Core contracts (Registry, Escrow, RPS) deployed on Monad | Phase 1 |
| Agent completes autonomous matches via OpenClaw | Phase 2 |
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

- [ ] OpenClaw instance running with fighter skill loaded
- [ ] All smart contracts deployed to Monad testnet
- [ ] Fighter agent registered on Agent Registry
- [ ] 5 opponent bots registered on Agent Registry
- [ ] 5+ matches completed autonomously via OpenClaw
- [ ] Demo video recorded showing full match sequence
- [ ] README with setup, architecture, and run instructions
- [ ] All tx hashes documented and verifiable on block explorer
- [ ] Submitted on moltiverse.dev
- [ ] Code pushed to repository
- [ ] Moltbook integration working (if applicable)

---

## Smart Contracts (7 Total, Solidity + Foundry)

| Contract | Phase | Purpose |
|----------|-------|---------|
| AgentRegistry.sol | 1 | Registration, discovery, ELO ratings, match history |
| Escrow.sol | 1 | Wager locking and payout (shared across all games) |
| RPSGame.sol | 1 | Commit-reveal Rock-Paper-Scissors + ERC-8004 reputation feedback |
| interfaces/IReputationRegistry.sol | 1 | ERC-8004 Reputation Registry interface |
| interfaces/IIdentityRegistry.sol | 1 | ERC-8004 Identity Registry interface |
| PokerGame.sol | 4 | Simplified heads-up poker with betting rounds |
| AuctionGame.sol | 5 | Sealed-bid blind auction |
| Tournament.sol | 6 | Bracket tournaments with game rotation |
| PredictionMarket.sol | 8 | Bonus: spectator betting AMM |

### Deployed Addresses (Monad Testnet, v2 — with ERC-8004)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x96728e0962d7B3fA3B1c632bf489004803C165cE` |
| Escrow | `0x16d9CD10c426B4c82d07E4f90B7fB7E02b2715Bc` |
| RPSGame | `0x2A622c1878335149c251Be32dE5660297609A12f` |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (singleton) |
| ERC-8004 Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` (singleton) |

---

## Agent Skills (OpenClaw)

| Skill | Type | Phase | Purpose |
|-------|------|-------|---------|
| Fighter Skill | OpenClaw skill (SKILL.md + Python scripts) | 2–7 | Core deliverable — LLM-driven matchmaking, strategy, bankroll |
| Opponent Bots (×5) | Standalone Python scripts (no LLM) | 3 | Rock, Gambler, Mirror, Random, Counter |
| Spectator Skill | OpenClaw skill | 8 | Bonus: prediction market bettor |

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Smart Contracts | Solidity + Foundry | Monad is EVM-compatible, proven patterns |
| Agent Identity | ERC-8004 Standard | On-chain identity + reputation via deployed registries |
| Agent Runtime | OpenClaw | Hackathon ecosystem — LLM-powered agent loop |
| Fighter Skill Scripts | Python + web3.py | Proven pattern for blockchain OpenClaw skills (PolyClaw model) |
| Agent Registration | TypeScript + ethers.js | ERC-8004 registration script in agent/ directory |
| Opponent Bots | Python + web3.py | Simple standalone scripts, no LLM needed |
| Chain | Monad Testnet | Hackathon chain |
| Currency | Testnet MON | Claimed from Monad faucet |
| Demo | OpenClaw chat output + terminal logs | Strategy reasoning visible in agent output |

---

## Phase Documents

- [Phase 1: Foundation & Environment](./01-FOUNDATION.md)
- [Phase 2: Basic Fighter Skill](./02-BASIC-AGENT.md)
- [Phase 3: Opponents + RPS Strategy](./03-OPPONENTS-AND-STRATEGY.md)
- [Phase 4: Poker](./04-POKER.md)
- [Phase 5: Auction + Cross-Game Intelligence](./05-AUCTION-AND-CROSS-GAME.md)
- [Phase 6: Tournament + ELO](./06-TOURNAMENT-AND-RANKING.md)
- [Phase 7: Demo & Polish](./07-DEMO-AND-POLISH.md)
- [Phase 8: Bonus (Stretch Goals)](./08-BONUS.md)
