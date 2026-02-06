# Task 04 — Phase 4: Poker Game Contract + Strategy

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Solidity, and any poker-related design patterns. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 4
- **Name:** Poker Game Contract + Strategy
- **Status:** Not Started
- **Depends On:** Phase 3 (opponents deployed, RPS strategy working)
- **Blocks:** Phase 5 (cross-game profiling needs poker data)

---

## Objectives

1. Write, test, and deploy the PokerGame.sol contract on Monad testnet
2. Build the poker strategy module for the fighter: bluffing, value betting, bet sizing tells, fold threshold modeling
3. Update opponent agents with poker-specific strategies
4. Run poker matches demonstrating bluffing on-chain
5. Integrate poker into the fighter's game type roster

---

## Prerequisites

- Phase 3 gate passed: 5 opponents deployed, RPS strategy working, bankroll management active
- Escrow contract supports poker settlement
- AgentRegistry supports "poker" game type

---

## Scope

### In Scope

- PokerGame.sol — simplified heads-up poker (commit-reveal hands, betting rounds, fold/showdown)
- Poker strategy module for fighter agent
- Poker strategies for all 5 opponent agents
- Integration with existing Escrow and AgentRegistry
- End-to-end poker matches on Monad testnet

### Out of Scope

- Auction game (Phase 5)
- Cross-game profiling (Phase 5)
- Tournament bracket play (Phase 6)
- Complex hand rankings (keep it simplified)

---

## Tasks

### Task 4.1 — Design Simplified Poker Mechanics

- **Description:** Define the exact poker variant for on-chain play. Recommended: each player commits a hand value (integer 1–100, representing hand strength) via hash. Betting rounds alternate: check/bet/raise/fold, each is an on-chain tx. If neither folds, both reveal hands and higher value wins the pot. If one folds, other wins without revealing. Keep it simple enough for on-chain but complex enough to support bluffing.
- **Owner:** —
- **Acceptance Criteria:**
  - Game mechanics documented (hand generation, betting round structure, showdown rules)
  - Clear definition of actions and their on-chain representation
  - Commit-reveal scheme for hand values specified
  - Edge cases defined: both fold, timeout during betting, min/max raise rules

### Task 4.2 — Write PokerGame.sol

- **Description:** Implement the poker game contract. Flow: both players commit hand hash → betting round 1 (Player A acts, Player B responds) → optional betting round 2 → showdown (both reveal) or fold (one player wins). Contract tracks pot size, enforces bet limits, validates reveals. On completion, calls Escrow to settle and AgentRegistry to update ELO/history.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Commit-reveal for hand values works
  - Betting round actions (check, bet, raise, fold) all work
  - Pot tracking is accurate
  - Fold → winner gets pot without reveal
  - Showdown → higher hand wins
  - Timeout → acting player forfeits
  - Integrates with Escrow and AgentRegistry

### Task 4.3 — Foundry Tests for PokerGame

- **Description:** Write comprehensive tests: happy path (full game to showdown), bluff fold (one player folds to a bet), raise war, timeout during betting, invalid reveal, pot calculation accuracy. Test integration with Escrow settlement.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all poker tests
  - Coverage: showdown win, fold win, raise sequences, timeouts, invalid moves
  - Integration test with Escrow: correct MON distribution after poker game

### Task 4.4 — Deploy PokerGame to Monad Testnet

- **Description:** Deploy PokerGame.sol to Monad testnet. Configure it with Escrow and AgentRegistry addresses. Register "poker" as a supported game type in the registry system. Authorize PokerGame to call Escrow settle and Registry updateELO.
- **Owner:** —
- **Acceptance Criteria:**
  - PokerGame deployed and address recorded
  - Cross-contract references configured
  - PokerGame authorized to settle escrows and update ELO
  - `cast call` returns expected contract state

### Task 4.5 — Fighter Poker Strategy: Hand Evaluation

- **Description:** Given the fighter's hand value (1–100), categorize hand strength: weak (1–30), medium (31–60), strong (61–85), premium (86–100). Strategy decisions branch based on hand category.
- **Owner:** —
- **Acceptance Criteria:**
  - Hand strength categorization works correctly
  - Categories inform subsequent strategy decisions
  - Logged clearly (e.g., "Hand: 72 — Strong")

### Task 4.6 — Fighter Poker Strategy: Bluff Decision Engine

- **Description:** Implement bluff EV calculation: `EV(bluff) = P(opponent folds) × pot - P(opponent calls) × bet_size`. If EV > 0, bluff. Estimate fold probability from opponent model (if available) or use default. Bluff more against conservative opponents, less against calling stations.
- **Owner:** —
- **Acceptance Criteria:**
  - Bluff EV calculated before each bluff decision
  - Positive EV bluffs are attempted
  - Negative EV bluffs are avoided
  - Fold probability adjusts per opponent (if model exists)
  - Bluff frequency logged

### Task 4.7 — Fighter Poker Strategy: Value Betting

- **Description:** With strong/premium hands, size bets to maximize extraction. Against aggressive opponents, bet smaller to induce raises. Against passive opponents, bet bigger since they only call. Track how much the opponent has called in previous hands to calibrate sizing.
- **Owner:** —
- **Acceptance Criteria:**
  - Bet sizing varies based on hand strength and opponent type
  - Value bets extract more MON from calling opponents
  - Sizing adapts based on observed opponent behavior

### Task 4.8 — Fighter Poker Strategy: Fold Threshold Modeling

- **Description:** Model what bet size causes each opponent to fold. Track fold decisions relative to bet size and pot size. Conservative opponents fold to small bets; aggressive opponents rarely fold. Use this model to calibrate bluff sizing.
- **Owner:** —
- **Acceptance Criteria:**
  - Fold threshold estimated per opponent
  - Bluff sizes calibrated to just exceed fold threshold
  - Model updates as more data is collected

### Task 4.9 — Fighter Poker Strategy: Bet Sizing Tells

- **Description:** Detect if opponent bets differently with strong vs. weak hands. Track correlation between opponent's bet sizes and revealed hand strengths. If a tell is detected, use it to inform call/fold decisions.
- **Owner:** —
- **Acceptance Criteria:**
  - Bet size vs. hand strength correlation tracked
  - Tell detection flags when correlation exceeds threshold
  - Fighter adjusts decisions based on detected tells

### Task 4.10 — Fighter Poker Strategy: Reverse Tells

- **Description:** Vary the fighter's own bet sizing to create false patterns. Occasionally bet small with strong hands, bet big with weak hands (strategic misdirection). Prevent opponents from reading the fighter's sizing patterns.
- **Owner:** —
- **Acceptance Criteria:**
  - Bet sizing includes deliberate variation
  - Pattern is not exploitable by a simple bet-size tracker
  - Reverse tells logged when used

### Task 4.11 — Opponent Poker Strategies

- **Description:** Add poker strategies to each of the 5 opponents:
  - **Rock:** Folds to any bet > 20% of pot. Only bets with premium hands. Never bluffs.
  - **Gambler:** Bluffs 50% of the time. Raises aggressively. Calls everything. High variance.
  - **Mirror:** Matches opponent's last bet size. If opponent checked, checks. Reactive.
  - **Random:** Random actions (check/bet/fold equally weighted). Baseline.
  - **Counter:** Tracks fighter's bluff frequency. If fighter bluffs often, calls more. If fighter value bets, folds more.
- **Owner:** —
- **Acceptance Criteria:**
  - Each opponent implements poker strategy matching their personality
  - Strategies are consistent with their RPS personalities
  - All opponents register "poker" as supported game type

### Task 4.12 — Poker Integration in Fighter Main Loop

- **Description:** Update the fighter's main loop to support poker in addition to RPS. When scanning for matches, include poker-capable opponents. Match selection logic considers poker EV alongside RPS EV. The agent can now play either game type.
- **Owner:** —
- **Acceptance Criteria:**
  - Fighter can play both RPS and poker matches
  - Match selection considers both game types
  - Poker matches flow: escrow → hand commit → betting → showdown/fold → settle
  - Bankroll management applies Kelly criterion to poker matches too

### Task 4.13 — End-to-End Poker Test

- **Description:** Run poker matches against all 5 opponents on Monad testnet. Verify: bluffing succeeds against The Rock (who always folds), value betting works against The Gambler (who always calls), bet sizing tells detected against predictable opponents.
- **Owner:** —
- **Acceptance Criteria:**
  - At least 1 successful bluff on-chain (opponent folded, fighter had weak hand)
  - Value betting demonstrated against The Gambler
  - Poker matches complete E2E on Monad testnet
  - Escrow settles correctly for poker
  - ELO updates for poker game type

---

## Deliverables

1. PokerGame.sol deployed to Monad testnet
2. Poker strategy module for fighter (bluff, value bet, fold modeling, tells, reverse tells)
3. Poker strategies for all 5 opponents
4. Poker match results log

---

## Test / Acceptance Criteria

- PokerGame contract deployed and working on Monad testnet
- Fighter completes poker matches against all 5 opponents
- At least 2 successful bluffs demonstrated on-chain
- Poker integrated into match selection alongside RPS

---

## Gate Checklist

- [ ] PokerGame.sol compiles and all Foundry tests pass
- [ ] PokerGame deployed to Monad testnet
- [ ] Fighter plays poker matches autonomously
- [ ] Bluffing demonstrated on-chain (at least 2 successful bluffs)
- [ ] Value betting works against aggressive opponents
- [ ] Fold threshold modeling informs bluff sizing
- [ ] All 5 opponents have poker strategies
- [ ] Poker integrated into fighter's match selection logic
- [ ] Bankroll management applies to poker matches
- [ ] ELO updates correctly for poker
