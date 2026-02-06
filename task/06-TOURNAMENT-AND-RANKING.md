# Task 06 — Phase 6: Tournament System + ELO Ranking

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Solidity, web3.py, and ELO rating formulas. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

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
3. Add tournament navigation scripts and commands
4. Update SKILL.md with tournament instructions
5. Run a full tournament bracket with game rotation and escalating stakes

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
- Tournament scripts and CLI commands
- Updated SKILL.md with tournament workflow

### Out of Scope

- Psychological tactics (Phase 7)
- Advanced tournament formats: round-robin, double elimination (Phase 8)
- Prediction market (Phase 8)

---

## Tasks

### Task 6.1 — Design Tournament Structure

- **Description:** Single-elimination bracket. N agents register, lock entry fee. Randomized matchups (commit-reveal for fairness). Configurable game type per round. Escalating per-round wagers. Prize distribution: winner majority, runner-up portion, semifinalists remainder.
- **Owner:** —
- **Acceptance Criteria:**
  - Format specified: bracket generation, game rotation, stakes, prizes
  - Edge cases: byes, timeout, ties

### Task 6.2 — Write Tournament.sol

- **Description:** Functions: `createTournament()`, `register()`, `generateBracket()`, `reportResult()`, `distributePrizes()`. Orchestrates — individual matches run through game contracts + Escrow.
- **Owner:** —
- **Acceptance Criteria:**
  - Compiles with `forge build`
  - Registration locks entry fee
  - Bracket generation valid
  - Winners advance correctly
  - Game type rotation enforced
  - Escalating stakes per round
  - Prize distribution correct

### Task 6.3 — Foundry Tests for Tournament

- **Description:** Tests: 4-agent tournament (2 rounds), 8-agent (3 rounds), byes, timeouts, prize math, bracket randomness.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all tournament tests

### Task 6.4 — Deploy Tournament to Monad Testnet

- **Description:** Deploy, configure with all game contracts + Escrow + Registry. Update `lib/contracts.py`.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed, authorized for match creation
  - `lib/contracts.py` updated

### Task 6.5 — ELO Rating System

- **Description:** Implement/enhance ELO in AgentRegistry. Per-game-type ELO + composite. Standard formula: `new = old + K × (actual - expected)`. K-factor: higher for new agents, lower for established. All on-chain and queryable.
- **Owner:** —
- **Acceptance Criteria:**
  - Per-game ELO updated after each match
  - Composite ELO computed
  - Correct math (beating higher-rated = more points)
  - K-factor adjusts by match count
  - Queryable on-chain

### Task 6.6 — Tournament Scripts

- **Description:** Add tournament commands to CLI:
  - `arena.py tournaments` — list open tournaments
  - `arena.py join-tournament <id>` — register and lock entry fee
  - `arena.py play-tournament <id>` — navigate bracket: play each round's game type, handle escalating stakes
  - `arena.py tournament-status <id>` — check bracket position and results
- **Owner:** —
- **Acceptance Criteria:**
  - All tournament commands work
  - Bracket navigation fully handled by scripts
  - Game type switching per round works
  - Escalating stakes applied

### Task 6.7 — Tournament Bankroll Strategy

- **Description:** Add tournament-specific logic to `scripts/bankroll.py`. Budget entry fee + escalating wagers across expected rounds. Conservative early, aggressive in finals. The LLM uses this when deciding whether to enter tournaments.
- **Owner:** —
- **Acceptance Criteria:**
  - Tournament budget calculated
  - Early rounds: conservative
  - Later rounds: more aggressive
  - Entry decision factors in prize pool, field strength, bankroll

### Task 6.8 — Update SKILL.md with Tournament Instructions

- **Description:** Add tournament workflow to SKILL.md: how to find, evaluate, join, and navigate tournaments. Include ELO-based decisions (use ELO to assess opponents and decide entry).
- **Owner:** —
- **Acceptance Criteria:**
  - SKILL.md covers tournament lifecycle
  - LLM can autonomously decide to join and play tournaments

### Task 6.9 — Full Tournament Test via OpenClaw

- **Description:** Run a 4-agent tournament on Monad testnet (fighter + 3 opponents). 2 rounds. Round 1: RPS. Finals: poker or auction. Run via OpenClaw — tell agent "there's an open tournament, evaluate and join."
- **Owner:** —
- **Acceptance Criteria:**
  - 4+ agents in tournament
  - Bracket plays out, winners advance
  - Finals use different game type than round 1
  - Prize distributed correctly
  - ELO updated for all participants
  - All tx hashes logged

---

## Deliverables

1. Tournament.sol deployed to Monad testnet
2. ELO rating system active in AgentRegistry
3. Tournament scripts and CLI commands
4. Updated SKILL.md
5. Tournament test results

---

## Gate Checklist

- [ ] Tournament.sol compiles, tests pass
- [ ] Deployed to Monad testnet
- [ ] ELO per-game + composite working
- [ ] Tournament CLI commands work
- [ ] Fighter joins and navigates tournament via OpenClaw
- [ ] Game type rotation per round
- [ ] Escalating stakes applied
- [ ] Prize distribution correct
- [ ] Full 4-agent tournament completed on testnet
- [ ] ELO changes visible after tournament
