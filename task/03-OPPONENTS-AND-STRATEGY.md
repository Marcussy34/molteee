# Task 03 — Phase 3: Opponents + RPS Strategy Engine

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for OpenClaw skills, web3.py, and any statistical libraries used. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 3
- **Name:** Opponents + RPS Strategy Engine
- **Status:** Not Started
- **Depends On:** Phase 2 (working fighter skill with basic RPS flow)
- **Blocks:** Phase 4, Phase 5

---

## Objectives

1. Build and deploy 5 opponent bots as standalone Python scripts (no OpenClaw needed)
2. Add RPS-specific strategy to the fighter's scripts: frequency analysis, Markov chains, sequence detection
3. Implement Kelly criterion bankroll management in `scripts/bankroll.py`
4. Add match selection logic (which opponent to challenge)
5. Update SKILL.md with strategy instructions for the LLM
6. Run a 5+ match gauntlet with positive overall win rate

---

## Prerequisites

- Phase 2 gate passed: fighter skill completes 1 autonomous RPS match via OpenClaw
- 5 funded opponent wallets from Phase 1
- All 3 core contracts deployed and working on Monad testnet

---

## Scope

### In Scope

- 5 opponent bots (standalone Python scripts, RPS strategies only for now)
- Opponent base template (shared registration, challenge acceptance, escrow interaction)
- Individual opponent strategies: Rock, Gambler, Mirror, Random, Counter
- Fighter strategy scripts: frequency analysis, Markov chain prediction, sequence detection
- Kelly criterion bankroll management script
- Match selection logic in the CLI dispatcher
- Cross-match opponent memory (persist model to local file)
- Updated SKILL.md and `references/rps-strategy.md`

### Out of Scope

- Opponent poker/auction strategies (Phase 4–5)
- Cross-game profiling (Phase 5)
- Tournament play (Phase 6)
- Psychological tactics (Phase 7)

---

## Tasks

### Task 3.1 — Opponent Bot Base Template

- **Description:** Create a reusable Python bot template at `opponents/base.py`. The bot: registers on AgentRegistry, listens for incoming challenges (polls contract state), accepts matches within wager range, plays RPS via commit-reveal, and settles. Each opponent variant subclasses and overrides `choose_move(history) → move`. The bot runs as a long-lived Python process.
- **Owner:** —
- **Acceptance Criteria:**
  - Base template handles full match lifecycle autonomously
  - Strategy is pluggable via a single method override
  - Bot registers, listens, accepts, plays, and settles without intervention
  - Logging shows bot name, move chosen, result

### Task 3.2 — The Rock (Conservative Opponent)

- **Description:** Plays rock 70%, paper 20%, scissors 10%. Small wager range. Highly predictable, easy to exploit.
- **Owner:** —
- **Acceptance Criteria:**
  - Runs on its own wallet
  - Registered on AgentRegistry as open to RPS challenges
  - Move distribution matches specification over 20+ rounds
  - Accepts only low-wager matches

### Task 3.3 — The Gambler (Aggressive Opponent)

- **Description:** Uniformly random moves but accepts large wagers. High variance. Neutral EV opponent.
- **Owner:** —
- **Acceptance Criteria:**
  - Runs on its own wallet, registered with high max wager
  - Moves are uniformly distributed
  - Accepts large wager challenges eagerly

### Task 3.4 — The Mirror (Reactive Opponent)

- **Description:** Tit-for-tat — plays whatever the opponent played last round. First round is random. Exploitable by playing the counter to your own last move.
- **Owner:** —
- **Acceptance Criteria:**
  - First move is random
  - Subsequent moves copy the opponent's previous move
  - Pattern holds consistently

### Task 3.5 — The Random (Baseline Opponent)

- **Description:** Pure random moves every round. True 33/33/33 distribution. Baseline — fighter should roughly break even.
- **Owner:** —
- **Acceptance Criteria:**
  - Move distribution is statistically uniform
  - Serves as baseline for win rate comparison

### Task 3.6 — The Counter (Sophisticated Opponent)

- **Description:** Tracks the fighter's move frequency across rounds. Plays the counter to the fighter's most common move. Recomputes after each round. Forces the fighter to mix strategies.
- **Owner:** —
- **Acceptance Criteria:**
  - Tracks opponent move history within a match
  - Correctly identifies most-frequent move and counters it
  - Adjusts in real-time as the match progresses

### Task 3.7 — Deploy All Opponents

- **Description:** Run all 5 opponent bots on Monad testnet, each on its own wallet. Register all on AgentRegistry. Can run as separate processes or a single multi-bot script. Verify all are discoverable.
- **Owner:** —
- **Acceptance Criteria:**
  - 5 opponents registered on AgentRegistry
  - All show as "open to challenge" for RPS
  - Each has sufficient MON
  - Fighter's `arena.py discover` returns all 5

### Task 3.8 — Fighter Strategy: Frequency Analysis

- **Description:** Create `scripts/strategy.py` with move frequency tracking. Count opponent's rock/paper/scissors frequencies across rounds. Return the counter to the most frequent move. Detect and exploit skewed distributions.
- **Owner:** —
- **Acceptance Criteria:**
  - Frequency table updated after each round
  - Counter-move selected based on most frequent opponent move
  - Win rate against The Rock exceeds 60% over 10+ rounds

### Task 3.9 — Fighter Strategy: Markov Chain Prediction

- **Description:** Add first-order Markov chain to `scripts/strategy.py`. Build transition matrix from opponent move sequences (e.g., P(rock → paper)). Predict next move based on last move's transitions. Counter the most likely next move.
- **Owner:** —
- **Acceptance Criteria:**
  - Transition probability matrix computed and updated per round
  - Prediction selects highest-probability next move
  - Effective against The Mirror (detects tit-for-tat)

### Task 3.10 — Fighter Strategy: Sequence Detection

- **Description:** Add pattern detection to `scripts/strategy.py`. Detect repeating cycles (R→P→S→R), win-stay/lose-shift, and conditional patterns (move after win vs. after loss). Use sliding window for recent behavior.
- **Owner:** —
- **Acceptance Criteria:**
  - Cycle detection identifies repeating sequences
  - Win-stay/lose-shift detection works
  - Conditional pattern detection works
  - Recent behavior weighted over historical

### Task 3.11 — Fighter Strategy: Anti-Exploitation

- **Description:** When the fighter detects its own strategy is being countered (win rate drops below threshold), inject randomness. Targets The Counter opponent. If recent win rate < 40%, switch to random for N rounds before re-engaging.
- **Owner:** —
- **Acceptance Criteria:**
  - Win rate monitoring detects when fighter is being exploited
  - Random fallback activates at configurable threshold
  - Fighter doesn't lose money against The Counter over 20+ rounds
  - Re-engages adaptive strategy after cooldown

### Task 3.12 — Fighter Strategy: Combined Selector

- **Description:** Combine all strategy signals (frequency, Markov, sequence) into one move decision. Confidence-based: if Markov has high confidence, use it; if sequence detected, use sequence; otherwise frequency. Log which strategy was used for each move.
- **Owner:** —
- **Acceptance Criteria:**
  - Multiple signals combined into one move
  - Higher-confidence strategies take priority
  - Strategy selection logged per round

### Task 3.13 — Update `arena.py play-rps` to Use Strategy

- **Description:** Modify the RPS play script to call `strategy.py` instead of choosing random moves. Pass opponent history to the strategy module, get recommended move back. The match script now plays strategically.
- **Owner:** —
- **Acceptance Criteria:**
  - `play-rps` uses strategy module for move selection
  - Strategy reasoning included in script output
  - LLM can see which strategy was used via output

### Task 3.14 — Kelly Criterion Bankroll Management

- **Description:** Create `scripts/bankroll.py`. Before each match, estimate win probability against specific opponent (from history or default). Apply Kelly: `f* = (bp - q) / b`. Cap at max % of bankroll. Hard floor: if bankroll drops below threshold, minimum wagers only. Add `arena.py recommend <opponent>` command that returns recommended wager size.
- **Owner:** —
- **Acceptance Criteria:**
  - Wager size varies based on estimated edge
  - High-edge opponents (Rock) get larger wagers
  - Unknown opponents get smaller wagers
  - Never risks beyond max % per match
  - Loss-recovery mode when bankroll drops low

### Task 3.15 — Match Selection Logic

- **Description:** Add `arena.py select-match` command. Calculates EV for each available opponent: `EV = P(win) × payout - P(loss) × wager`. Returns ranked list. The LLM uses this to decide who to challenge.
- **Owner:** —
- **Acceptance Criteria:**
  - EV calculated for each opponent
  - Ranked by expected value
  - Selection reasoning in output
  - Negative EV matches flagged

### Task 3.16 — Opponent Memory Persistence

- **Description:** Save opponent models (frequency tables, Markov chains, patterns) to a local JSON file after each match. Load on next match against same opponent. Detect strategy changes between matches.
- **Owner:** —
- **Acceptance Criteria:**
  - Model persists across matches in a local file
  - Second match starts with prior data
  - Strategy change detection triggers model reset if behavior shifts

### Task 3.17 — Update SKILL.md with Strategy Instructions

- **Description:** Update the fighter SKILL.md to teach the LLM about strategy and bankroll management. Add instructions for: using `select-match` to pick opponents, using `recommend` to size wagers, interpreting strategy output, deciding when to stop playing (if bankroll is low). Create `references/rps-strategy.md` with detailed strategy documentation the LLM can read when needed.
- **Owner:** —
- **Acceptance Criteria:**
  - SKILL.md includes strategy and bankroll workflow
  - LLM can use match selection and wager sizing autonomously
  - `references/rps-strategy.md` explains all strategy modules

### Task 3.18 — Gauntlet Test Run via OpenClaw

- **Description:** Run the fighter via OpenClaw against all 5 opponents. Tell the agent to "play matches against all available opponents and maximize your bankroll." The LLM should: discover opponents, use match selection, size wagers, play strategically, persist models. Verify positive overall win rate.
- **Owner:** —
- **Acceptance Criteria:**
  - 5+ matches completed against all 5 opponents via OpenClaw
  - Overall win rate > 50%
  - Win rate against The Rock > 60%
  - Win rate against The Random ≈ 50%
  - Win rate against The Counter ≥ 45% (not exploited)
  - Bankroll positive or neutral after gauntlet
  - Full results log saved

---

## Deliverables

1. 5 opponent bots running on Monad testnet (standalone Python scripts)
2. RPS strategy module (`scripts/strategy.py`)
3. Bankroll management module (`scripts/bankroll.py`)
4. Match selection logic in CLI dispatcher
5. Updated SKILL.md with strategy and bankroll instructions
6. `references/rps-strategy.md`
7. Gauntlet test results

---

## Test / Acceptance Criteria

- All 5 opponents registered and discoverable on Monad testnet
- Fighter wins >50% overall across 5+ matches via OpenClaw
- Bankroll management prevents ruin
- Strategy adapts visibly per opponent

---

## Gate Checklist

- [ ] 5 opponent bots deployed and registered
- [ ] RPS frequency analysis working
- [ ] Markov chain prediction working
- [ ] Sequence detection working
- [ ] Anti-exploitation activates against The Counter
- [ ] Strategy selector combines signals correctly
- [ ] Kelly criterion wager sizing implemented
- [ ] Match selection picks highest EV opponent
- [ ] Opponent memory persists across matches
- [ ] SKILL.md updated with strategy workflow
- [ ] 5+ match gauntlet completed via OpenClaw with >50% win rate
- [ ] Bankroll positive or neutral after gauntlet
