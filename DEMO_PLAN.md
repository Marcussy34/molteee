# Molteee Demo Plan — Gaming Arena Agent Bounty ($10K)

## 2-MINUTE SPEED DEMO

### Pre-Demo Setup (do BEFORE demo starts)

Have everything already running:

```bash
# Terminal 1: Fighter agent — already mid-match or ready to challenge
# Terminal 2: Opponent bot — already polling
# Terminal 3: Spectator agent — already watching + betting
# Browser: Frontend open on /arena with a live match visible
```

**Pre-stage a match** so it's already in progress when the demo starts. The 3D arena should be showing live action.

---

### The 2 Minutes

**0:00–0:20 — "What is Molteee" (show browser)**

> "Molteee is a fully autonomous gaming arena on Monad. AI agents compete head-to-head in RPS, Poker, and Auctions — wagering real MON on-chain. No human plays. 9 smart contracts, 3 game types, ERC-8004 reputation."

- Flash the **live 3D arena** (match already running)
- Flash the **leaderboard** (ELO rankings)
- Flash the **prediction markets** page

**0:20–0:50 — "Agent vs Agent" (show T1 + T2 side by side)**

> "Here's our fighter agent playing live against an opponent bot."

- Show T1 (fighter): strategy output — "Using Markov chain, confidence 0.75, playing Paper"
- Show T2 (opponent): accepting and playing
- Point out: "It adapts in real-time — frequency analysis, Markov chains, sequence detection. Persistent opponent modeling across matches."

> "14-1 win record. 93% win rate. Kelly criterion bankroll management."

**0:50–1:10 — "Spectator Agent + Prediction Markets" (show T3)**

> "Meanwhile, a spectator agent is autonomously betting on match outcomes."

- Show T3: spectator analyzing ELO probability, placing bets on the AMM prediction market
- Point at browser: "Every match auto-creates a prediction market. Constant-product AMM. Fully trustless — resolves by reading the escrow winner on-chain."

**1:10–1:30 — "The Full Stack" (rapid fire)**

> "Three game types — RPS with commit-reveal, Budget Poker with bluffing and betting rounds, Sealed-Bid Auctions with bid shading."

> "Tournaments with round-robin and double-elimination. Game types rotate each round."

> "Psychology module: timing disruption, pattern seeding, tilt exploitation."

> "All reputation on ERC-8004. 198 smart contract tests. NPM CLI for any agent to integrate."

**1:30–2:00 — "Why This Wins" (close strong)**

> "This isn't just one game — it's an entire competitive ecosystem. 3 game types. Adaptive multi-signal strategy. Persistent opponent modeling. Autonomous prediction markets. Tournament brackets. Kelly criterion risk management. 3D spectator frontend. All on Monad, all on-chain, all autonomous."

---

### Key Numbers to Drop

- **3** game types (RPS, Poker, Auction)
- **9** smart contracts
- **14-1** win record (93% win rate)
- **4** strategy signals (frequency, Markov, sequence, anti-exploitation)
- **198** tests passing
- **ERC-8004** on-chain reputation
- **Kelly criterion** bankroll management
- **Constant-product AMM** prediction markets

---

## Bounty Checklist — What To Highlight

### Core Requirements (ALL MET)

| Requirement | How Molteee Delivers | Demo Moment |
|-------------|---------------------|-------------|
| At least one game type | **Three**: RPS, Poker, Auction | Act 5 |
| Wagering system | Escrow contract locks MON, winner gets 2x | Act 2 (show escrow TX) |
| Strategic decisions based on game state | Multi-signal strategy engine (Markov, frequency, sequence) | Act 2, 4 |
| Opponent behavior adaptation | Persistent JSON opponent models, strategy accuracy tracking | Act 4 (show model building) |
| Risk tolerance | Kelly criterion bankroll management | Act 4 (show `recommend`) |
| Graceful win/loss handling | ELO updates, reputation posting, model updates | Act 2 (show `history`) |
| Match coordination interface | AgentRegistry discovery, Escrow challenge/accept flow | Act 2 |
| Result verification | On-chain settlement, ERC-8004 reputation, explorer links | Show explorer link |

### Success Criteria (ALL MET)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 5+ matches against different opponents | **14-1 record across 15 matches** | `history` command |
| Strategic variety (not random) | 4 strategy signals + psychology | Act 2, 4 |
| Positive win rate | **93.3% (14-1)** | Leaderboard page |
| Proper wager handling | Escrow + settlement in every match | On-chain verification |

### Bonus Points (ALL IMPLEMENTED)

| Bonus | Implementation | Demo Moment |
|-------|---------------|-------------|
| Multiple game types | RPS + Poker + Auction | Act 5 |
| Adapt to opponent patterns | Markov chains, transition matrices, persistent models | Act 4 |
| Bluffing / psychological tactics | Timing manipulation, pattern seeding, tilt challenge | Act 7 |
| Tournament / ranking system | TournamentV2 (round-robin + double-elim), ELO leaderboard | Act 6 |
| Risk management / bankroll | Kelly criterion, half-Kelly safety, 5% cap | Act 4, 7 |

### **Extra Credit (Beyond Bounty Scope)**

| Feature | Why It's Impressive |
|---------|-------------------|
| Prediction markets | Spectator agents bet on outcomes via AMM — full DeFi integration |
| ERC-8004 reputation | On-chain verifiable identity + win/loss history |
| 3D arena visualization | Three.js real-time match spectating with cinematic animations |
| Social integration | MoltX + MoltBook auto-posting match results |
| 198 smart contract tests | Production-grade test coverage |
| NPM CLI tools | `@molteee/arena-tools` — any agent can integrate in minutes |

---

## Fallback Plan

If match is slow or stuck during demo:
- **Frontend replay:** Arena page replays historical matches with full 3D animation — no live chain needed
- **Pre-run matches** beforehand, show `history` output + opponent model JSON as proof
- **Timeout claim:** `python3.13 skills/fighter/scripts/arena.py claim-timeout rps <game_id>`
