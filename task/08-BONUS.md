# Task 08 — Phase 8: Bonus (Stretch Goals)

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for AMM design patterns, prediction market mechanics, and any new contract patterns. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

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
2. Build a Spectator skill that watches matches and bets on outcomes
3. Implement advanced tournament formats (round-robin, double elimination)
4. Any additional polish or features that strengthen the submission

---

## Prerequisites

- Phase 7 gate passed: submission complete, all core features working
- Sufficient time remaining before hackathon deadline

---

## Scope

### In Scope

- PredictionMarket.sol (binary outcome AMM, auto-deploy per match, auto-resolve)
- Spectator skill (OpenClaw skill that watches and bets)
- Round-robin tournament format
- Double elimination tournament format
- Any other ideas that emerged during development

### Out of Scope

- Core feature changes (those are locked after Phase 7)
- Major architectural refactors

---

## Tasks

### Task 8.1 — Design Prediction Market

- **Description:** Define the prediction market mechanics. For each match, a binary outcome market auto-deploys: "Will Player A win?" Spectators buy/sell outcome tokens using MON. Use a simple AMM formula (constant product `x * y = k` or LMSR). Market auto-resolves when the match completes. Winning outcome token holders redeem for MON.
- **Owner:** —
- **Acceptance Criteria:**
  - Market mechanics fully specified
  - AMM formula chosen and documented
  - Token pricing model defined
  - Auto-deploy and auto-resolve flows documented
  - Edge cases: market with no bets, match timeout/draw, market manipulation

### Task 8.2 — Write PredictionMarket.sol

- **Description:** Implement the prediction market AMM contract. Functions: `createMarket(matchId)` (auto-called when a match starts), `buyOutcome(outcome, amount)` (buy tokens for player A or B winning), `sellOutcome(outcome, amount)`, `resolve(matchId, winner)` (auto-called when match ends), `redeem()` (winners claim MON). AMM maintains liquidity pool. Price adjusts based on buy/sell pressure.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Market creation works
  - Buy/sell outcome tokens adjusts prices correctly
  - Resolution pays correct amounts to winning token holders
  - Auto-deploy triggered on match creation
  - Auto-resolve triggered on match completion

### Task 8.3 — Foundry Tests for PredictionMarket

- **Description:** Write tests: market creation, buying both outcomes, selling, price movement, resolution with correct payouts, edge cases (empty markets, draws).
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all prediction market tests
  - AMM math verified
  - Resolution payouts correct

### Task 8.4 — Deploy PredictionMarket to Monad Testnet

- **Description:** Deploy PredictionMarket.sol. Configure with references to Escrow and game contracts (to auto-create/resolve markets). Fund initial liquidity.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract deployed and address recorded
  - Auto-deploy and auto-resolve hooks connected
  - Initial liquidity seeded

### Task 8.5 — Spectator Skill

- **Description:** Build an OpenClaw spectator skill. The spectator agent: monitors ongoing matches, estimates outcomes based on public information (ELO ratings, match progress if visible), places bets on the prediction market, tracks its own prediction accuracy and bankroll.
- **Owner:** —
- **Acceptance Criteria:**
  - Spectator skill loads in OpenClaw
  - Detects ongoing matches
  - Estimates outcome probabilities
  - Places bets on prediction market
  - Tracks prediction accuracy
  - Operates autonomously (no human intervention)

### Task 8.6 — Round-Robin Tournament Format

- **Description:** Add a round-robin tournament variant to Tournament.sol (or create TournamentV2.sol). Every agent plays every other agent. Winner determined by total wins (or points). Supports game type specification per matchup or round.
- **Owner:** —
- **Acceptance Criteria:**
  - Round-robin matchup generation works
  - All-vs-all matches scheduled and executed
  - Final standings calculated correctly
  - Prize distribution based on final ranking

### Task 8.7 — Double Elimination Tournament Format

- **Description:** Add double elimination: agents must lose twice to be eliminated. Winners bracket and losers bracket. Losers bracket gives a second chance. Finals: winners bracket champion vs. losers bracket champion.
- **Owner:** —
- **Acceptance Criteria:**
  - Double elimination bracket generation works
  - Losers drop to losers bracket (not eliminated)
  - Second loss = true elimination
  - Finals matchup between bracket champions
  - Prize distribution correct

### Task 8.8 — Integration Test with Prediction Market

- **Description:** Run a match with the prediction market active. Spectator agent bets on the outcome. Verify: market auto-deploys, spectator buys tokens, match completes, market resolves, spectator redeems (or loses).
- **Owner:** —
- **Acceptance Criteria:**
  - Full flow: match start → market deploy → spectator bets → match end → market resolve → redemption
  - All on Monad testnet
  - Tx hashes logged

---

## Deliverables

1. PredictionMarket.sol deployed (if completed)
2. Spectator skill (if completed)
3. Advanced tournament formats (if completed)
4. Updated submission with bonus features

---

## Test / Acceptance Criteria

- At least one bonus feature fully working on Monad testnet
- Bonus features don't break core functionality
- Updated demo/documentation if bonus features are included in submission

---

## Gate Checklist

- [ ] At least one bonus feature working end-to-end
- [ ] Core functionality unaffected by bonus additions
- [ ] Bonus features tested on Monad testnet
- [ ] Submission updated if bonus features included
