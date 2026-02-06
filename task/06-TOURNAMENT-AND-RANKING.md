# Task 06 — Phase 6: Tournament System + ELO Ranking

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Solidity, and ELO rating system formulas. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 6
- **Name:** Tournament System + ELO Ranking
- **Status:** Not Started
- **Depends On:** Phase 5 (all three game types working, cross-game profiling active)
- **Blocks:** Phase 7

---

## Objectives

1. Write, test, and deploy Tournament.sol on Monad testnet
2. Implement full ELO rating system in AgentRegistry (per-game + composite)
3. Run a full tournament bracket with game rotation and escalating stakes
4. Fighter agent navigates tournament brackets autonomously

---

## Prerequisites

- Phase 5 gate passed: RPS, Poker, and Auction all working, cross-game profiling active
- All 5 opponents support all 3 game types
- Escrow supports tournament-mode payouts

---

## Scope

### In Scope

- Tournament.sol — single-elimination bracket, game rotation, escalating stakes, prize distribution
- ELO rating system (per-game + composite)
- Fighter tournament navigation logic
- Tournament-specific bankroll strategy

### Out of Scope

- Psychological tactics (Phase 7)
- Advanced tournament formats: round-robin, double elimination (Phase 8)
- Prediction market (Phase 8)

---

## Tasks

### Task 6.1 — Design Tournament Structure

- **Description:** Define the on-chain tournament format. Single-elimination bracket. N agents register and lock entry fee. Random matchup generation (commit-reveal randomness for fairness). Configurable game type per round (e.g., quarterfinals = RPS, semifinals = poker, finals = auction). Escalating per-round wagers. Prize distribution: winner gets majority, runner-up gets portion, semifinalists get remainder.
- **Owner:** —
- **Acceptance Criteria:**
  - Tournament format fully specified
  - Bracket generation randomness mechanism defined
  - Game rotation per round documented
  - Escalating stake schedule defined
  - Prize distribution percentages defined
  - Edge cases: odd number of entrants (byes), timeout during tournament match, tie handling

### Task 6.2 — Write Tournament.sol

- **Description:** Implement the tournament contract. Functions: `createTournament()` (set entry fee, game types per round, stake schedule), `register()` (lock entry fee), `generateBracket()` (randomized matchups), `reportResult()` (advance winner), `distributePrizes()`. The contract orchestrates — individual matches still run through the game-specific contracts (RPSGame, PokerGame, AuctionGame) and Escrow.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Tournament creation with configurable parameters works
  - Agent registration locks entry fee
  - Bracket generation produces valid matchups
  - Result reporting advances winners correctly
  - Prize distribution pays correct amounts
  - Game type rotation per round enforced
  - Escalating stakes applied per round

### Task 6.3 — Foundry Tests for Tournament

- **Description:** Write tests: full 4-agent tournament (2 rounds), 8-agent tournament (3 rounds), bye handling, timeout during tournament match, prize distribution math, bracket generation randomness.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all tournament tests
  - Coverage: bracket generation, round progression, prize distribution, edge cases
  - Integration test: full tournament flow through game contracts and escrow

### Task 6.4 — Deploy Tournament to Monad Testnet

- **Description:** Deploy Tournament.sol. Configure with references to all game contracts, Escrow, and AgentRegistry. Authorize Tournament to create matches via game contracts.
- **Owner:** —
- **Acceptance Criteria:**
  - Tournament deployed and address recorded
  - All cross-contract references configured
  - Tournament authorized to interact with game contracts and Escrow

### Task 6.5 — ELO Rating System

- **Description:** Implement (or enhance existing) ELO rating in AgentRegistry. Each agent has per-game-type ELO (RPS, poker, auction) and a composite overall ELO (weighted average or separate calculation). ELO updates after every match using standard formula: `new_rating = old_rating + K * (actual - expected)` where expected is based on rating difference. K-factor: higher for new agents (faster convergence), lower for established agents.
- **Owner:** —
- **Acceptance Criteria:**
  - Per-game ELO stored and updated after each match
  - Composite ELO calculated from per-game ratings
  - Correct ELO math (beating higher-rated opponent gives more points)
  - K-factor adjusts based on number of matches played
  - ELO queryable on-chain
  - All existing matches retroactively update ELO (or start fresh)

### Task 6.6 — Fighter Tournament Logic

- **Description:** Add tournament-specific logic to the fighter agent. The agent should: detect open tournament registrations, evaluate entry fee vs. prize pool vs. field strength, register if EV-positive, navigate bracket matches (play the correct game type for each round), handle escalating stakes with bankroll management, adapt strategy knowing it's in a tournament context.
- **Owner:** —
- **Acceptance Criteria:**
  - Fighter detects and joins tournaments
  - Entry decision based on EV calculation
  - Plays correct game type per round
  - Escalating stakes handled by bankroll management
  - Tournament bracket navigation fully autonomous

### Task 6.7 — Tournament Bankroll Strategy

- **Description:** Adjust bankroll management for tournament context. In tournaments, the agent can't choose to decline mid-bracket. Budget the locked entry fee + escalating wagers across expected rounds. Be more conservative early (survive to later rounds) and more aggressive in finals (winner-take-most incentive).
- **Owner:** —
- **Acceptance Criteria:**
  - Tournament bankroll budgeted across expected rounds
  - Early rounds: conservative play
  - Later rounds: more aggressive (higher stakes, more at risk)
  - Strategy adapts to remaining bankroll within tournament

### Task 6.8 — Full Tournament Test

- **Description:** Run a full tournament on Monad testnet with the fighter + at least 3 opponents (4-agent bracket). 2 rounds. Round 1: RPS. Round 2 (finals): poker or auction. Verify bracket progression, escalating stakes, prize distribution, ELO updates.
- **Owner:** —
- **Acceptance Criteria:**
  - 4+ agents registered in tournament
  - Bracket generated and first round matches play out
  - Winners advance, losers eliminated
  - Finals play different game type than first round
  - Prize distributed correctly to winner, runner-up
  - ELO ratings updated for all participants
  - All tournament tx hashes logged

---

## Deliverables

1. Tournament.sol deployed to Monad testnet
2. ELO rating system active in AgentRegistry
3. Fighter tournament navigation logic
4. Full tournament test results log

---

## Test / Acceptance Criteria

- Tournament contract deployed and functional on Monad testnet
- Full tournament bracket completes (4+ agents, 2+ rounds)
- Game type rotates between rounds
- Stakes escalate per round
- ELO ratings update correctly after tournament matches
- Prize distribution correct

---

## Gate Checklist

- [ ] Tournament.sol compiles and Foundry tests pass
- [ ] Tournament deployed to Monad testnet
- [ ] ELO per-game and composite ratings working
- [ ] Fighter registers for and navigates tournament bracket
- [ ] Game type rotation works per round
- [ ] Escalating stakes applied
- [ ] Prize distribution correct
- [ ] Full 4-agent tournament completed on testnet
- [ ] ELO ratings visibly change after tournament
- [ ] All tournament tx hashes logged
