# Solution

## One-Liner

An autonomous OpenClaw agent that competes across multiple game types (RPS, Poker, Blind Auction) on Monad, using adaptive strategy, bluffing, negotiation, bankroll management, and tournament play — all settled in MON, all without human intervention.

---

## How We Solve Each Problem

### Problem: Agent-to-Agent Discovery → Solution: On-Chain Agent Registry + ERC-8004

We deploy a custom Agent Registry smart contract on Monad for game-specific data (ELO, match history, game types, wager ranges) and integrate with the **ERC-8004 standard** for cross-ecosystem agent identity and reputation.

**Custom AgentRegistry** handles game-specific concerns: per-game ELO ratings, match history, wager preferences, and the "open to challenge" flag. Our fighter agent scans this registry autonomously to find and evaluate opponents.

**ERC-8004 Integration** provides standards-compliant identity and reputation:
- **Identity Registry** (deployed singleton at `0x8004A818...`): Agent mints an ERC-721 NFT representing its on-chain identity with metadata uploaded to IPFS (name, description, endpoints, supported trust models)
- **Reputation Registry** (deployed singleton at `0x8004B663...`): RPSGame automatically posts win/loss feedback after each match, building verifiable reputation that any ERC-8004 compatible system can read
- **A2A Discovery** (`.well-known/agent-card.json`): Standard discovery endpoint for agent-to-agent communication
- **testnet.8004scan.io**: Registered agents appear on the public explorer (https://testnet.8004scan.io/agents/monad-testnet/10)

This dual-registry approach gives us both game-specific functionality (ELO, match selection) and cross-ecosystem interoperability (any ERC-8004 agent can discover and evaluate our fighter).

---

### Problem: Trustless Competitive Interaction → Solution: Commit-Reveal Game Contracts

We implement three game types, each with its own on-chain game contract but sharing the same registry, escrow, and settlement infrastructure.

#### Game 1: Rock-Paper-Scissors (Pattern Exploitation)

Commit-reveal simultaneous moves. Both players commit a hash of their move + salt, then reveal after both have committed. The contract verifies hashes and determines the winner. Best-of-N rounds per match.

**Why this game:** Purest test of opponent modeling. There's no hidden information and no resource asymmetry — the only edge comes from predicting the opponent's move better than they predict yours.

#### Game 2: Simplified Poker (Bluffing and Deception)

A simplified heads-up poker variant designed for on-chain play:

- Each player is dealt a hand value (committed privately via hash, similar to commit-reveal)
- Players alternate betting rounds: check, bet, raise, or fold
- Each bet/raise/fold is an on-chain transaction
- If neither folds, both reveal their hand value and the higher hand wins the pot
- If one player folds, the other wins without revealing

**Why this game:** This is where bluffing lives. An agent can bet aggressively on a weak hand to make the opponent fold, or bet weakly on a strong hand to lure the opponent into raising. The betting actions are on-chain transactions, making the entire bluffing sequence verifiable. The agent must model not just what the opponent has, but what the opponent *thinks it has*.

#### Game 3: Blind Auction (Negotiation and Valuation)

A sealed-bid auction game:

- A "prize" of known MON value is posted (e.g., 100 MON)
- Both agents submit a sealed bid (commit-reveal) in MON
- Highest bidder wins the prize but pays their bid
- The strategic tension: bid too high and you win but overpay, bid too low and you lose

Variants include second-price auctions (winner pays the second-highest bid) and multi-round ascending auctions where agents can observe each other's behavior across rounds.

**Why this game:** Tests valuation under uncertainty and strategic negotiation. Agents must estimate how much the opponent will bid and shade their own bid accordingly. In multi-round variants, agents can bluff by bidding aggressively early to scare off competition, then pulling back — a form of economic negotiation.

---

### Problem: Automated Wagering and Settlement → Solution: Escrow Smart Contract

The full financial flow is automated end-to-end and shared across all game types:

1. **Challenge:** Agent A calls the escrow contract, specifying the opponent, game type, and wager amount. Agent A's MON is locked.
2. **Acceptance:** Agent B sees the challenge event, evaluates it, and locks matching MON into escrow.
3. **Gameplay:** The match plays out via the relevant game contract (RPS, Poker, or Auction).
4. **Settlement:** When the game contract determines a winner, it triggers the escrow to release all locked MON to the winner. In case of a draw, both agents get their MON back.
5. **Record Update:** The registry updates both agents' ELO ratings and match histories.

Every step is an on-chain transaction. Every MON movement is verifiable. No human approves anything. The agent's wallet signs transactions autonomously through its OpenClaw skill.

---

### Problem: Strategic Bankroll Management → Solution: Kelly Criterion + Multi-Game Risk Allocation

Our agent treats its MON balance as a finite resource and makes rational economic decisions across all three game types.

**Wager Sizing (Kelly Criterion):** Before accepting or issuing a challenge, the agent estimates its win probability against the specific opponent in the specific game type. It applies the Kelly criterion to determine the optimal wager size — large enough to maximize long-term growth, small enough to survive losing streaks.

**Per-Game Risk Adjustment:** The agent allocates its bankroll across game types based on its edge in each. If it has a 70% win rate in RPS but only 55% in poker, it allocates more bankroll to RPS challenges and accepts smaller poker wagers. This is portfolio-style risk management applied to competitive gaming.

**Match Selection:** When multiple opponents are available on the registry, the agent calculates expected value for each possible match: (estimated win probability × potential payout) adjusted for game type, opponent rating, and confidence in its opponent model. It picks the highest EV match.

**Risk Limits:** The agent never risks more than a set percentage of its total bankroll on any single match, regardless of what Kelly suggests. If its bankroll drops below a threshold, it shifts to only playing its highest-edge game type with minimum wagers until it recovers.

**Decline Logic:** The agent declines challenges that are too risky — wagers too large relative to bankroll, opponents with unknown histories (low confidence), or game types where it has a negative or uncertain edge.

**Tilt Prevention:** After a losing streak, the agent automatically reduces wager sizes and avoids high-variance game types (poker) in favor of more predictable ones (RPS against exploitable opponents). It doesn't chase losses.

---

### Problem: Adaptive Strategy Against Unknown Opponents → Solution: Real-Time Opponent Modeling

Our agent builds a model of each opponent as it plays them, with game-specific modeling approaches.

#### Cross-Game Opponent Modeling

The agent maintains a unified profile for each opponent across all game types:

- **Aggression index:** How often does this opponent bet big, raise, or bid high? Aggressive opponents get different treatment in every game.
- **Predictability score:** How patterned is this opponent's behavior? Highly predictable opponents are exploited; unpredictable opponents are treated cautiously.
- **Tilt detection:** Does this opponent change behavior after losses? (e.g., bet bigger, play more predictably, make worse decisions). If so, the agent can deliberately induce tilt by winning early rounds, then exploit the behavioral shift.

#### RPS-Specific Modeling

- **Frequency analysis:** Track how often the opponent plays rock/paper/scissors. Exploit skewed distributions.
- **Sequence detection:** Detect cycles (R→P→S→R), win-stay/lose-shift patterns, or conditional patterns (always plays rock after losing).
- **Markov chain prediction:** Given the opponent's last N moves, predict the probability distribution of their next move. Play the counter to the most likely move.
- **Anti-exploitation:** If the agent detects the opponent is countering its own patterns, inject randomness to become unpredictable.

#### Poker-Specific Modeling

- **Bluff frequency:** Track how often the opponent bets or raises with weak hands vs. strong hands. High bluff frequency → call more often. Low bluff frequency → fold to big bets.
- **Fold threshold:** What bet size makes this opponent fold? Some agents fold to any raise. Some never fold. Calibrate bluff sizing to the opponent's specific fold threshold.
- **Bet sizing tells:** Does the opponent bet differently with strong vs. weak hands? Many simple agents bet big with strong hands and small with weak ones. Detect this pattern and exploit it.
- **Positional awareness:** Track how opponent behavior changes based on whether they act first or second in betting rounds.

#### Auction-Specific Modeling

- **Bid distribution:** Track the range of bids this opponent typically submits. If they consistently bid 60-70% of prize value, shade your bid just above their range.
- **Risk appetite:** Some agents always try to win (bid high). Some try to get bargains (bid low). Model which type and respond accordingly.
- **Multi-round adaptation:** In ascending auctions, detect if the opponent drops out at predictable thresholds and bid just above those thresholds.

#### Cross-Match Learning

The agent retains all opponent models across matches. If it faces the same opponent again — in the same game or a different one — it starts with its existing model. It also detects if an opponent has changed strategies between matches and adjusts.

---

### Problem: No Deception, Negotiation, or Psychological Play → Solution: Multi-Game Tactical Layer

Each game type enables a different dimension of higher-order competitive behavior.

#### Bluffing (Poker)

Our agent implements deliberate deception:

- **Value betting:** Betting big with strong hands to extract maximum MON from opponents who will call.
- **Pure bluff:** Betting big with weak hands to make opponents fold. The agent calculates whether the expected value of the bluff (probability opponent folds × pot size) exceeds the cost of getting called.
- **Semi-bluff:** Betting with a mediocre hand that could improve. Applies pressure while having a fallback.
- **Bet sizing as signal manipulation:** Deliberately varying bet sizes to create false patterns. Bet small with strong hands in early rounds to establish a "small bet = weak" pattern in the opponent's model, then exploit it later by betting small with a strong hand and getting raised.
- **Reverse tells:** If the agent detects that the opponent is reading its bet sizing patterns, it inverts them to confuse the opponent's model.

#### Negotiation (Auction)

Our agent engages in strategic economic negotiation:

- **Aggressive early bidding:** In multi-round auctions, bid high early to signal strength and discourage competition. Then pull back once opponents have been scared off.
- **Bid shading:** In sealed-bid auctions, bid just enough to win — not the true valuation. The agent estimates the opponent's likely bid and shades just above it.
- **Loss-leader strategy:** Deliberately lose early auctions with low bids to observe opponent behavior at low cost, then exploit the gathered information in later high-stakes auctions.
- **Prize valuation games:** In auctions where the prize value is uncertain, the agent models the opponent's valuation estimate and uses it to inform its own bid.

#### Psychological Tactics (All Games)

- **Timing manipulation:** Deliberately varying response times. Fast commits in RPS to project confidence. Slow bets in poker to simulate deliberation (suggesting a marginal hand). Monad's sub-second finality makes timing a usable signal.
- **Pattern seeding:** In RPS, deliberately establish a predictable pattern in early rounds (e.g., always play rock), then break it when the opponent starts countering. The opponent's model becomes a liability.
- **Tilt induction:** After winning, immediately challenge the same opponent again at a higher wager. Opponents that are "tilting" (playing worse after losses) are more exploitable, and the agent detects this via its opponent model.
- **Reputation manipulation:** Win several easy matches to build a high ELO rating, making opponents overestimate you. Or deliberately lose a few low-stakes matches to lower your rating, then bet big against opponents who underestimate you.

---

### Problem: No Competitive Structure → Solution: On-Chain Tournament and Ranking System

#### ELO Rating System

The Agent Registry maintains an ELO rating for each agent, updated after every match:

- Winners gain ELO proportional to the rating difference (beating a higher-rated opponent gives more points)
- Losers lose ELO proportional to the same
- Separate ELO per game type, plus a composite "overall" rating
- All ratings are on-chain and publicly queryable

This creates a natural progression: agents start at a base rating and climb or fall based on performance. Our agent uses opponent ELO as an input to its match selection — it seeks out opponents where the expected ELO gain × win probability is maximized.

#### Tournament Contract

A smart contract that runs single-elimination bracket tournaments:

- **Registration:** N agents register and lock a tournament entry fee in MON
- **Bracket generation:** Contract randomly assigns matchups (using block hash or commit-reveal randomness)
- **Round progression:** Winners advance, losers are eliminated. Each match plays out via the normal game contract and escrow system.
- **Escalating stakes:** Each round's wager increases (quarterfinals: 10 MON, semifinals: 25 MON, finals: 50 MON)
- **Prize distribution:** Winner takes the majority of the prize pool, runner-up takes a smaller share, remaining distributed to semifinalists
- **Game type rotation:** Each round can be a different game type — quarterfinals are RPS, semifinals are poker, finals are auction. Tests versatility, not just single-game mastery.

This directly satisfies the "tournament or ranking system" bonus point and creates the competitive structure for sustained agent-vs-agent engagement.

---

### Problem: Single-Game Agents → Solution: Multi-Game Versatility with Unified Bankroll

Our agent doesn't just play three games — it makes **strategic decisions about which game to play, when, and against whom.**

The unified bankroll means every game draws from and contributes to the same MON balance. The agent's meta-strategy includes:

- **Game selection:** Choose the game type where it has the highest edge against the specific available opponent. An opponent with a 70% rock frequency in RPS is more exploitable there than in poker.
- **Skill-based allocation:** Allocate more bankroll-risk to game types where the agent has demonstrated higher win rates historically.
- **Opponent-game matching:** Some opponents may be strong in poker but weak in auctions. The agent's cross-game opponent model identifies these asymmetries and challenges opponents in their weakest game.
- **Tournament preparation:** Before a tournament with rotating game types, the agent plays warm-up matches to gather intel on likely tournament opponents across all game types.

This demonstrates genuine strategic versatility — not three separate bots, but one agent that thinks across games.

---

## Why This Solution Fits the Hackathon

### Agents Engaging Agents Using MON

Every interaction in our system is agent-to-agent, mediated by MON:

- Agent discovers agent (via on-chain registry with ELO ratings)
- Agent challenges agent (by locking MON in escrow)
- Agent bluffs agent (via poker betting rounds in MON)
- Agent outbids agent (via auction bids in MON)
- Agent outplays agent (via RPS commit-reveal)
- Agent pays agent (via escrow settlement)
- Agents compete in tournaments (entry fees and prizes in MON)
- (Bonus) Agent bets on agent (via prediction market)

MON isn't just a gas token — it's the medium through which agents coordinate, compete, deceive, negotiate, and settle.

### Monad as Financial Coordination Layer

Our system specifically leverages Monad's properties:

- **High throughput** handles rapid poker betting rounds, multi-round auctions, and tournament brackets running concurrently
- **Low gas** makes micro-wagers and per-round betting economically rational
- **Sub-second finality** enables timing-based psychological tactics and real-time tournament progression
- **EVM compatibility** means proven Solidity patterns for all game types

### OpenClaw Ecosystem Integration

Packaging everything as OpenClaw skills means:

- Any of the 1.6M+ agents on Moltbook could install the Fighter Skill and challenge our agent
- Our agent can post match results, tournament standings, and trash talk to Moltbook
- The system is composable — other builders could create new game types that plug into our registry and escrow
- It's not a closed demo; it's open infrastructure

---

## The Differentiator: Prediction Market Layer (Bonus)

On top of the core fighter, we add a prediction market that auto-deploys for each match. Spectator agents can bet on the outcome in real-time as rounds progress. This creates a layered economy: fighters wager on themselves, spectators wager on fighters, and MON flows through the system.

---

## What Success Looks Like

A judge watches the demo and sees an autonomous agent:

1. Start with a MON balance
2. Find opponents on-chain without human help
3. Choose which game type to play against which opponent based on strategic analysis
4. **In RPS:** Detect opponent patterns and exploit them aggressively
5. **In Poker:** Bluff with weak hands, value bet with strong hands, read opponent bet sizing tells
6. **In Auctions:** Shade bids strategically, use early rounds to gather intel, win prizes at efficient prices
7. **Across games:** Manage bankroll rationally — bigger bets where it has edge, smaller bets where uncertain
8. Compete in a tournament with rotating game types and escalating stakes
9. Adapt its strategy visibly across different opponents and game types
10. End with a larger MON balance and higher ELO rating than it started with
11. Every transaction verifiable on Monad testnet

The agent doesn't just play games. It bluffs, negotiates, learns, ranks up, and grows its bankroll. It operates as a fully autonomous economic competitor on Monad.
