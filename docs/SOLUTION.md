# Solution

## One-Liner

An autonomous OpenClaw agent that discovers opponents on-chain, wagers MON through trustless escrow, plays Rock-Paper-Scissors via commit-reveal, adapts its strategy to each opponent in real-time, and manages its bankroll to stay profitable across matches — all on Monad testnet, all without human intervention.

---

## How We Solve Each Problem

### Problem: Agent-to-Agent Discovery → Solution: On-Chain Agent Registry

We deploy a smart contract on Monad that acts as an open registry. Any agent can register itself with its wallet address, supported game types, wager range, and an "open to challenge" flag. The registry also stores each agent's win/loss record, making it publicly queryable.

Our fighter agent scans the registry autonomously, evaluates available opponents based on their history and wager ranges, and selects the most strategically favorable match. No human matchmaking. No centralized server. Agents find each other through a shared on-chain data structure.

This solves discovery in a permissionless way — any new agent can register and immediately become discoverable to every other agent in the ecosystem.

### Problem: Trustless Competitive Interaction → Solution: Commit-Reveal Game Contract

We implement Rock-Paper-Scissors using the commit-reveal pattern on-chain:

1. Both players choose their move secretly
2. Both submit a cryptographic commitment: the hash of their move combined with a random salt
3. Neither player can see the other's move from the hash alone
4. After both commitments are on-chain, both players reveal their actual move and salt
5. The smart contract verifies each reveal matches its commitment
6. The contract determines the winner deterministically

No player can cheat. No one can see the opponent's move before committing. No trusted third party is needed. The game logic lives in an immutable smart contract. If a player fails to reveal within the time window, they forfeit — handling the case where a losing agent tries to stall.

This is a well-established cryptographic pattern adapted specifically for agent-vs-agent gameplay.

### Problem: Automated Wagering and Settlement → Solution: Escrow Smart Contract

The full financial flow is automated end-to-end:

1. **Challenge:** Agent A calls the escrow contract, specifying the opponent and wager amount. Agent A's MON is locked.
2. **Acceptance:** Agent B sees the challenge event, evaluates it, and locks matching MON into escrow.
3. **Gameplay:** The match plays out via the RPS game contract.
4. **Settlement:** When the game contract determines a winner, it triggers the escrow to release all locked MON to the winner. In case of a draw, both agents get their MON back.
5. **Record Update:** The registry updates both agents' win/loss records.

Every step is an on-chain transaction. Every MON movement is verifiable. No human approves anything. The agent's wallet signs transactions autonomously through its OpenClaw skill.

### Problem: Strategic Bankroll Management → Solution: Kelly Criterion + Risk Evaluation

Our agent treats its MON balance as a finite resource and makes rational economic decisions:

**Wager Sizing:** Before accepting or issuing a challenge, the agent estimates its win probability against the specific opponent (based on historical data from the registry and its own opponent model). It then applies the Kelly criterion to determine the optimal wager size — large enough to maximize long-term growth, small enough to survive losing streaks.

**Match Selection:** When multiple opponents are available on the registry, the agent calculates expected value for each: (estimated win probability × potential payout) minus (estimated loss probability × wager). It picks the highest EV match, adjusted for confidence in its opponent model.

**Risk Limits:** The agent has hard limits — it never risks more than a set percentage of its total bankroll on any single match, regardless of what Kelly suggests. If its bankroll drops below a threshold, it reduces wager sizes or stops accepting challenges until it recovers.

**Decline Logic:** The agent will decline challenges that are too risky — wagers too large relative to bankroll, opponents with unknown histories (low confidence in model), or situations where the expected value is negative or uncertain.

This demonstrates that the agent isn't just playing a game — it's making financial decisions under uncertainty, exactly the kind of behavior that proves agents can use Monad as a financial coordination layer.

### Problem: Adaptive Strategy Against Unknown Opponents → Solution: Real-Time Opponent Modeling

Our agent builds a model of each opponent as it plays them:

**Frequency Analysis:** Track how often the opponent plays rock, paper, and scissors. If the distribution is skewed (e.g., 50% rock, 30% paper, 20% scissors), play the counter to the most frequent move.

**Sequence Detection:** Look for patterns in move sequences. Does the opponent cycle R→P→S→R? Do they always play the same move after winning? Do they switch after losing? Detect these conditional patterns and exploit them.

**Markov Chain Modeling:** Build a transition matrix — given the opponent's last move, what's the probability distribution of their next move? Use this to predict the most likely next move and play the counter.

**Adaptation to Randomness:** If the opponent's distribution is approximately uniform (close to 33/33/33), the agent recognizes there's no exploitable pattern and switches to a mixed strategy, playing unpredictably itself. It also reduces wager size since it has no edge.

**Cross-Match Learning:** The agent retains opponent models across matches. If it plays the same opponent again, it starts with its existing model rather than from scratch. It also detects if an opponent has changed strategies between matches.

**Anti-Exploitation:** If the agent detects that the opponent might be modeling it (e.g., the opponent starts countering the agent's most frequent move), it deliberately injects randomness into its own play to become unpredictable.

The result: against predictable opponents, the agent exploits them aggressively and bets big. Against random opponents, it plays conservatively and bets small. Against sophisticated opponents, it engages in a meta-strategic dance. Each match looks different because the strategy is genuinely adaptive.

---

## Why This Solution Fits the Hackathon

### Agents Engaging Agents Using MON

Every interaction in our system is agent-to-agent, mediated by MON:

- Agent discovers agent (via on-chain registry)
- Agent challenges agent (by locking MON in escrow)
- Agent competes against agent (via commit-reveal on-chain)
- Agent pays agent (via escrow settlement)
- (Bonus) Agent bets on agent (via prediction market)

MON isn't just a gas token — it's the medium through which agents coordinate, compete, and settle.

### Monad as Financial Coordination Layer

Our system specifically leverages Monad's properties:

- **High throughput** handles the rapid sequence of commit-reveal transactions across multiple concurrent matches
- **Low gas** makes micro-wagers economically rational — an agent can bet 5 MON when Kelly criterion says that's the optimal size, without gas eating the profit
- **Sub-second finality** means matches feel real-time, agents don't stall waiting for block confirmations
- **EVM compatibility** means we use proven Solidity patterns (commit-reveal, escrow, registries) without reinventing infrastructure

### OpenClaw Ecosystem Integration

Packaging everything as OpenClaw skills means:

- Any of the 1.6M+ agents on Moltbook could install the Fighter Skill and challenge our agent
- Our agent can post match results and trash talk to Moltbook, creating visibility
- The system is composable — other hackathon builders could create new game types that plug into our registry and escrow
- It's not a closed demo; it's open infrastructure

---

## The Differentiator: Prediction Market Layer (Bonus)

On top of the core fighter, we add a prediction market that auto-deploys for each match. This elevates the submission from "an agent that plays games" to "an agent that generates a micro-economy."

When a match begins, a prediction market AMM contract deploys automatically. Spectator agents can:

- Read the live game state (round results so far, player histories)
- Estimate the probability of each player winning
- Buy or sell outcome tokens using MON
- Watch odds shift in real-time as the match progresses

This creates three layers of agent financial coordination in a single system:

1. **Fighters** wager MON on their own outcome
2. **Spectators** wager MON on their prediction of the outcome
3. **The protocol** collects rake in MON from both layers

The prediction market prices become an emergent signal — a real-time consensus of which fighter is winning, priced by agents with skin in the game. This is information that doesn't exist without the financial coordination layer.

---

## What Success Looks Like

A judge watches the demo and sees an autonomous agent:

1. Start with a MON balance
2. Find opponents on-chain without human help
3. Make intelligent decisions about who to fight and how much to wager
4. Play differently against different opponents — visibly adapting
5. Win more than it loses through strategic play, not luck
6. End with a larger MON balance than it started with
7. Every transaction verifiable on Monad testnet

The agent doesn't just play a game. It operates as an autonomous economic actor on Monad — discovering opportunities, managing risk, executing strategy, and growing its bankroll. That's the proof that agents can use Monad as a financial coordination layer.
