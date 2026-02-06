# Gaming Arena Agent — Moltiverse Hackathon

## One-Liner

An OpenClaw agent that competes against other agents in on-chain Rock-Paper-Scissors with real MON wagers on Monad, demonstrating adaptive strategy and bankroll management.

---

## Context: The Hackathon

- **Hackathon:** Moltiverse by Nad.fun & Monad
- **Prize Pool:** $200K total, up to 16 winners at $10K each
- **Track:** Agent Track (no token launch required)
- **Bounty:** Gaming Arena Agent ($10,000)
- **Chain:** Monad testnet (EVM-compatible L1, high throughput, low gas)
- **Agent Framework:** OpenClaw (open-source autonomous AI agent framework)
- **Currency:** Testnet MON (Monad's native token, claimed from faucet, no real monetary value)

### What Judges Want

The hackathon mod stated: "We want to see innovative, high-quality projects that are focused around empowering agents to use Monad as a financial coordination layer. Either an agentic world powered by Monad and/or agents that engage other agents using MON as a medium."

The judges want to see agents transacting with agents autonomously on Monad. The game is the vehicle. The financial coordination is the point.

---

## Bounty Requirements

### Objective

Build an agent that competes against other agents in games with real token wagers, demonstrating strategic thinking and adaptive gameplay.

### Core Requirements

1. Implement at least one game type (we are doing Rock-Paper-Scissors)
2. Enable wagering system where agents bet tokens on match outcomes
3. Make strategic decisions based on game state, opponent behavior, and risk tolerance
4. Handle wins/losses gracefully and manage token bankroll
5. Provide clear interface for match coordination and result verification

### Success Criteria

1. Successfully complete at least 5 matches against different opponents
2. Demonstrate strategic variety (not random play)
3. Maintain positive or neutral win rate over multiple games
4. Implement proper wager handling and payout mechanics

### Bonus Points

- Support multiple game types
- Adapt strategy based on opponent patterns (learning/meta-game)
- Implement bluffing, negotiation, or psychological tactics
- Create tournament or ranking system
- Develop risk management strategy for bankroll optimization

---

## What We Are Building

### The Fighter Agent (Core Deliverable)

We are building a **fighter agent** — not an arena host, not a platform. Our agent is the one sitting at the table, placing wagers, and playing to win. It:

1. **Registers itself** on an on-chain Agent Registry contract on Monad testnet
2. **Discovers opponents** by scanning the registry for other registered fighters with open challenges
3. **Evaluates whether to accept a challenge** based on its current bankroll, the wager amount, and the opponent's historical win/loss record
4. **Locks MON into escrow** via a smart contract when a match begins
5. **Plays Rock-Paper-Scissors** using on-chain commit-reveal (commit hash of move + salt, then reveal after opponent commits)
6. **Adapts its strategy** based on opponent pattern recognition across rounds and matches
7. **Manages its bankroll** using Kelly criterion to size wagers optimally
8. **Collects winnings or handles losses** gracefully, then moves on to the next match

### The 5 Opponent Agents (For Demo Purposes)

We build and deploy 5 opponent agents ourselves, each with a distinct strategy. This satisfies the "5 matches against different opponents" requirement. These are simpler agents — they exist to demonstrate that our main fighter recognizes and adapts to different play styles.

1. **The Rock** — Conservative. Heavily favors one move. Small wagers. Exploitable.
2. **The Gambler** — Aggressive. Random moves but bets big. High variance.
3. **The Mirror** — Tit-for-tat. Copies the opponent's last move.
4. **The Random** — Pure random baseline. Proves our agent beats randomness over time.
5. **The Counter** — Tracks opponent move frequency and plays the statistical counter.

### Bonus: Prediction Market (If Time Allows)

On top of the core fighter, we add a prediction market that auto-deploys for each live match. Spectator agents can bet on the outcome in real-time as rounds progress. This creates a layered economy: fighters wager on themselves, spectators wager on fighters, and MON flows through the system. This is NOT the core deliverable — it is the differentiator that elevates the submission beyond the base bounty requirements.

---

## Architecture

### Smart Contracts (Solidity, deployed on Monad testnet)

All contracts are written in Solidity and deployed using Foundry. Monad is EVM-compatible at the bytecode level, so standard Solidity patterns, OpenZeppelin libraries, and EVM tooling all work.

#### 1. Agent Registry

- Fighters register themselves with: wallet address, supported game types, min/max wager range, open-to-challenge flag
- Stores win/loss record per agent
- Any agent can query the registry to find opponents
- Agents can update their status (open/closed to challenges)

#### 2. Escrow Contract

- When two agents agree to a match, both send their wager amount in MON to this contract
- Funds are locked until the match resolves
- On match completion, the contract distributes funds: winner gets both wagers minus a small protocol fee (optional)
- Handles edge cases: timeout if an agent disappears mid-match, draw returns funds to both

#### 3. RPS Game Contract

- Implements commit-reveal Rock-Paper-Scissors
- **Commit phase:** Both players submit `keccak256(move + salt)` within a time window
- **Reveal phase:** Both players reveal their move and salt. Contract verifies the hash matches.
- **Resolution:** Contract determines winner (rock > scissors > paper > rock), calls escrow to distribute funds, updates registry with win/loss
- Supports best-of-1, best-of-3, or best-of-N rounds per match
- Enforces timeouts: if a player doesn't commit or reveal within the window, they forfeit

#### 4. Prediction Market AMM (Bonus)

- Auto-deploys a binary outcome market when a match starts ("Will Player A win?")
- Uses a simple constant-product or LMSR automated market maker
- Spectator agents buy/sell outcome tokens with MON
- Market resolves automatically when the match resolves
- Winning outcome token holders are paid out proportionally

### Agent Layer (OpenClaw Skills, TypeScript)

All agent logic is packaged as OpenClaw skills so any OpenClaw agent can install them.

#### Fighter Skill (Core)

This is the main deliverable. An OpenClaw skill that gives any agent the ability to:

- Connect to Monad testnet via ethers.js
- Register on the Agent Registry
- Scan for open challenges and evaluate them
- Accept or issue challenges with a specified wager
- Play RPS matches via commit-reveal
- Track opponent history and adapt strategy
- Manage bankroll and size wagers

**Strategy Engine (inside the Fighter Skill):**

- **Opponent Modeling:** Store every move an opponent has made across all matches. Build a frequency table (how often they play rock/paper/scissors). Detect sequences (do they cycle R-P-S? do they repeat after winning?).
- **Pattern Recognition:** Use Markov chain analysis — given the opponent's last move (or last N moves), what's the probability of their next move? Play the counter to the most likely move.
- **Adaptive Selection:** If an opponent appears random (uniform distribution), play randomly. If an opponent is exploitable (skewed distribution), exploit them. Detect strategy shifts mid-match and re-evaluate.
- **Bankroll Management:** Use Kelly criterion — given our estimated win probability against this opponent and the wager size, how much should we bet? Never risk more than a fraction of total bankroll on a single match. Decline challenges that exceed our risk tolerance.
- **Match Selection:** When multiple opponents are available, pick the one with the best expected value (highest estimated win probability × wager size, adjusted for confidence in our model of them).

#### Opponent Skills (5 variants)

Simpler skills, each implementing a fixed strategy. These are deployed as separate OpenClaw agents on separate wallets. They register on the registry and accept challenges. Their strategies are hardcoded and do not adapt — they exist to be exploited (or not) by our main fighter.

#### Spectator Skill (Bonus)

An OpenClaw skill that:

- Watches for new matches on-chain (event listeners)
- Reads live game state (who's playing, round results so far, registry history of both players)
- Estimates the probability of each player winning
- Places bets on the prediction market AMM
- Collects winnings after match resolution

---

## Tech Stack

| Component | Technology | Why |
|---|---|---|
| Smart Contracts | Solidity | Monad is EVM-compatible, standard patterns work |
| Contract Dev/Test | Foundry (forge, cast, anvil) | Fast, Solidity-native testing, easy deployment |
| Agent Runtime | OpenClaw | Required by hackathon ecosystem, skill-based architecture |
| Agent Logic / Skills | TypeScript | OpenClaw skills are TypeScript, type safety across ABIs |
| Blockchain Interaction | ethers.js | Standard EVM library, works with Monad's JSON-RPC |
| Chain | Monad Testnet | Hackathon chain, high throughput, low gas |
| Currency | Testnet MON | Claimed from Monad faucet, no real value |
| Demo Dashboard | Simple React app or terminal logs | Visualize matches, bankroll, strategy decisions |

---

## On-Chain Game Flow (Single Match)

1. **Discovery:** Our agent scans the Agent Registry, finds an opponent with an open challenge in its wager range
2. **Challenge:** Our agent calls the challenge function on the Escrow contract, locking its wager in MON
3. **Acceptance:** The opponent agent sees the challenge event, evaluates it, and locks their matching wager
4. **Round Start — Commit Phase:** Both agents choose a move (rock/paper/scissors), hash it with a random salt, and submit the hash to the RPS Game Contract. There is a time window (e.g., 60 seconds) to commit.
5. **Round Start — Reveal Phase:** After both commitments are on-chain, both agents reveal their move + salt. The contract verifies hashes match. Time window for reveal (e.g., 60 seconds). If one player doesn't reveal, they forfeit.
6. **Round Resolution:** Contract compares moves, determines round winner, emits an event with the result.
7. **Repeat for N rounds** (if best-of-3 or best-of-N)
8. **Match Resolution:** Contract determines overall winner, calls Escrow to release funds to the winner, updates the Agent Registry with new win/loss records for both players.
9. **Our agent updates its internal model** of this opponent and moves on to the next match.

---

## What The Demo Looks Like

The demo shows our agent autonomously playing 5+ matches on Monad testnet against 5 different opponents and growing its bankroll.

### What the judges see:

1. Our agent starts with X testnet MON
2. It scans the registry, finds Opponent 1 (The Rock — conservative, predictable)
3. It plays a match, detects the pattern quickly, exploits it, wins
4. It evaluates Opponent 2 (The Gambler — aggressive, high wager), decides the risk is acceptable based on bankroll
5. It plays, adapts to randomness, doesn't over-commit, wins or keeps losses small
6. It plays Opponents 3, 4, 5 — each time demonstrating different adaptive behavior
7. At the end: bankroll is larger than starting, win rate is positive, on-chain tx history proves every wager and payout

### What demonstrates "not random play":

- Against The Rock (predictable), our agent converges on the counter-move quickly — win rate climbs sharply
- Against The Mirror (tit-for-tat), our agent detects the pattern and exploits it by leading with the counter to its own previous move
- Against The Random, our agent recognizes there's no pattern, plays conservatively, and bets small — risk management, not exploitation
- Against The Counter, our agent detects that the opponent is countering its own frequency and shifts to a mixed strategy to become unpredictable
- Wager sizes vary across matches — bigger bets against exploitable opponents, smaller bets against uncertain ones

### On-chain proof:

- Every match has a chain of transactions: challenge → accept → commit → reveal → resolution → payout
- All visible on Monad testnet block explorer
- Agent Registry shows updated win/loss records for all agents

---

## Build Phases

### Phase 1: Foundation (Days 1-2)
- Set up OpenClaw locally, understand the skill system
- Set up Monad testnet wallet, claim testnet MON from faucet
- Write and deploy core Solidity contracts with Foundry: Agent Registry, Escrow, RPS Game
- Test contracts manually with Foundry scripts (forge script) to verify the full on-chain flow

### Phase 2: Basic Agent (Days 3-4)
- Build the Fighter Skill for OpenClaw — minimal version that can play one match
- Connect to Monad via ethers.js inside the skill
- Register on registry, accept a challenge, commit a move, reveal, collect payout
- Get one full match working end-to-end autonomously (agent vs one dummy opponent)
- This is the hardest integration step — once one match works, everything else is iteration

### Phase 3: Opponents (Day 5)
- Build 5 opponent OpenClaw agents with hardcoded strategies
- Deploy each on a separate wallet
- Register all on the Agent Registry with open challenges
- Verify each can play a full match against a basic challenger

### Phase 4: Make It Smart (Days 6-8)
- Add opponent modeling (move history tracking, frequency analysis, Markov chains)
- Add adaptive strategy selection (exploit predictable opponents, play mixed strategy against random ones)
- Add bankroll management (Kelly criterion for wager sizing)
- Add match selection logic (pick most profitable opponent from registry)
- Run the full 5+ match gauntlet on Monad testnet
- Tune strategy parameters until win rate is consistently positive

### Phase 5: Polish and Demo (Days 9-10)
- Build dashboard or logging output showing: opponent, strategy used, bankroll changes, tx hashes
- Integrate with Moltbook (agent posts match results)
- Record the demo video
- Write submission docs
- Submit to moltiverse.dev

### Phase 6: Bonus (Days 11+)
- Prediction Market AMM contract
- Spectator Skill
- Second game type (poker or auction)
- Tournament bracket system

---

## Key Technical Decisions

### Why Rock-Paper-Scissors First
- Simplest game to implement on-chain with commit-reveal
- Simultaneous moves map perfectly to commit-reveal pattern
- Strategy space is rich enough to demonstrate adaptation (see: Iocaine Powder, which won multiple RPS programming competitions using opponent modeling)
- Fast matches — a best-of-5 RPS match takes 5 rounds, not hours
- Easy to explain to judges in a demo

### Why Commit-Reveal
- On a public blockchain, if you submit your move in plaintext, the opponent can see it and counter it before submitting theirs
- Commit-reveal solves this: you commit a hash of (move + random salt), opponent can't reverse the hash to see your move
- After both commit, both reveal — the contract verifies the hash and resolves the round
- Standard pattern in blockchain game theory, well-understood

### Why Kelly Criterion for Bankroll
- Kelly criterion gives the mathematically optimal bet size given your estimated edge (win probability - loss probability)
- Prevents ruin: even with a positive edge, betting too much leads to eventual bankruptcy through variance
- Demonstrates sophisticated risk management to judges
- Simple formula: f* = (bp - q) / b, where b = net odds, p = win probability, q = loss probability

### Why OpenClaw Skills
- The Moltiverse hackathon is built around the OpenClaw ecosystem
- Packaging as skills means any OpenClaw agent can install and use our fighter
- More composable than standalone bots
- Visible to the 1.6M+ agents on Moltbook ecosystem
- Aligns with what judges want: agents engaging agents

---

## File Structure (Expected)

```
gaming-arena-agent/
├── contracts/                    # Solidity smart contracts
│   ├── src/
│   │   ├── AgentRegistry.sol     # Fighter registration and discovery
│   │   ├── Escrow.sol            # Wager locking and payout
│   │   ├── RPSGame.sol           # Rock-Paper-Scissors commit-reveal logic
│   │   └── PredictionMarket.sol  # Bonus: AMM for spectator bets
│   ├── test/                     # Foundry tests for all contracts
│   ├── script/                   # Deployment and interaction scripts
│   └── foundry.toml              # Foundry config pointing to Monad testnet
├── skills/                       # OpenClaw skills
│   ├── fighter/                  # Main fighter skill (core deliverable)
│   │   ├── index.ts              # Skill entry point
│   │   ├── strategy.ts           # Opponent modeling, pattern recognition, adaptation
│   │   ├── bankroll.ts           # Kelly criterion, wager sizing, risk management
│   │   ├── matchmaker.ts         # Registry scanning, opponent evaluation, challenge logic
│   │   └── game.ts               # RPS move selection, commit-reveal interaction
│   ├── opponents/                # 5 opponent strategy variants
│   │   ├── rock.ts               # Conservative / predictable
│   │   ├── gambler.ts            # Aggressive / random / big bets
│   │   ├── mirror.ts             # Tit-for-tat
│   │   ├── random.ts             # Pure random baseline
│   │   └── counter.ts            # Frequency counter
│   └── spectator/                # Bonus: prediction market bettor
│       └── index.ts
├── dashboard/                    # Simple UI or terminal logger for demo
├── PROJECT.md                    # This file
└── README.md                     # Setup and run instructions
```

---

## Success Definition

The project is successful if a judge can watch the demo and see:

1. An autonomous agent discovering opponents on Monad testnet
2. The agent wagering real testnet MON via on-chain escrow
3. The agent playing RPS with commit-reveal — no cheating possible
4. The agent adapting its strategy visibly across different opponents
5. The agent's bankroll growing over 5+ matches
6. All transactions verifiable on-chain

That's the bounty. Everything else is bonus.
