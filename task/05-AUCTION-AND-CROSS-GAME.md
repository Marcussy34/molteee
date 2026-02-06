# Task 05 — Phase 5: Auction Game + Cross-Game Intelligence

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Solidity, web3.py, and auction mechanism design. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

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
2. Build auction strategy scripts: bid shading, information gathering, multi-round adaptation
3. Update opponent bots with auction-specific strategies
4. Implement cross-game opponent profiling: unified model per wallet (aggression, predictability, tilt)
5. Add game selection logic: LLM chooses game type based on edge vs. specific opponent
6. Update SKILL.md with auction and cross-game instructions

---

## Prerequisites

- Phase 4 gate passed: poker working, all opponents support RPS + poker
- Escrow contract can handle auction settlement
- AgentRegistry supports "auction" game type

---

## Scope

### In Scope

- AuctionGame.sol — sealed-bid auction with commit-reveal, known prize value
- Auction strategy scripts for fighter
- Auction strategies for all 5 opponent bots
- Cross-game opponent profiling in `lib/opponent_model.py`
- Game selection command: `arena.py select-game <opponent>`
- Updated SKILL.md + `references/auction-strategy.md`

### Out of Scope

- Tournament brackets (Phase 6)
- Psychological tactics (Phase 7)
- Prediction market (Phase 8)

---

## Tasks

### Task 5.1 — Design Auction Mechanics

- **Description:** Define sealed-bid auction: prize of known MON value posted, both agents commit sealed bids via commit-reveal, highest bidder wins prize and pays bid, loser keeps bid. First-price default. Second-price variant optional. Multi-round ascending variant for bonus.
- **Owner:** —
- **Acceptance Criteria:**
  - Mechanics documented
  - Edge cases: tied bids, timeout, invalid amounts
  - Settlement math specified

### Task 5.2 — Write AuctionGame.sol

- **Description:** Implement auction contract. Flow: prize posted → both commit `keccak256(bid + salt)` → both reveal → highest bidder wins prize, pays bid → Escrow settles → Registry updates. Handle ties, timeouts, bid validation.
- **Owner:** —
- **Acceptance Criteria:**
  - Compiles with `forge build`
  - Commit-reveal for bids works
  - Highest bidder wins, pays correct amount
  - Loser keeps bid (no loss)
  - Integrates with Escrow and AgentRegistry

### Task 5.3 — Foundry Tests for AuctionGame

- **Description:** Tests: normal win, ties, timeout, settlement math, Escrow integration.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all auction tests

### Task 5.4 — Deploy AuctionGame to Monad Testnet

- **Description:** Deploy, configure cross-contract references, update `lib/contracts.py` with ABI and address.
- **Owner:** —
- **Acceptance Criteria:**
  - Deployed, authorized for settlement and ELO updates
  - `lib/contracts.py` updated

### Task 5.5 — Auction Play Script (`scripts/play_auction.py`)

- **Description:** Create `scripts/play_auction.py` (called via `arena.py play-auction <opponent> <prize_value>`). Handles: bid calculation using strategy, commit bid, wait for opponent, reveal, check result. Uses strategy module for bid sizing.
- **Owner:** —
- **Acceptance Criteria:**
  - Full auction lifecycle in one script call
  - Bid calculated by strategy module
  - Reports result with tx hashes

### Task 5.6 — Auction Strategy: Bid Shading

- **Description:** Add auction strategy to `scripts/strategy.py`. Given prize value V, estimate opponent's likely bid from history. Shade bid just above estimated opponent bid. Default: ~60% of prize for unknown opponents.
- **Owner:** —
- **Acceptance Criteria:**
  - Bid shading optimizes profit (wins without overpaying)
  - Default strategy for unknown opponents
  - Reasoning logged

### Task 5.7 — Auction Strategy: Information Gathering

- **Description:** In low-stakes auctions, deliberately bid low to observe opponent behavior. Record bid amounts. Build bid distribution model. Use data for higher-stakes auctions.
- **Owner:** —
- **Acceptance Criteria:**
  - Info-gathering rounds identified and used
  - Opponent bid history recorded
  - Later bids informed by gathered data

### Task 5.8 — Auction Strategy: Multi-Round Adaptation

- **Description:** Adapt bidding across rounds. If opponent bids high, reduce aggression. If opponent bids low, win cheaply. Detect strategy shifts.
- **Owner:** —
- **Acceptance Criteria:**
  - Round-over-round adaptation visible
  - Strategy shift detection works

### Task 5.9 — Opponent Auction Strategies

- **Description:** Add auction play to each opponent bot:
  - **Rock:** Always bids 30–40% of prize. Easy to outbid.
  - **Gambler:** Bids 80–100%. Wins often but overpays.
  - **Mirror:** Bids opponent's last revealed bid. First bid: 50%.
  - **Random:** Random 10–90%.
  - **Counter:** Bids just above fighter's typical range.
- **Owner:** —
- **Acceptance Criteria:**
  - Each opponent has auction strategy matching personality
  - All register "auction" as supported game type

### Task 5.10 — Cross-Game Opponent Profiling

- **Description:** Create `lib/opponent_model.py` with unified per-wallet opponent profiles. Aggregate data across all three game types:
  - **Aggression index** (0–100): frequency of big bets/bids/aggressive play
  - **Predictability score** (0–100): entropy-based, low entropy = exploitable
  - **Tilt detection**: behavior change after losses (bigger bets, worse decisions)

  Save profiles to local JSON. Add `arena.py profile <opponent>` command that returns the profile.
- **Owner:** —
- **Acceptance Criteria:**
  - Unified profile per wallet address
  - Metrics computed from all game types
  - The Rock: high predictability, low aggression
  - The Gambler: high aggression, low predictability
  - Profiles persist across matches and sessions

### Task 5.11 — Game Selection Logic

- **Description:** Add `arena.py select-game <opponent>` command. Calculates estimated edge per game type based on win rate history and opponent profile. Returns recommended game type. Example: if opponent is highly predictable in RPS, recommend RPS.
- **Owner:** —
- **Acceptance Criteria:**
  - Per-game edge estimate calculated per opponent
  - Recommends highest-edge game
  - Reasoning in output for LLM to understand

### Task 5.12 — Update SKILL.md with Auction + Cross-Game Instructions

- **Description:** Add auction workflow and cross-game strategy to SKILL.md. Teach the LLM: use `select-game` before challenging, use `profile` to review opponents, when to use auction vs. poker vs. RPS. Create `references/auction-strategy.md`.
- **Owner:** —
- **Acceptance Criteria:**
  - SKILL.md covers full 3-game workflow
  - LLM selects game type strategically
  - `references/auction-strategy.md` complete

### Task 5.13 — Mixed-Game Series Test via OpenClaw

- **Description:** Run a series via OpenClaw using all three game types. Tell agent: "maximize your bankroll using all available game types." Verify cross-game profiling improves over the series.
- **Owner:** —
- **Acceptance Criteria:**
  - Fighter plays RPS, poker, and auction
  - Game type selection varies by opponent
  - Cross-game profiles reflect personalities accurately
  - Overall bankroll positive

---

## Deliverables

1. AuctionGame.sol deployed to Monad testnet
2. Auction strategy scripts
3. Auction strategies in all 5 opponent bots
4. Cross-game opponent profiling (`lib/opponent_model.py`)
5. Game selection logic
6. Updated SKILL.md + `references/auction-strategy.md`
7. Mixed-game series results

---

## Gate Checklist

- [ ] AuctionGame.sol compiles, tests pass
- [ ] Deployed to Monad testnet
- [ ] `lib/contracts.py` updated with auction ABI/address
- [ ] Fighter plays auctions autonomously via OpenClaw
- [ ] Bid shading works
- [ ] All 5 opponents have auction strategies
- [ ] Cross-game profiles computed with aggression/predictability/tilt
- [ ] Game selection recommends optimal game per opponent
- [ ] Mixed-game series completed with positive results
