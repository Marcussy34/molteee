# Task 05 — Phase 5: Auction Game + Cross-Game Intelligence

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Solidity, and auction mechanism design. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 5
- **Name:** Auction Game + Cross-Game Intelligence
- **Status:** Not Started
- **Depends On:** Phase 4 (poker working, all opponents have multi-game strategies)
- **Blocks:** Phase 6

---

## Objectives

1. Write, test, and deploy AuctionGame.sol on Monad testnet
2. Build the auction strategy module: bid shading, information gathering, multi-round adaptation
3. Update opponent agents with auction-specific strategies
4. Implement cross-game opponent profiling: unified model per wallet (aggression, predictability, tilt)
5. Add game selection logic: choose game type based on edge vs. specific opponent
6. Run auction matches and demonstrate strategic game-type selection

---

## Prerequisites

- Phase 4 gate passed: poker working, all opponents support RPS + poker
- Escrow contract can handle auction settlement
- AgentRegistry supports "auction" game type

---

## Scope

### In Scope

- AuctionGame.sol — sealed-bid auction with commit-reveal, known prize value
- Auction strategy module for fighter
- Auction strategies for all 5 opponents
- Cross-game opponent profiling system
- Game selection logic (choose optimal game type per opponent)
- Mixed-game match series

### Out of Scope

- Tournament brackets (Phase 6)
- Psychological tactics (Phase 7)
- Prediction market (Phase 8)

---

## Tasks

### Task 5.1 — Design Auction Mechanics

- **Description:** Define the sealed-bid auction variant. Recommended: a prize of known MON value is posted. Both agents submit sealed bids via commit-reveal. Highest bidder wins prize, pays their bid. Loser keeps their bid. Net result: winner gains (prize - bid), loser gains nothing but loses nothing. Include second-price variant option. Define multi-round ascending variant for bonus.
- **Owner:** —
- **Acceptance Criteria:**
  - Game mechanics documented (prize posting, bid commitment, reveal, settlement)
  - First-price sealed-bid specified as default
  - Second-price variant defined
  - Edge cases: tied bids, timeout on reveal, invalid bid amounts

### Task 5.2 — Write AuctionGame.sol

- **Description:** Implement the auction game contract. Flow: prize posted (N MON value) → both agents commit `keccak256(bid_amount + salt)` → both reveal → highest bidder wins prize and pays bid → settlement through Escrow → Registry update. Handle: tied bids (split or random), timeout (non-revealer forfeits), min/max bid enforcement.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Commit-reveal for bids works
  - Highest bidder wins and pays correct amount
  - Loser keeps their bid (no loss)
  - Tied bid handling works
  - Timeout forfeit triggers correctly
  - Integrates with Escrow and AgentRegistry

### Task 5.3 — Foundry Tests for AuctionGame

- **Description:** Write comprehensive tests: normal auction (two different bids), tied bids, timeout on reveal, second-price variant, bid validation, Escrow integration for settlement.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all auction tests
  - Coverage: normal win, ties, timeouts, settlement math
  - Integration test with Escrow: correct MON flows

### Task 5.4 — Deploy AuctionGame to Monad Testnet

- **Description:** Deploy AuctionGame.sol. Configure with Escrow and AgentRegistry addresses. Register "auction" as supported game type. Authorize AuctionGame for Escrow settlement and Registry updates.
- **Owner:** —
- **Acceptance Criteria:**
  - AuctionGame deployed and address recorded
  - Cross-contract references configured
  - `cast call` returns expected state

### Task 5.5 — Fighter Auction Strategy: Bid Shading

- **Description:** Given a prize of value V, estimate the opponent's likely bid. Shade own bid just above the estimated opponent bid. Use opponent history (if available) to predict bid range. Without history, default to bidding ~60% of prize value.
- **Owner:** —
- **Acceptance Criteria:**
  - Bid shading calculates optimal bid based on opponent model
  - Wins auctions while minimizing overpayment
  - Default strategy works for unknown opponents
  - Bid amount logged with reasoning

### Task 5.6 — Fighter Auction Strategy: Information Gathering

- **Description:** In early or low-stakes auctions, deliberately bid low to observe opponent behavior cheaply. Record opponent bid amounts. Build a bid distribution model per opponent. Use this data to optimize bids in higher-stakes auctions.
- **Owner:** —
- **Acceptance Criteria:**
  - Low-stakes "info gathering" rounds identified and executed
  - Opponent bid history recorded
  - Bid distribution model updated after each auction
  - Higher-stakes bids informed by gathered data

### Task 5.7 — Fighter Auction Strategy: Multi-Round Adaptation

- **Description:** In multi-round auction scenarios, adapt bidding based on previous rounds. If opponent consistently bids high, reduce aggression. If opponent bids low, bid slightly above their pattern. Detect and respond to opponent strategy shifts.
- **Owner:** —
- **Acceptance Criteria:**
  - Round-over-round adaptation visible in bid changes
  - Response to high-bidding opponents: don't enter bidding wars
  - Response to low-bidding opponents: win cheaply
  - Strategy shift detection works

### Task 5.8 — Opponent Auction Strategies

- **Description:** Add auction strategies to each of the 5 opponents:
  - **Rock:** Always bids 30–40% of prize value. Never aggressive. Easily outbid.
  - **Gambler:** Bids 80–100% of prize value. Wins often but overpays. Low net profit.
  - **Mirror:** Bids the same as the opponent's last revealed bid. First bid is 50% of prize.
  - **Random:** Random bid between 10–90% of prize value. Baseline.
  - **Counter:** Tracks fighter's bid history. Bids just above fighter's typical range. Hardest to beat.
- **Owner:** —
- **Acceptance Criteria:**
  - Each opponent implements auction strategy matching their personality
  - Strategies consistent with RPS and poker personalities
  - All opponents register "auction" as supported game type

### Task 5.9 — Cross-Game Opponent Profiling

- **Description:** Build a unified opponent profile per wallet address that aggregates data from all three game types. Track:
  - **Aggression index:** How often does this opponent bet big (poker), bid high (auction), play aggressively (RPS)? Normalize to 0–100 scale.
  - **Predictability score:** How patterned is this opponent? High = exploitable. Based on entropy of move/bet/bid distributions across all games.
  - **Tilt detection:** Does behavior change after losses? Track win/loss streaks and measure behavior shifts (bigger bets after losses = tilting).
  Each metric aggregates cross-game data for a richer, more reliable model.
- **Owner:** —
- **Acceptance Criteria:**
  - Unified profile per opponent wallet address
  - Aggression, predictability, and tilt metrics computed
  - Metrics update after every match (any game type)
  - The Rock has high predictability, low aggression
  - The Gambler has high aggression, low predictability
  - Profiles persist across matches

### Task 5.10 — Game Selection Logic

- **Description:** When multiple opponents and game types are available, the fighter should choose the optimal game type per opponent. Calculate expected edge in each game type based on: win rate history, opponent profile, strategy confidence. Challenge the opponent in the game where the fighter has the highest edge. Example: if opponent is highly predictable in RPS, challenge them to RPS.
- **Owner:** —
- **Acceptance Criteria:**
  - Per-opponent, per-game edge estimate calculated
  - Fighter selects game type with highest edge for each opponent
  - Selection reasoning logged
  - Integrated with match selection (now considers both opponent and game type)

### Task 5.11 — Mixed-Game Series Test

- **Description:** Run a series of matches using all three game types against all 5 opponents. Fighter should strategically select game type per opponent. Verify cross-game profiling improves over the series. Log all results.
- **Owner:** —
- **Acceptance Criteria:**
  - Fighter plays RPS, poker, and auction matches
  - Game type selection varies by opponent
  - Cross-game profiles reflect opponent personalities accurately
  - Overall win rate / bankroll positive
  - Full results log saved

---

## Deliverables

1. AuctionGame.sol deployed to Monad testnet
2. Auction strategy module for fighter
3. Auction strategies for all 5 opponents
4. Cross-game opponent profiling system
5. Game selection logic
6. Mixed-game series results log

---

## Test / Acceptance Criteria

- AuctionGame deployed and working on Monad testnet
- Fighter plays auctions autonomously with strategic bidding
- Cross-game profiles built for all 5 opponents
- Game selection logic picks optimal game type per opponent
- Fighter plays all three game types in a single run

---

## Gate Checklist

- [ ] AuctionGame.sol compiles and Foundry tests pass
- [ ] AuctionGame deployed to Monad testnet
- [ ] Fighter plays auction matches autonomously
- [ ] Bid shading works (wins without overpaying)
- [ ] Info gathering in early rounds improves later bids
- [ ] All 5 opponents have auction strategies
- [ ] Cross-game opponent profiles computed
- [ ] Aggression, predictability, tilt metrics accurate
- [ ] Game selection logic chooses optimal game type per opponent
- [ ] Mixed-game series completed with positive results
