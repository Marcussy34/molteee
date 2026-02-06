# Task 08 — Phase 8: Bonus (Stretch Goals)

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for AMM design patterns, prediction market mechanics, and OpenClaw skill development. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 8
- **Name:** Bonus (Stretch Goals)
- **Status:** Not Started
- **Depends On:** Phase 7 (submission complete — these are enhancements)
- **Blocks:** Nothing

---

## Objectives

1. Build and deploy PredictionMarket.sol AMM contract
2. Build a Spectator OpenClaw skill that watches matches and bets on outcomes
3. Implement advanced tournament formats (round-robin, double elimination)
4. Any additional polish that strengthens the submission

---

## Prerequisites

- Phase 7 gate passed: submission complete, all core features working
- Sufficient time before hackathon deadline

---

## Scope

### In Scope

- PredictionMarket.sol (binary outcome AMM, auto-deploy per match, auto-resolve)
- Spectator skill (separate OpenClaw skill: `skills/spectator/SKILL.md` + scripts)
- Round-robin and double elimination tournament variants
- Any other ideas that emerged during development

### Out of Scope

- Core feature changes (locked after Phase 7)
- Major architectural refactors

---

## Tasks

### Task 8.1 — Design Prediction Market

- **Description:** For each match, a binary outcome market auto-deploys: "Will Player A win?" Spectators buy/sell outcome tokens using MON. Simple AMM (constant product `x * y = k` or LMSR). Auto-resolves when match completes.
- **Owner:** —
- **Acceptance Criteria:**
  - Market mechanics specified
  - AMM formula chosen
  - Auto-deploy/resolve flows documented
  - Edge cases: no bets, draw, manipulation

### Task 8.2 — Write PredictionMarket.sol

- **Description:** Functions: `createMarket(matchId)`, `buyOutcome(outcome, amount)`, `sellOutcome(outcome, amount)`, `resolve(matchId, winner)`, `redeem()`. AMM maintains liquidity. Price adjusts on buy/sell.
- **Owner:** —
- **Acceptance Criteria:**
  - Compiles, tests pass
  - Market creation, buy/sell, resolution, redemption all work
  - AMM math correct

### Task 8.3 — Foundry Tests for PredictionMarket

- **Description:** Tests: creation, buying both outcomes, selling, price movement, resolution, edge cases.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes

### Task 8.4 — Deploy PredictionMarket to Monad Testnet

- **Description:** Deploy, configure auto-deploy/resolve hooks, seed initial liquidity.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed, connected to game contracts
  - Liquidity seeded

### Task 8.5 — Spectator Skill

- **Description:** Build a separate OpenClaw skill at `skills/spectator/`. The spectator is a different OpenClaw agent instance. SKILL.md teaches the LLM to: monitor ongoing matches, estimate outcomes using ELO and match state, place bets on prediction market, track accuracy. Separate scripts in `skills/spectator/scripts/`.
- **Owner:** —
- **Acceptance Criteria:**
  - `skills/spectator/SKILL.md` exists with valid frontmatter
  - Spectator detects matches, estimates outcomes, places bets
  - Tracks prediction accuracy
  - Runs as separate OpenClaw instance
  - Operates autonomously

### Task 8.6 — Round-Robin Tournament Format

- **Description:** Add round-robin variant: every agent plays every other. Winner by total wins/points. Can be a new contract or Tournament V2.
- **Owner:** —
- **Acceptance Criteria:**
  - All-vs-all matchups generated
  - Final standings correct

### Task 8.7 — Double Elimination Tournament Format

- **Description:** Agents must lose twice to be eliminated. Winners bracket + losers bracket. Finals: bracket champions face off.
- **Owner:** —
- **Acceptance Criteria:**
  - Losers drop to losers bracket
  - Second loss = elimination
  - Finals between bracket champions

### Task 8.8 — Integration Test with Prediction Market

- **Description:** Run a match with prediction market active + spectator agent betting. Full flow: match start → market deploy → spectator bets → match end → market resolve → redemption.
- **Owner:** —
- **Acceptance Criteria:**
  - Full flow works on Monad testnet
  - Spectator skill places bets autonomously
  - All tx hashes logged

---

## Deliverables

1. PredictionMarket.sol deployed (if completed)
2. Spectator skill (if completed)
3. Advanced tournament formats (if completed)
4. Updated submission with bonus features

---

## Gate Checklist

- [ ] At least one bonus feature working end-to-end
- [ ] Core functionality unaffected
- [ ] Tested on Monad testnet
- [ ] Submission updated if bonus features included
