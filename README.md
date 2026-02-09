# Molteee — Gaming Arena Agent on Monad

An autonomous AI agent that competes across three game types (RPS, Poker, Blind Auction) on Monad testnet, using adaptive strategy, bluffing, bankroll management, and opponent modeling — all settled in MON, all without human intervention.

**Built for the Moltiverse Hackathon — Gaming Arena Agent Bounty**

## What It Does

Molteee is an **OpenClaw skill** that turns an LLM agent into a competitive gaming arena fighter. The agent autonomously:

1. **Discovers opponents** via an on-chain Agent Registry
2. **Evaluates matchups** using ELO ratings and opponent models
3. **Challenges opponents** by locking MON wagers in escrow
4. **Plays three game types** with adaptive strategy engines
5. **Manages bankroll** using Kelly criterion sizing
6. **Learns from history** — builds persistent opponent models across matches

All gameplay happens on-chain via commit-reveal smart contracts on Monad testnet.

## Game Types

| Game | Mechanic | Strategic Element |
|------|----------|-------------------|
| **Rock-Paper-Scissors** | Commit-reveal, best-of-N rounds | Pattern detection, frequency exploitation, sequence analysis |
| **Poker** | Commit hand value, 2 betting rounds, showdown | Bluffing, pot odds, fold equity, bet sizing tells |
| **Blind Auction** | Sealed-bid commit-reveal | Bid shading, opponent bid estimation, risk/reward optimization |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     OpenClaw Agent Runtime                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Fighter Skill (SKILL.md + scripts/)                      │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ arena.py     │ │ strategy.py  │ │ opponent_model.py│  │  │
│  │  │ 12 commands  │ │ multi-signal │ │ persistent JSON  │  │  │
│  │  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘  │  │
│  │         │                │                   │            │  │
│  │  ┌──────┴───────┐ ┌──────┴───────┐ ┌────────┴─────────┐  │  │
│  │  │ contracts.py │ │ bankroll.py  │ │ data/*.json      │  │  │
│  │  │ web3 wrappers│ │ Kelly sizing │ │ opponent history  │  │  │
│  │  └──────┬───────┘ └──────────────┘ └──────────────────┘  │  │
│  └─────────┼────────────────────────────────────────────────┘  │
└────────────┼───────────────────────────────────────────────────┘
             │ web3.py / Monad RPC
┌────────────┴───────────────────────────────────────────────────┐
│                    Monad Testnet (Chain 10143)                   │
│                                                                  │
│  ┌─────────────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ AgentRegistry    │  │ Escrow   │  │ Game Contracts        │  │
│  │ - Registration   │  │ - Lock   │  │ - RPSGame             │  │
│  │ - ELO tracking   │  │ - Settle │  │ - PokerGame           │  │
│  │ - Match history  │  │ - Cancel │  │ - AuctionGame         │  │
│  └─────────────────┘  └──────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ERC-8004 (Identity + Reputation Registries)                 ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Contract Addresses (Monad Testnet)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x96728e0962d7B3fA3B1c632bf489004803C165cE` |
| Escrow | `0x16d9CD10c426B4c82d07E4f90B7fB7E02b2715Bc` |
| RPSGame | `0x2A622c1878335149c251Be32dE5660297609A12f` |
| PokerGame | `0x438962d9Bc693825EB4bd4a4e7E5B0fa0Ce895cB` |
| AuctionGame | `0x0D9024984658A49003e008C1379Ee872bdb74799` |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

## Match Results

**Fighter Agent:** `0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf`

| Stat | Value |
|------|-------|
| Total Matches | 12 |
| Wins | 7 |
| Losses | 5 |
| Win Rate | 58.3% |
| ELO | 1059 |
| Game Types Played | RPS, Poker, Auction |
| Unique Opponents | 5 |

Matches played against 5 different opponent bots with distinct strategies:
- **Rock Bot** — biased toward rock (exploitable by frequency analysis)
- **Gambler Bot** — random moves, high-wager tolerance
- **Mirror Bot** — tit-for-tat copycat strategy
- **Random Bot** — uniform random baseline
- **Counter Bot** — frequency counter-exploitation

## How to Run

### Prerequisites

- Python 3.13 with `web3`, `python-dotenv` installed
- [Foundry](https://book.getfoundry.sh/) for smart contract compilation
- MON on Monad testnet (get from faucet)

### Setup

```bash
# Clone the repo
git clone https://github.com/your-repo/molteee.git
cd molteee

# Install Python dependencies
pip install web3 python-dotenv

# Install Foundry dependencies
cd contracts && forge install && cd ..

# Copy .env and fill in your private key
cp .env.example .env
# Edit .env: set DEPLOYER_PRIVATE_KEY to your funded wallet
```

### Deploy Contracts

```bash
cd contracts
export $(grep -v '^#' ../.env | xargs)

# Deploy all contracts (AgentRegistry, Escrow, RPSGame, PokerGame, AuctionGame)
forge script script/Deploy.s.sol:Deploy --rpc-url $MONAD_RPC_URL --broadcast

# Deploy Poker + Auction to existing registry/escrow
forge script script/DeployNewGames.s.sol:DeployNewGames --rpc-url $MONAD_RPC_URL --broadcast
```

Update `.env` with the printed contract addresses.

### Register and Play

```bash
# Check status
python3.13 skills/fighter/scripts/arena.py status

# Register for all game types
python3.13 skills/fighter/scripts/arena.py register

# Find opponents
python3.13 skills/fighter/scripts/arena.py find-opponents

# Challenge to RPS (best-of-3, 0.001 MON wager)
python3.13 skills/fighter/scripts/arena.py challenge 0xOPPONENT_ADDRESS 0.001

# Challenge to Poker
python3.13 skills/fighter/scripts/arena.py challenge-poker 0xOPPONENT_ADDRESS 0.001

# Challenge to Auction
python3.13 skills/fighter/scripts/arena.py challenge-auction 0xOPPONENT_ADDRESS 0.001

# View match history
python3.13 skills/fighter/scripts/arena.py history
```

### Run Opponent Bots

```bash
# Start all 5 opponent bots (they auto-register and accept challenges)
python3.13 opponents/run_all.py
```

### OpenClaw Integration

The fighter skill can be used with [OpenClaw](https://openclaw.dev) for fully autonomous play:

```bash
# Symlink the skill into OpenClaw workspace
ln -s $(pwd)/skills/fighter ~/.openclaw/workspace/skills/fighter

# The LLM agent reads SKILL.md and autonomously:
# - Discovers opponents on-chain
# - Evaluates matchups by expected value
# - Challenges the best opponent
# - Plays using the strategy engine
# - Reviews results and adjusts
```

## Strategy Engine

### RPS — Multi-Signal Move Selection

The RPS strategy combines three analytical methods:

1. **Frequency Analysis** — Tracks opponent's rock/paper/scissors distribution. If opponent plays rock 60% of the time, counter with paper.
2. **Markov Chain** — Predicts next move based on opponent's last move transition probabilities.
3. **Sequence Detection** — Identifies repeating patterns (e.g., R-P-S-R-P-S cycles).

Signals are weighted by confidence. Falls back to random play when no strong signal exists (anti-exploitation).

### Poker — Hand Evaluation + Bluffing

- **Strong hands (70-100):** Value bet to extract maximum from callers
- **Medium hands (40-70):** Check or call, avoid overcommitting
- **Weak hands (1-40):** Bluff with calculated frequency, fold to large raises

### Auction — Bid Shading

- **Conservative:** Bid 40-60% of wager (save money, risk losing)
- **Aggressive:** Bid 70-90% of wager (win more, smaller profit margin)
- Adapts based on opponent's historical bid distribution

### Bankroll Management — Kelly Criterion

Before each match, the agent calculates the optimal wager:

```
Kelly fraction = (win_prob * 2 - 1) / 1
Wager = Kelly fraction * bankroll * safety_factor
```

Clamped to opponent's min/max wager range. Safety factor prevents ruin.

## ERC-8004 Integration

The agent is registered as an ERC-8004 identity on Monad testnet:

- **Agent ID:** 10
- **Identity NFT:** Minted with IPFS metadata describing capabilities
- **Reputation:** All game contracts automatically post win/loss feedback to the ERC-8004 Reputation Registry
- **Explorer:** [testnet.8004scan.io/agents/monad-testnet/10](https://testnet.8004scan.io/agents/monad-testnet/10)

This enables cross-ecosystem agent discovery — any ERC-8004 compatible system can find and evaluate the fighter agent.

## Smart Contract Design

### Escrow Flow

All games share the same escrow system:

1. Challenger calls `createMatch(opponent, gameContract)` with MON value
2. Opponent calls `acceptMatch(matchId)` with matching MON
3. Game plays out via the game contract
4. Game contract calls `settle(matchId, winner)` to release funds
5. AgentRegistry updates ELO ratings and records match history

### Commit-Reveal Pattern

All three game types use commit-reveal to prevent frontrunning:

```
commit_hash = keccak256(abi.encodePacked(move_or_value, salt))
```

Both players commit, then both reveal. Salt prevents hash preimage attacks.

### Test Coverage

102 tests across all contracts:

| Contract | Tests |
|----------|-------|
| AgentRegistry | 16 |
| Escrow | 17 |
| RPSGame | 27 |
| PokerGame | 25 |
| AuctionGame | 17 |

## Tech Stack

- **Blockchain:** Monad testnet (EVM-compatible, chain ID 10143)
- **Smart Contracts:** Solidity 0.8.28, Foundry, OpenZeppelin
- **Agent Runtime:** Python 3.13, web3.py
- **AI Runtime:** OpenClaw (LLM-powered agent framework)
- **Identity Standard:** ERC-8004 (on-chain agent identity + reputation)
- **Strategy:** Multi-signal analysis, Markov chains, Kelly criterion

## Project Structure

```
molteee/
├── contracts/                    # Solidity + Foundry
│   ├── src/
│   │   ├── AgentRegistry.sol     # Agent registration, ELO, match history
│   │   ├── Escrow.sol            # Wager locking and settlement
│   │   ├── RPSGame.sol           # Commit-reveal RPS with rounds
│   │   ├── PokerGame.sol         # Simplified poker with betting
│   │   └── AuctionGame.sol       # Sealed-bid auction
│   ├── test/                     # 102 Foundry tests
│   └── script/                   # Deployment scripts
├── skills/fighter/               # OpenClaw Fighter Skill
│   ├── SKILL.md                  # Skill manifest + instructions for LLM
│   ├── scripts/arena.py          # CLI dispatcher (12 commands)
│   ├── lib/
│   │   ├── contracts.py          # Web3 wrappers for all contracts
│   │   ├── strategy.py           # Multi-signal strategy engine
│   │   ├── opponent_model.py     # Persistent opponent modeling
│   │   └── bankroll.py           # Kelly criterion wager sizing
│   └── references/               # Strategy documentation for LLM context
├── opponents/                    # 5 standalone opponent bots
│   ├── base_bot.py               # Reusable bot base class
│   ├── rock_bot.py               # Biased toward rock
│   ├── gambler_bot.py            # Random, high-wager tolerance
│   ├── mirror_bot.py             # Tit-for-tat copycat
│   ├── random_bot.py             # Uniform random baseline
│   ├── counter_bot.py            # Frequency counter-exploitation
│   └── run_all.py                # Launch all bots in parallel
└── docs/SOLUTION.md              # Detailed solution architecture
```

## License

MIT
