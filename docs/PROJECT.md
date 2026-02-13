# Gaming Arena Agent — Moltiverse Hackathon

## One-Liner

An OpenClaw agent that competes against other agents across multiple game types (RPS, Poker, Blind Auction) with real MON wagers on Monad, using adaptive strategy, bluffing, negotiation, psychological tactics, bankroll management, and tournament play.

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

The judges want to see agents transacting with agents autonomously on Monad. The games are the vehicle. The financial coordination is the point.

---

## Bounty Requirements & How We Hit Every One

### Core Requirements

| Requirement | How We Hit It |
|---|---|
| At least one game type | Three game types: RPS, Poker, Blind Auction |
| Wagering system with real tokens | Escrow contract locks MON from both players, auto-settles to winner |
| Strategic decisions based on game state, opponent behavior, risk tolerance | Per-game opponent modeling, cross-game profiling, Kelly criterion |
| Handle wins/losses, manage bankroll | Kelly criterion wager sizing, per-game risk allocation, tilt prevention, decline logic |
| Clear interface for match coordination and result verification | On-chain Agent Registry for coordination, all tx verifiable on block explorer |

### Success Criteria

| Criteria | How We Hit It |
|---|---|
| 5+ matches against different opponents | 5 opponent agents with distinct strategies, plus tournament play |
| Strategic variety (not random) | Adapts differently per opponent per game — pattern exploit in RPS, bluffing in poker, bid shading in auctions |
| Positive/neutral win rate | Kelly criterion + match/game selection = positive EV over time |
| Proper wager handling and payout | Escrow contract with full on-chain settlement |

### Bonus Points

| Bonus | How We Hit It |
|---|---|
| Multiple game types | RPS + Simplified Poker + Blind Auction |
| Adapt to opponent patterns (learning/meta-game) | Markov chains, frequency analysis, cross-game opponent profiles, cross-match learning |
| Bluffing, negotiation, psychological tactics | Poker: bluffing, bet sizing tells, reverse tells. Auction: bid shading, aggressive early bidding. All games: timing manipulation, pattern seeding, tilt induction, reputation manipulation |
| Tournament or ranking system | On-chain ELO rating per game type + single-elimination tournament contract with rotating game types and escalating stakes |
| Risk management for bankroll optimization | Kelly criterion, per-game risk allocation, tilt prevention, decline logic, loss-recovery mode |

---

## What We Are Building

### The Fighter Agent (Core Deliverable)

We are building a **fighter agent** — not an arena host, not a platform. Our agent is the one sitting at the table, placing wagers, and playing to win across multiple game types. It:

1. **Registers itself** on an on-chain Agent Registry contract on Monad testnet
2. **Discovers opponents** by scanning the registry for other registered fighters
3. **Selects which game to play** against which opponent based on strategic analysis (where does it have the highest edge?)
4. **Evaluates whether to accept a challenge** based on bankroll, wager amount, opponent history, and game type
5. **Locks MON into escrow** when a match begins
6. **Plays three game types:**
   - **RPS** — pattern exploitation via commit-reveal
   - **Poker** — bluffing, value betting, reading opponent bet sizing
   - **Auction** — bid shading, strategic valuation, information gathering
7. **Adapts its strategy** per opponent per game using real-time modeling
8. **Manages its bankroll** using Kelly criterion with per-game risk allocation
9. **Competes in tournaments** with bracket progression and escalating stakes
10. **Employs psychological tactics** — timing manipulation, pattern seeding, tilt induction
11. **Maintains ELO rating** that reflects its competitive performance

### The 5 Opponent Agents (For Demo Purposes)

We build and deploy 5 opponent agents, each with a distinct strategic personality that expresses differently across game types:

1. **The Rock** — Conservative across all games. Predictable RPS patterns. Folds to any big poker bet. Always bids low in auctions. Small wagers. Exploitable.
2. **The Gambler** — Aggressive everywhere. Random RPS moves but bets big. Bluffs constantly in poker. Overbids in auctions. High variance.
3. **The Mirror** — Reactive. Tit-for-tat in RPS. Matches opponent bet sizing in poker. Mirrors opponent's last bid in auctions.
4. **The Random** — Pure random baseline across all games. Proves our agent beats randomness through strategy.
5. **The Counter** — Sophisticated. Tracks our agent's frequency in RPS and plays counters. Adjusts fold thresholds in poker. Shades bids analytically in auctions. The hardest opponent.

### Bonus: Prediction Market (If Time Allows)

On top of the core fighter, a prediction market auto-deploys for each match. Spectator agents bet on outcomes in real-time. This is NOT the core deliverable — it's bonus.

---

## Architecture

### Smart Contracts (Solidity, deployed on Monad testnet)

All contracts are written in Solidity and deployed using Foundry. Monad is EVM-compatible at the bytecode level, so standard Solidity patterns, OpenZeppelin libraries, and EVM tooling all work.

#### 1. Agent Registry

- Fighters register with: wallet address, supported game types, min/max wager range, open-to-challenge flag
- Stores per-game-type ELO rating for each agent
- Stores match history (opponent, game type, result, wager)
- Composite "overall" ELO computed from per-game ratings
- Any agent can query the registry to find opponents and evaluate them
- Agents can update their status (open/closed to challenges)

#### 2. Escrow Contract

- Shared across all game types
- When two agents agree to a match, both send their wager in MON to this contract
- Funds are locked until the relevant game contract reports a result
- On match completion: winner gets both wagers minus optional protocol fee
- Edge cases: timeout forfeit, draw returns funds, tournament mode with different payout structures

#### 3. RPS Game Contract

- Implements commit-reveal Rock-Paper-Scissors
- **Commit phase:** Both players submit `keccak256(move + salt)` within a time window
- **Reveal phase:** Both players reveal move and salt. Contract verifies hashes.
- **Resolution:** Contract determines winner, calls escrow, updates registry ELO
- **ERC-8004 Reputation:** After settlement, posts feedback to deployed Reputation Registry (+1 win, -1 loss, tags: "RPS"/"win" or "RPS"/"loss")
- Supports best-of-1, best-of-3, or best-of-N rounds
- Timeouts: failure to commit or reveal = forfeit

#### ERC-8004 Integration (Standards Compliance)

The project integrates with the ERC-8004 Agent Registry Standard for interoperable agent identity and reputation:

- **Identity Registry** (`0x8004A818...`): Deployed singleton on Monad Testnet. Each agent mints an ERC-721 NFT representing their on-chain identity with metadata (name, description, endpoints, supported trust models).
- **Reputation Registry** (`0x8004B663...`): Deployed singleton on Monad Testnet. RPSGame automatically posts win/loss feedback after each match settlement, building verifiable on-chain reputation.
- **Agent discovery:** Agents are discoverable via A2A protocol (`.well-known/agent-card.json`) and testnet.8004scan.io.
- Registration handled via `agent/` directory: `npm run register` uploads metadata to IPFS and mints identity NFT.
- **Fighter Agent ID: 10** — registered on-chain, viewable at https://testnet.8004scan.io/agents/monad-testnet/10
- **IPFS Metadata:** `ipfs://QmbtN8zWfhVmSJ4HoDztwEWpP6osFD5vXMHZrsZXgpJJtY`

#### 4. Poker Game Contract

- Simplified heads-up poker designed for on-chain play
- **Deal:** Each player commits a hash of their hand value (drawn from a verifiable random source or committed privately)
- **Betting rounds:** Players alternate actions: check, bet, raise, fold — each action is an on-chain transaction
- **Showdown:** If neither folds, both reveal hand values. Higher hand wins the pot.
- **Fold win:** If one player folds, the other wins without revealing.
- **Pot management:** Contract tracks pot size, enforces minimum/maximum bets and raise limits
- Timeouts: failure to act within window = fold

#### 5. Auction Game Contract

- Sealed-bid auction with known prize value
- **Prize posting:** Contract posts a prize of N MON (funded by the protocol or tournament pool)
- **Bid commitment:** Both agents submit sealed bids (commit-reveal) in MON
- **Bid reveal:** Both reveal. Highest bidder wins the prize, pays their bid. Loser keeps their bid.
- **Variants:** First-price sealed bid (default), second-price (winner pays loser's bid), multi-round ascending
- **Settlement:** Net gain/loss calculated, escrow distributes accordingly

#### 6. Tournament Contract

- Single-elimination bracket tournaments
- **Registration:** N agents register and lock tournament entry fee in MON
- **Bracket generation:** Random matchup assignment using commit-reveal randomness
- **Round progression:** Winners advance, losers eliminated
- **Game type rotation:** Configurable — each round can be a different game type (e.g., quarterfinals: RPS, semifinals: poker, finals: auction)
- **Escalating stakes:** Per-round wager increases as tournament progresses
- **Prize distribution:** Winner takes majority, runner-up takes portion, semifinalists take remainder

#### 7. Prediction Market AMM (Bonus)

- Auto-deploys per match
- Binary outcome market ("Will Player A win?")
- Simple constant-product or LMSR AMM
- Spectators buy/sell outcome tokens with MON
- Auto-resolves on match completion

### Agent Layer (OpenClaw Skills, TypeScript)

All agent logic is packaged as OpenClaw skills.

#### Fighter Skill (Core Deliverable)

An OpenClaw skill that gives any agent the ability to compete across all game types:

**Matchmaking Module:**
- Connect to Monad testnet via ethers.js
- Register on the Agent Registry with supported game types
- Scan registry for open challenges
- Evaluate opponents: ELO, history, game types, wager range
- Select optimal match: highest expected value considering game type edge and opponent exploitability
- Accept or issue challenges

**RPS Strategy Module:**
- Frequency analysis of opponent moves
- Sequence detection (cycles, win-stay/lose-shift patterns)
- Markov chain prediction (transition probabilities given last N moves)
- Anti-exploitation (inject randomness when opponent is countering)
- Pattern seeding (establish fake pattern, then break it)

**Poker Strategy Module:**
- Hand strength evaluation
- Bluff decision engine: calculate EV of bluffing (P(opponent folds) × pot) vs. cost of getting called
- Value betting: size bets to maximize extraction from calling opponents
- Opponent bluff frequency tracking
- Fold threshold modeling: what bet size makes this opponent fold?
- Bet sizing tells: detect if opponent bets differently with strong vs. weak hands
- Reverse tells: vary own bet sizing to create false patterns

**Auction Strategy Module:**
- Bid shading: estimate opponent's likely bid, bid just above it
- Risk appetite modeling: track opponent bid distributions across auctions
- Information gathering: lose early low-stakes auctions cheaply to observe opponent behavior
- Multi-round strategy: bid aggressively early to discourage competition, then pull back

**Bankroll Management Module:**
- Kelly criterion wager sizing per match
- Per-game risk allocation based on historical win rates
- Hard risk limits (max % of bankroll per match)
- Tilt prevention (reduce wager sizes after losing streak, avoid high-variance games)
- Decline logic (reject unfavorable challenges)
- Loss-recovery mode (minimum wagers, highest-edge games only)

**Psychological Tactics Module:**
- Timing manipulation: vary commit/reveal/bet timing as a signal
- Pattern seeding: establish predictable behavior, then exploit the opponent's adaptation
- Tilt induction: challenge same opponent immediately after winning, at higher stakes
- Reputation manipulation: build or sandbagging ELO strategically

**Opponent Modeling Module (Cross-Game):**
- Unified opponent profile per wallet address
- Aggression index, predictability score, tilt detection
- Per-game strategy models (RPS patterns, poker tells, auction bid distributions)
- Cross-match persistence: remember opponents across matches
- Strategy change detection: notice when opponent adapts between matches

#### Opponent Skills (5 variants)

Simpler skills, each implementing a fixed strategic personality across all three game types. Deployed as separate OpenClaw agents on separate wallets. They register on the registry and accept challenges. Their strategies are hardcoded and do not adapt.

#### Spectator Skill (Bonus)

Watches live matches, estimates outcomes, places prediction market bets.

---

## Tech Stack

| Component | Technology | Why |
|---|---|---|
| Smart Contracts | Solidity | Monad is EVM-compatible, proven patterns |
| Contract Dev/Test | Foundry (forge, cast, anvil) | Fast, Solidity-native, easy deployment |
| Agent Runtime | OpenClaw | Hackathon ecosystem requirement |
| Agent Logic / Skills | TypeScript | OpenClaw skills are TypeScript |
| Blockchain Interaction | ethers.js | Standard EVM library, works with Monad RPC |
| Chain | Monad Testnet | Hackathon chain |
| Currency | Testnet MON | Claimed from Monad faucet |
| Demo Dashboard | React app or terminal logs | Visualize matches, bankroll, strategy, ELO |

---

## On-Chain Game Flows

### RPS Match Flow

1. Our agent scans registry, finds opponent with open RPS challenge
2. Agent calls escrow, locks wager in MON
3. Opponent locks matching wager
4. **Per round:** Both commit hash(move + salt) → both reveal → contract resolves
5. After N rounds: contract determines match winner, escrow pays out, registry updates ELO

### Poker Match Flow

1. Our agent issues poker challenge with wager amount
2. Opponent accepts, both lock MON in escrow (this becomes the base pot)
3. Both commit hand values (hash)
4. **Betting round 1:** Player A acts (check/bet). Player B responds (check/call/raise/fold).
5. **Betting round 2 (optional):** Further action
6. If neither folds → both reveal hands → higher hand wins entire pot
7. If one folds → other wins pot without revealing
8. Escrow settles, registry updates

### Auction Match Flow

1. Prize is posted (N MON value, from tournament pool or protocol)
2. Both agents commit sealed bids (hash of bid amount + salt)
3. Both reveal bids
4. Highest bidder wins prize, pays their bid. Net gain = prize - bid.
5. Loser keeps their bid amount (no loss, but no gain)
6. Registry updates

### Tournament Flow

1. N agents register, lock entry fees
2. Contract generates bracket (randomized matchups)
3. Round 1: all matches play out (game type specified per round)
4. Winners advance. Losers eliminated.
5. Round 2: escalated stakes, possibly different game type
6. Continue until finals
7. Prize pool distributed: winner > runner-up > semifinalists

---

## What The Demo Looks Like

The demo shows our agent autonomously competing across multiple game types on Monad testnet, growing its bankroll and ELO.

### Sequence:

1. **Start:** Agent has X MON and base ELO rating
2. **Match 1 (RPS vs The Rock):** Agent detects predictable pattern within 3 rounds, exploits it, wins decisively. Bets large because edge is high.
3. **Match 2 (Poker vs The Gambler):** Opponent bluffs constantly. Agent detects high bluff frequency, starts calling big bets, wins by letting the opponent bluff into strong hands. Agent also bluffs successfully once when it has a weak hand.
4. **Match 3 (Auction vs The Mirror):** Agent bids strategically, observing that the mirror agent tracks its bid history. Seeds a low-bid pattern, then jumps high when stakes matter.
5. **Match 4 (RPS vs The Counter):** Hardest opponent. Agent detects it's being countered, switches to mixed strategy, reduces wager size since edge is small. Grinds out a narrow win or accepts small loss.
6. **Match 5 (Poker vs The Rock):** Conservative opponent folds to any aggression. Agent bluffs repeatedly with minimum-strength hands, winning pots without showdown. Pure exploitation.
7. **Tournament:** 4-agent single-elimination. Round 1 is RPS, finals are poker. Agent adapts to game type rotation, wins the bracket.

### What judges see at the end:

- MON balance is higher than starting
- ELO rating has climbed
- Agent played differently in every match and every game type
- Bluffing, pattern exploitation, bid shading, and bankroll management all visible in the logs
- All transactions verifiable on Monad testnet block explorer
- Tournament bracket completed with escalating stakes

---

## Build Phases

### Phase 1: Foundation (Days 1-2)
- Set up OpenClaw locally, understand the skill system
- Set up Monad testnet wallet, claim testnet MON from faucet
- Write and deploy core Solidity contracts with Foundry: Agent Registry, Escrow, RPS Game Contract
- Test RPS contract flow manually with Foundry scripts

### Phase 2: Basic RPS Agent (Days 3-4)
- Build the Fighter Skill — minimal version that plays one RPS match
- Connect to Monad via ethers.js inside the skill
- Register, accept challenge, commit, reveal, collect payout
- Get one full match working end-to-end autonomously
- This is the hardest integration step

### Phase 3: Opponents + Smart Strategy (Days 5-6)
- Build 5 opponent agents with hardcoded strategies
- Deploy all on separate wallets, register on registry
- Add opponent modeling to Fighter Skill: frequency analysis, Markov chains, pattern detection
- Add Kelly criterion bankroll management
- Run 5+ RPS matches, verify positive win rate

### Phase 4: Poker (Days 7-8)
- Deploy Poker Game Contract
- Add Poker Strategy Module to Fighter Skill: bluffing, value betting, bet sizing tells, fold threshold modeling
- Update opponent agents with poker-specific strategies
- Run poker matches, demonstrate bluffing working on-chain

### Phase 5: Auction + Cross-Game Intelligence (Days 9-10)
- Deploy Auction Game Contract
- Add Auction Strategy Module to Fighter Skill: bid shading, information gathering
- Add cross-game opponent profiling: unified model per opponent
- Add game selection logic: choose game type based on edge against specific opponent
- Run mixed-game series demonstrating strategic game-type selection

### Phase 6: Tournament + Ranking (Days 11-12)
- Deploy Tournament Contract with bracket generation and game type rotation
- Add ELO rating to Agent Registry (update after every match)
- Run a full tournament: 4-8 agents, 2-3 rounds, escalating stakes, rotating game types
- Agent navigates bracket autonomously

### Phase 7: Polish + Psychological Tactics (Days 13-14)
- Add timing manipulation, pattern seeding, tilt induction
- Build dashboard or logging showing: opponent, game type, strategy used, bluffs attempted, bankroll changes, ELO progression, tx hashes
- Integrate with Moltbook (post match results, tournament standings)
- Record demo video
- Write submission docs
- Submit

### Phase 8: Bonus (If Time)
- Prediction Market AMM contract
- Spectator Skill
- More sophisticated tournament formats (round-robin, double elimination)

---

## Key Technical Decisions

### Why These Three Game Types

| Game | What It Tests | Bonus Point It Hits |
|---|---|---|
| Rock-Paper-Scissors | Pattern recognition, opponent modeling, adaptive play | Adapt strategy based on opponent patterns |
| Simplified Poker | Bluffing, deception, reading opponent behavior under hidden information | Bluffing, negotiation, psychological tactics |
| Blind Auction | Valuation, negotiation, strategic bidding | Negotiation, psychological tactics |

Together they demonstrate strategic versatility across fundamentally different competitive domains: simultaneous-move games (RPS), sequential-move games with hidden info (poker), and sealed-bid economic games (auction).

### Why Commit-Reveal for Everything
All three games involve hidden information (your move, your hand, your bid). Commit-reveal is the universal cryptographic pattern that makes hidden information work on a public blockchain. One pattern, three games.

### Why Kelly Criterion
Mathematically optimal bet sizing given estimated edge. Prevents ruin. Demonstrates sophistication. Formula: f* = (bp - q) / b. Applied per-game with different edge estimates.

### Why ELO for Ranking
Simple, well-understood, self-correcting. A new agent starts at base rating and the system converges to accurate ratings within ~10 matches. Per-game ELO means the agent's rating reflects actual skill per domain.

### Why OpenClaw Skills
The hackathon is built around OpenClaw. Packaging as skills means composability with the ecosystem and visibility on Moltbook.

---

## File Structure

```
molteee/
├── contracts/                       # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── AgentRegistry.sol        # Registration, discovery, ELO ratings
│   │   ├── Escrow.sol               # Wager locking and payout (shared)
│   │   ├── RPSGame.sol              # Rock-Paper-Scissors commit-reveal + ERC-8004 reputation
│   │   └── interfaces/
│   │       ├── IReputationRegistry.sol  # ERC-8004 Reputation Registry interface
│   │       └── IIdentityRegistry.sol    # ERC-8004 Identity Registry interface
│   ├── test/                        # Foundry tests (60 tests passing)
│   ├── script/
│   │   └── Deploy.s.sol             # Deployment script (includes reputation registry)
│   └── foundry.toml                 # Foundry config for Monad testnet
├── agent/                           # ERC-8004 registration & discovery
│   ├── registration.json            # ERC-8004 agent metadata
│   ├── src/register.ts              # On-chain registration script
│   ├── .well-known/agent-card.json  # A2A discovery endpoint
│   └── .env.example                 # Environment config template
├── skills/                          # OpenClaw skills
│   └── fighter/                     # Main fighter skill (core deliverable)
│       ├── SKILL.md                 # Skill manifest + LLM instructions
│       ├── scripts/arena.py         # CLI dispatcher for on-chain operations
│       ├── lib/contracts.py         # Contract ABIs, addresses, constants
│       └── references/              # Strategy docs for LLM context
├── opponents/                       # Standalone Python bots (no OpenClaw)
├── docs/                            # Project documentation
│   ├── PROJECT.md                   # This file
│   ├── PROBLEM.md                   # Problem statement
│   └── SOLUTION.md                  # Solution design
└── README.md                        # Setup and run instructions
```

---

## Success Definition

The project is successful if a judge can watch the demo and see:

1. An autonomous agent discovering opponents on Monad testnet
2. The agent choosing which game type to play based on strategic analysis
3. **In RPS:** Pattern detection and exploitation across rounds
4. **In Poker:** Successful bluffs, value bets, reading opponent tendencies
5. **In Auctions:** Strategic bid shading and information-based bidding
6. The agent wagering real testnet MON via on-chain escrow in every match
7. Bankroll growing over the series — larger bets where edge is high, smaller where uncertain
8. Tournament completion with bracket progression and game type rotation
9. ELO rating reflecting competitive performance
10. Psychological tactics visible in logs (timing variation, pattern seeding, tilt exploitation)
11. All transactions verifiable on-chain

That's every core requirement, every success criterion, and every bonus point.
