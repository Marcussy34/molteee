# Task 04 — Phase 4: Poker Game Contract + Strategy

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Solidity, web3.py, and poker game design patterns. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 4
- **Name:** Poker Game Contract + Strategy
- **Status:** Not Started
- **Depends On:** Phase 3 (opponents deployed, RPS strategy working)
- **Blocks:** Phase 5 (cross-game profiling needs poker data)

---

## Objectives

1. Write, test, and deploy PokerGame.sol on Monad testnet
2. Build poker strategy scripts: bluffing, value betting, bet sizing tells, fold threshold modeling
3. Update opponent bots with poker-specific strategies
4. Add poker commands to the CLI dispatcher
5. Update SKILL.md with poker instructions
6. Run poker matches demonstrating bluffing on-chain

---

## Prerequisites

- Phase 3 gate passed: 5 opponents deployed, RPS strategy working, bankroll management active
- Escrow contract supports poker settlement
- AgentRegistry supports "poker" game type

---

## Scope

### In Scope

- PokerGame.sol — simplified heads-up poker (commit-reveal hands, betting rounds, fold/showdown)
- Poker strategy scripts for fighter
- Poker strategies added to all 5 opponent bots
- Integration with existing Escrow and AgentRegistry
- New CLI commands: `arena.py play-poker <opponent> <wager>`
- Updated SKILL.md and `references/poker-strategy.md`
- End-to-end poker matches on Monad testnet via OpenClaw

### Out of Scope

- Auction game (Phase 5)
- Cross-game profiling (Phase 5)
- Tournament bracket play (Phase 6)

---

## Tasks

### Task 4.1 — Design Simplified Poker Mechanics

- **Description:** Define the exact poker variant for on-chain play. Recommended: each player commits a hand value (integer 1–100, hand strength) via hash. Betting rounds alternate: check/bet/raise/fold, each on-chain tx. If neither folds, both reveal — higher value wins pot. If one folds, other wins without revealing. Define action set, bet limits, and round structure.
- **Owner:** —
- **Acceptance Criteria:**
  - Game mechanics documented
  - Actions and on-chain representation defined
  - Commit-reveal scheme specified
  - Edge cases defined: both fold, timeout, min/max raise

### Task 4.2 — Write PokerGame.sol

- **Description:** Implement the poker game contract. Flow: both commit hand hash → betting round 1 → optional round 2 → showdown or fold. Tracks pot, enforces bet limits, validates reveals. Calls Escrow to settle and AgentRegistry to update ELO/history.
- **Owner:** —
- **Acceptance Criteria:**
  - Compiles with `forge build`
  - Commit-reveal for hands works
  - All betting actions work (check, bet, raise, fold)
  - Pot tracking accurate
  - Fold wins without reveal
  - Showdown resolves correctly
  - Timeout forfeits
  - Integrates with Escrow and AgentRegistry

### Task 4.3 — Foundry Tests for PokerGame

- **Description:** Tests: full showdown, fold win, raise sequences, timeout, invalid reveal, pot math, Escrow integration.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all poker tests
  - Integration test with Escrow settlement

### Task 4.4 — Deploy PokerGame to Monad Testnet

- **Description:** Deploy PokerGame.sol. Configure with Escrow and AgentRegistry. Authorize for settlement and ELO updates. Update `lib/contracts.py` with new ABI and address.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed, address recorded
  - Cross-contract references configured
  - `lib/contracts.py` updated with poker ABI and address

### Task 4.5 — Poker Play Script (`scripts/play_poker.py`)

- **Description:** Create `scripts/play_poker.py` (called via `arena.py play-poker <opponent> <wager>`). Handles: escrow creation, hand value generation, commit, betting rounds (decide action per round), reveal/fold, settlement. Uses strategy module for decisions.
- **Owner:** —
- **Acceptance Criteria:**
  - Full poker match lifecycle in one script call
  - Betting actions decided by strategy module
  - Reports round-by-round actions and final result
  - Handles timeout and opponent fold gracefully

### Task 4.6 — Poker Strategy: Hand Evaluation

- **Description:** Add poker strategy to `scripts/strategy.py`. Given hand value (1–100), categorize: weak (1–30), medium (31–60), strong (61–85), premium (86–100). Strategy branches based on category.
- **Owner:** —
- **Acceptance Criteria:**
  - Categorization correct
  - Categories inform bet/fold/bluff decisions

### Task 4.7 — Poker Strategy: Bluff Decision Engine

- **Description:** Calculate bluff EV: `EV = P(fold) × pot - P(call) × bet_size`. Bluff when EV > 0. Estimate fold probability from opponent model or default. Bluff more vs. conservative, less vs. calling stations.
- **Owner:** —
- **Acceptance Criteria:**
  - Bluff EV calculated before each bluff decision
  - Positive EV bluffs attempted, negative avoided
  - Fold probability adjusts per opponent
  - Bluff decisions logged

### Task 4.8 — Poker Strategy: Value Betting

- **Description:** With strong/premium hands, size bets to maximize extraction. Smaller bets vs. aggressive opponents (induce raises), bigger vs. passive (they only call).
- **Owner:** —
- **Acceptance Criteria:**
  - Bet sizing varies by hand strength and opponent type
  - Value bets extract more from calling opponents

### Task 4.9 — Poker Strategy: Fold Threshold Modeling

- **Description:** Model what bet size causes each opponent to fold. Track fold decisions vs. bet/pot size. Calibrate bluff sizing to just exceed fold threshold.
- **Owner:** —
- **Acceptance Criteria:**
  - Fold threshold estimated per opponent
  - Bluff sizes calibrated accordingly
  - Model updates with new data

### Task 4.10 — Poker Strategy: Bet Sizing Tells + Reverse Tells

- **Description:** Detect if opponent bets differently with strong vs. weak hands. Track bet-size/hand-strength correlation. For reverse tells: vary fighter's own sizing to create false patterns.
- **Owner:** —
- **Acceptance Criteria:**
  - Tell detection flags exploitable patterns
  - Fighter adjusts call/fold based on tells
  - Reverse tells introduce strategic variation

### Task 4.11 — Opponent Poker Strategies

- **Description:** Add poker play to each opponent bot:
  - **Rock:** Folds to any bet > 20% pot. Only bets premium. Never bluffs.
  - **Gambler:** Bluffs 50%. Raises aggressively. Calls everything.
  - **Mirror:** Matches opponent's last bet size.
  - **Random:** Random actions.
  - **Counter:** Tracks fighter bluff frequency, calls more if fighter bluffs often.
- **Owner:** —
- **Acceptance Criteria:**
  - Each opponent implements poker strategy matching personality
  - All register "poker" as supported game type

### Task 4.12 — Update SKILL.md with Poker Instructions

- **Description:** Add poker workflow to SKILL.md: when to play poker vs. RPS, how to call `play-poker`, how to interpret bluff/value bet output. Create `references/poker-strategy.md` with detailed poker strategy docs.
- **Owner:** —
- **Acceptance Criteria:**
  - SKILL.md covers poker match flow
  - LLM can decide between RPS and poker based on opponent
  - `references/poker-strategy.md` complete

### Task 4.13 — End-to-End Poker Test via OpenClaw

- **Description:** Run poker matches against all 5 opponents via OpenClaw. Verify bluffing succeeds against The Rock, value betting works against The Gambler.
- **Owner:** —
- **Acceptance Criteria:**
  - At least 2 successful bluffs on-chain
  - Value betting demonstrated
  - Poker matches complete E2E on Monad testnet
  - ELO updates for poker

---

## Deliverables

1. PokerGame.sol deployed to Monad testnet
2. Poker strategy in `scripts/strategy.py`
3. Poker play script (`scripts/play_poker.py`)
4. Poker strategies in all 5 opponent bots
5. Updated SKILL.md + `references/poker-strategy.md`
6. Poker match results log

---

## Test / Acceptance Criteria

- PokerGame deployed and working on Monad testnet
- Fighter plays poker via OpenClaw autonomously
- At least 2 successful bluffs on-chain
- Poker integrated into match selection alongside RPS

---

## Gate Checklist

- [ ] PokerGame.sol compiles, tests pass
- [ ] Deployed to Monad testnet
- [ ] `lib/contracts.py` updated with poker ABI/address
- [ ] `scripts/play_poker.py` handles full match lifecycle
- [ ] Bluffing demonstrated on-chain (2+ successful bluffs)
- [ ] Value betting works against aggressive opponents
- [ ] Fold threshold modeling informs bluff sizing
- [ ] All 5 opponents have poker strategies
- [ ] SKILL.md updated with poker workflow
- [ ] Bankroll management applies to poker matches
- [ ] ELO updates correctly for poker
