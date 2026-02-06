# Task 03 — Phase 3: Opponents + RPS Strategy Engine

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for OpenClaw SDK, ethers.js, and any statistical/ML libraries used. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 3
- **Name:** Opponents + RPS Strategy Engine
- **Status:** Not Started
- **Depends On:** Phase 2 (working fighter agent with basic RPS flow)
- **Blocks:** Phase 4, Phase 5

---

## Objectives

1. Build and deploy 5 opponent agents with distinct, exploitable RPS strategies
2. Add RPS-specific strategy engine to the fighter: frequency analysis, Markov chains, sequence detection
3. Implement Kelly criterion bankroll management
4. Add match selection logic (which opponent to challenge)
5. Run a 5+ match gauntlet with positive overall win rate

---

## Prerequisites

- Phase 2 gate passed: fighter agent completes 1 autonomous RPS match
- 5 funded opponent wallets from Phase 1
- All 3 core contracts deployed and working on Monad testnet

---

## Scope

### In Scope

- 5 opponent agents (RPS strategies only for now — poker/auction added in Phase 4–5)
- Opponent base template (shared registration, match acceptance, escrow interaction)
- Individual opponent strategies: Rock, Gambler, Mirror, Random, Counter
- RPS strategy engine: frequency analysis, Markov chain prediction, sequence detection, anti-exploitation
- Kelly criterion bankroll management
- Match selection logic (expected value calculation)
- Cross-match opponent memory (persist model between matches)

### Out of Scope

- Opponent poker/auction strategies (Phase 4–5)
- Cross-game profiling (Phase 5)
- Tournament play (Phase 6)
- Psychological tactics (Phase 7)

---

## Tasks

### Task 3.1 — Opponent Base Template

- **Description:** Create a reusable opponent agent template that handles: registration on AgentRegistry, listening for challenges, accepting matches within wager range, playing RPS via commit-reveal, and settling. Each opponent variant only needs to override the `chooseMove()` function.
- **Owner:** —
- **Acceptance Criteria:**
  - Base template handles full match lifecycle
  - Strategy is pluggable via a single function override
  - Template handles registration, event listening, escrow interaction
  - Logging shows opponent name, move chosen, result

### Task 3.2 — The Rock (Conservative Opponent)

- **Description:** Plays rock 70% of the time, paper 20%, scissors 10%. Small wager range. Highly predictable, easy to exploit once detected.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed on its own wallet
  - Registered on AgentRegistry as open to RPS challenges
  - Move distribution matches specification over 20+ rounds
  - Accepts only low-wager matches

### Task 3.3 — The Gambler (Aggressive Opponent)

- **Description:** Uniformly random moves but accepts large wagers. High variance. Represents a pure-chance opponent that is neutral EV but volatile.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed on its own wallet
  - Registered with high max wager
  - Moves are uniformly distributed (within statistical tolerance)
  - Accepts large wager challenges eagerly

### Task 3.4 — The Mirror (Reactive Opponent)

- **Description:** Tit-for-tat strategy — plays whatever the opponent played last round. First round is random. Exploitable once the pattern is detected (play the counter to your own last move).
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed on its own wallet
  - First move is random
  - Subsequent moves copy the opponent's previous move
  - Pattern holds consistently across matches

### Task 3.5 — The Random (Baseline Opponent)

- **Description:** Pure random moves every round. True 33/33/33 distribution. This is the baseline — the fighter should beat randomness through any non-trivial strategy (though margins will be thin).
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed on its own wallet
  - Move distribution is statistically uniform
  - Serves as baseline for win rate comparison

### Task 3.6 — The Counter (Sophisticated Opponent)

- **Description:** Tracks the fighter's move frequency across rounds. Plays the counter to the fighter's most common move. Recomputes after each round. This opponent punishes predictable play and forces the fighter to mix strategies.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed on its own wallet
  - Tracks opponent move history within a match
  - Correctly identifies most-frequent move and counters it
  - Adjusts in real-time as the match progresses

### Task 3.7 — Deploy All Opponents

- **Description:** Deploy all 5 opponent agents on Monad testnet, each on its own wallet. Register all on AgentRegistry. Verify all are discoverable and accepting challenges.
- **Owner:** —
- **Acceptance Criteria:**
  - 5 opponents registered on AgentRegistry
  - All show as "open to challenge" for RPS
  - Each has a funded wallet with sufficient MON
  - Fighter agent's discovery scan returns all 5

### Task 3.8 — RPS Frequency Analysis

- **Description:** Add move frequency tracking to the fighter's RPS strategy. Count opponent's rock/paper/scissors frequencies across rounds. Play the counter to the most frequent move. Detect and exploit skewed distributions (like The Rock's 70% rock).
- **Owner:** —
- **Acceptance Criteria:**
  - Frequency table updated after each round
  - Counter-move selected based on most frequent opponent move
  - Win rate against The Rock exceeds 60% over 10+ rounds

### Task 3.9 — Markov Chain Prediction

- **Description:** Build a first-order Markov chain from opponent move transitions (e.g., P(rock → paper), P(rock → scissors)). Predict the opponent's next move based on their last move's transition probabilities. Play the counter to the most likely next move.
- **Owner:** —
- **Acceptance Criteria:**
  - Transition probability matrix computed and updated per round
  - Prediction selects highest-probability next move
  - Effective against The Mirror (detects tit-for-tat pattern)

### Task 3.10 — Sequence Detection

- **Description:** Detect repeating cycles (e.g., R→P→S→R), win-stay/lose-shift patterns, and conditional patterns (e.g., always plays rock after losing). Use a sliding window to identify recent patterns that may differ from overall frequency.
- **Owner:** —
- **Acceptance Criteria:**
  - Cycle detection identifies repeating move sequences
  - Win-stay/lose-shift detection works
  - Conditional pattern detection (move after win vs. after loss) works
  - Predictions weighted toward recent behavior when patterns are detected

### Task 3.11 — Anti-Exploitation (Defensive Mixing)

- **Description:** When the fighter detects that its own strategy is being countered (win rate drops below expected), inject randomness to become unpredictable. Specifically targets The Counter opponent. Use a threshold: if recent win rate drops below 40%, switch to random play for N rounds before re-engaging adaptive strategy.
- **Owner:** —
- **Acceptance Criteria:**
  - Win rate monitoring detects when fighter is being exploited
  - Random fallback activates at configurable threshold
  - Fighter doesn't lose money against The Counter over 20+ rounds
  - Re-engages adaptive strategy after random cooldown

### Task 3.12 — Strategy Selector

- **Description:** Combine all strategy signals (frequency, Markov, sequence) into a single move decision. Use a weighted vote or confidence-based selection: if Markov chain has high confidence (one transition dominates), use it; if sequence is detected, use sequence prediction; otherwise fall back to frequency countering.
- **Owner:** —
- **Acceptance Criteria:**
  - Multiple strategy signals combined into one move
  - Higher-confidence strategies take priority
  - Strategy selection logged for each round (visible in output)

### Task 3.13 — Kelly Criterion Bankroll Management

- **Description:** Before each match, estimate win probability against the specific opponent (based on historical data or default). Apply Kelly criterion: `f* = (bp - q) / b` where b = net odds, p = win probability, q = 1-p. Cap wager at a max % of total bankroll. Implement hard floor (minimum bankroll threshold below which only minimum wagers are allowed).
- **Owner:** —
- **Acceptance Criteria:**
  - Wager size varies based on estimated edge
  - High-edge opponents (The Rock) get larger wagers
  - Uncertain opponents (new/unknown) get smaller wagers
  - Bankroll never risked beyond max % per match
  - Loss-recovery mode activates when bankroll drops below threshold

### Task 3.14 — Match Selection Logic

- **Description:** When multiple opponents are available, calculate expected value for each: `EV = P(win) × potential_payout - P(loss) × wager`. Select the match with highest EV. Factor in opponent ELO, historical win rate, and wager range.
- **Owner:** —
- **Acceptance Criteria:**
  - EV calculated for each available opponent
  - Agent selects highest-EV match
  - Selection reasoning logged
  - Agent declines matches with negative EV

### Task 3.15 — Cross-Match Opponent Memory

- **Description:** Persist opponent models between matches. When facing the same opponent again, start with the existing frequency table, Markov chain, and pattern data. Detect if opponent has changed strategy between matches.
- **Owner:** —
- **Acceptance Criteria:**
  - Opponent model persists across matches
  - Second match against same opponent starts with prior data
  - Strategy change detection triggers model reset if opponent behavior shifts significantly

### Task 3.16 — Gauntlet Test Run

- **Description:** Run the fighter agent against all 5 opponents in sequence (at least 5 matches total, one per opponent). Verify positive overall win rate. Log all results: opponent, moves, wagers, outcomes, bankroll changes, strategy used.
- **Owner:** —
- **Acceptance Criteria:**
  - 5+ matches completed against all 5 opponents
  - Overall win rate > 50%
  - Win rate against The Rock > 60%
  - Win rate against The Random ≥ ~50% (can't reliably beat pure random)
  - Win rate against The Counter ≥ ~45% (not exploited)
  - Bankroll is positive or neutral after the gauntlet
  - Full results log saved

---

## Deliverables

1. 5 opponent agents deployed on Monad testnet
2. RPS strategy engine (frequency, Markov, sequence, anti-exploit)
3. Kelly criterion bankroll management module
4. Match selection logic
5. Gauntlet test results log

---

## Test / Acceptance Criteria

- All 5 opponents registered and discoverable on Monad testnet
- Fighter wins >50% overall across 5+ matches
- Bankroll management prevents ruin
- Strategy adapts visibly per opponent (different move distributions vs. different opponents)

---

## Gate Checklist

- [ ] 5 opponent agents deployed and registered
- [ ] RPS frequency analysis working
- [ ] Markov chain prediction working
- [ ] Sequence detection working
- [ ] Anti-exploitation activates against The Counter
- [ ] Strategy selector combines signals correctly
- [ ] Kelly criterion wager sizing implemented
- [ ] Match selection picks highest EV opponent
- [ ] Cross-match opponent memory persists
- [ ] 5+ match gauntlet completed with >50% win rate
- [ ] Bankroll positive or neutral after gauntlet
