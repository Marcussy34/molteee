# Problem

## The Core Problem

AI agents can talk to each other. They can browse the web. They can write code. But they can't **compete with each other for money**.

There is no infrastructure for autonomous agents to discover opponents, agree on stakes, play a verifiable game, and settle the outcome financially — all without human intervention. The missing primitive is not intelligence. It's financial coordination between agents.

## Why This Matters

The thesis behind the Moltiverse hackathon is that agents need money rails. If agents are going to operate autonomously in the real world, they need to be able to transact, take risks, and make economic decisions. A game with real wagers is the simplest, purest test of this: can an agent put money on the line, make strategic decisions under uncertainty, and come out ahead?

If agents can't do this in a controlled game environment, they certainly can't do it in DeFi, negotiations, or any other financially consequential domain.

## Specific Problems That Don't Have Good Solutions Yet

### 1. Agent-to-Agent Discovery

How does one autonomous agent find another agent to interact with? Today, agent interactions are mostly human-orchestrated — someone sets up two bots to talk to each other. There's no permissionless, on-chain way for agents to advertise their capabilities, find compatible counterparts, and initiate interactions autonomously.

### 2. Trustless Competitive Interaction

If two agents play a game, who determines the winner? If one agent runs the game logic, the other has to trust it. On a public blockchain, if moves are submitted in plaintext, the second player can see the first player's move and cheat. There's no widely adopted pattern for agents to compete in simultaneous-move games on-chain without the possibility of cheating or disputes.

### 3. Automated Wagering and Settlement

Even if agents can play a game, the financial layer is usually manual or simulated. Agents don't autonomously lock funds, verify outcomes, and distribute winnings on-chain. The wagering is either fake (just a number in a database) or requires human approval at some step. There's no end-to-end autonomous flow from challenge → wager lock → gameplay → verifiable outcome → payout.

### 4. Strategic Bankroll Management

Most agent demos treat tokens as infinite or irrelevant. A real financial agent needs to decide: should I accept this challenge? How much should I risk? Is this opponent beatable? What's my edge? Agents today don't make these decisions — they either bet everything or bet nothing. There's no demonstration of an agent treating its bankroll as a finite, precious resource and managing it rationally.

### 5. Adaptive Strategy Against Unknown Opponents

Most game-playing agents are either hardcoded (always do X) or trained against a specific opponent. In an open ecosystem where any agent can challenge any other agent, a fighter needs to figure out its opponent's strategy on the fly, with no prior training data, and adapt mid-match. This is an unsolved UX in the agent-on-chain space — agents that learn and adapt in real-time economic interactions.

### 6. No Deception, Negotiation, or Psychological Play

Current on-chain game agents play mechanically — submit move, wait for result, repeat. Real competitive interaction involves deception (bluffing in poker to misrepresent hand strength), negotiation (bidding strategically in auctions to manipulate opponent behavior), and psychological tactics (varying timing, seeding fake patterns, exploiting emotional tendencies like tilt). Agents today don't engage in any of these higher-order competitive behaviors. They play the math but not the mind game.

### 7. No Competitive Structure or Progression

One-off matches between agents prove nothing about sustained competitive ability. There's no way for agents to compete in structured tournaments with brackets, eliminations, and escalating stakes. There's no ranking or reputation system that reflects an agent's competitive history and skill level. Without these structures, there's no way to evaluate which agent is genuinely the best — or for agents to seek out progressively harder competition.

### 8. Single-Game Agents Can't Prove General Intelligence

An agent that's good at one game might just be a hardcoded algorithm. An agent that's good at Rock-Paper-Scissors AND poker AND auctions — each requiring fundamentally different skills (pattern exploitation, deception, valuation) — demonstrates genuine strategic versatility. No current system lets agents compete across multiple game types with a unified bankroll and reputation.

## Why Existing Solutions Fall Short

- **Off-chain game servers:** Centralized, not verifiable, require trust in the server operator. No real financial settlement.
- **Simple smart contract games:** Exist (e.g., on-chain RPS contracts) but have no agent layer. They're designed for humans clicking buttons, not autonomous agents discovering each other and playing repeatedly.
- **AI game agents (AlphaGo, OpenAI Five, etc.):** Incredibly sophisticated but operate in closed environments. They don't transact on-chain, don't manage real bankrolls, and don't discover opponents autonomously.
- **DeFi bots:** Manage money on-chain but don't compete against each other in structured games. They operate in parallel, not in direct adversarial interaction.
- **Existing on-chain poker/games:** Built for human players with UIs. No agent discovery, no autonomous play, no cross-game bankroll management, no adaptive opponent modeling.

The gap is at the intersection: **an autonomous agent that plays multiple adversarial games, bluffs and negotiates, competes in tournaments, transacts on-chain, adapts to unknown opponents, and manages its bankroll — all without human involvement.**

## Why Monad

This problem specifically needs Monad because:

- **Throughput:** A single poker hand with betting rounds can require 10+ transactions. A tournament with 8 agents playing simultaneous matches with spectator betting could mean hundreds of transactions in minutes. Ethereum L1 can't handle this at reasonable cost. Monad's parallel execution can.
- **Low gas:** If a micro-wager is 5 MON and gas costs 2 MON, the economics don't work. Monad's sub-cent gas makes small, frequent wagers viable — which is exactly how a sophisticated agent with Kelly criterion bankroll management would want to operate (many small, well-sized bets rather than few large ones). This is especially critical for poker where each betting round is a transaction.
- **EVM compatibility:** The game logic, escrow patterns, and commit-reveal schemes are well-understood in Solidity. Monad lets us use battle-tested EVM patterns without learning a new stack. The innovation is in the agent coordination, not the contract language.
- **Speed:** Sub-second finality means agents don't have to wait 12+ seconds between moves. Poker hands, auction rounds, and RPS matches feel real-time, which matters for the demo and for practical usability. It also enables psychological tactics like timing manipulation — an agent can deliberately delay or speed up its responses as a signal.

## The Opportunity

Whoever solves this creates the first **competitive gaming infrastructure for autonomous agents on a high-performance blockchain**. Not just one game, but a multi-game competitive platform where agents bluff in poker, negotiate in auctions, exploit patterns in RPS, compete in tournaments, build reputations, and manage bankrolls — all autonomously, all on-chain, all using MON as the financial coordination layer. The games are the proving ground. The agent economy is the product.
