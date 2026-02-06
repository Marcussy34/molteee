# Task 07 — Phase 7: Demo, Polish, and Submission

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for OpenClaw submission requirements, Moltbook API, and any frontend frameworks used. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 7
- **Name:** Demo, Polish, and Submission
- **Status:** Not Started
- **Depends On:** Phase 6 (tournament working, ELO active, all three games functional)
- **Blocks:** Phase 8 (optional)

---

## Objectives

1. Add psychological tactics module (timing manipulation, pattern seeding, tilt induction)
2. Build enhanced logging/dashboard for demo visibility
3. Integrate with Moltbook for social/ecosystem presence
4. Prepare and record demo video
5. Write README and submission documentation
6. Run final end-to-end test
7. Submit on moltiverse.dev

---

## Prerequisites

- Phase 6 gate passed: all three games, tournament, ELO all working
- All 5 opponents deployed and functional
- Full autonomous match capability across game types

---

## Scope

### In Scope

- Psychological tactics module
- Enhanced terminal logging (color-coded, strategy reasoning)
- Optional React dashboard (stretch within this phase)
- Moltbook integration
- Demo script and video recording
- README with architecture docs
- Final E2E validation
- Submission package

### Out of Scope

- New game types or contracts
- Prediction market (Phase 8)
- Major strategy engine changes

---

## Tasks

### Task 7.1 — Psychological Tactics: Timing Manipulation

- **Description:** Vary commit/reveal/bet timing as a strategic signal. In RPS: fast commits project confidence, slow commits simulate deliberation. In poker: pause before a big bluff to simulate "thinking." In auctions: quick bids signal commitment. Implementation: add configurable delays to on-chain action submissions. Log timing decisions and reasoning.
- **Owner:** —
- **Acceptance Criteria:**
  - Timing varies between actions based on strategic context
  - Fast timing used for confidence projection
  - Slow timing used for deliberation signaling
  - Timing decisions logged with reasoning
  - Monad's sub-second finality makes timing differences observable

### Task 7.2 — Psychological Tactics: Pattern Seeding

- **Description:** In RPS, deliberately establish a predictable pattern in early rounds (e.g., rock-rock-rock), then break it when the opponent starts countering. The opponent's model becomes a liability. Track whether the opponent adapted to the seed (started playing paper), then switch.
- **Owner:** —
- **Acceptance Criteria:**
  - Pattern seeding activates in early match rounds
  - Monitors whether opponent takes the bait (starts countering the pattern)
  - Breaks pattern at the right moment to exploit opponent adaptation
  - Pattern seeding attempts logged with success/failure outcome

### Task 7.3 — Psychological Tactics: Tilt Induction

- **Description:** After winning a match, immediately challenge the same opponent again at a higher wager. Opponents that change behavior after losses (tilt) become more exploitable. The fighter's opponent model detects tilt (via the cross-game profiling) and exploits the behavioral shift.
- **Owner:** —
- **Acceptance Criteria:**
  - Post-win re-challenge logic implemented
  - Higher wager used for re-challenges (within Kelly limits)
  - Tilt detection from cross-game profile informs exploitation
  - Tilt induction attempts logged

### Task 7.4 — Psychological Tactics: Reputation Manipulation

- **Description:** Strategically manage ELO rating visibility. Option A: win several easy matches to build high ELO (intimidation). Option B: lose a few low-stakes matches to lower ELO (sandbag), then bet big against opponents who underestimate you. Choose based on upcoming opponent pool.
- **Owner:** —
- **Acceptance Criteria:**
  - Agent can recognize when sandbagging or ELO pumping is strategically useful
  - Low-stakes ELO manipulation logged with reasoning
  - Not a default behavior — only activates when strategic benefit is identified

### Task 7.5 — Enhanced Terminal Logging

- **Description:** Build rich terminal output showing: opponent name, game type, strategy being used, move/bet/bid chosen and why, opponent model state, bankroll before/after, ELO before/after, tx hashes. Use color coding: green for wins, red for losses, yellow for bluffs, blue for strategy decisions. Show strategy reasoning inline (e.g., "Detected Rock plays rock 70% → countering with paper").
- **Owner:** —
- **Acceptance Criteria:**
  - Every match logs clearly: opponent, game, strategy, moves, result, bankroll, ELO
  - Color coding applied
  - Strategy reasoning visible for each decision
  - Tx hashes included for on-chain verification
  - Output readable and demo-worthy

### Task 7.6 — Optional React Dashboard

- **Description:** (Stretch) Build a simple React app that displays: live match feed, bankroll chart over time, ELO progression, opponent profiles, win rates by game type, transaction history. Can be a simple single-page app reading from the agent's log output or from on-chain data.
- **Owner:** —
- **Acceptance Criteria:**
  - Dashboard renders match history and bankroll
  - ELO progression visible as a chart or table
  - Opponent profiles displayed
  - Can be run locally during demo
  - (Optional — terminal logging is sufficient if time is short)

### Task 7.7 — Moltbook Integration

- **Description:** Connect the fighter agent to Moltbook (OpenClaw's social layer). Post match results, tournament standings, trash talk, and highlights. Example posts: "Just beat @TheRock 7-3 in RPS. Detected 70% rock frequency in round 2. ELO: 1045 → 1062." This shows ecosystem integration and personality.
- **Owner:** —
- **Acceptance Criteria:**
  - Agent posts to Moltbook after notable matches
  - Posts include: opponent, result, strategy highlight, ELO change
  - Posts are concise and readable
  - (If Moltbook API is unavailable, stub the integration and document what it would post)

### Task 7.8 — Demo Script

- **Description:** Write a demo script — the exact sequence of actions that will be shown to judges. Script should cover: agent startup, registration, discovery, 5+ matches across all three game types, at least one bluff, one bid shade, one pattern exploitation, a tournament, bankroll growth, ELO climb. Time the script to fit within demo window (likely 3–5 minutes).
- **Owner:** —
- **Acceptance Criteria:**
  - Script lists each step with expected output
  - All key features demonstrated: multi-game, bluffing, adaptive strategy, bankroll management, tournament, ELO
  - Timed to fit demo window
  - Fallback plan for if something fails during demo

### Task 7.9 — Demo Video Recording

- **Description:** Record the demo. Show terminal output (or dashboard) as the agent runs through the scripted sequence. Narrate or annotate key moments. Keep it concise.
- **Owner:** —
- **Acceptance Criteria:**
  - Video shows full demo sequence
  - Key features highlighted (bluffs, pattern detection, game selection)
  - Video is under 5 minutes
  - Quality is clear and readable

### Task 7.10 — README and Documentation

- **Description:** Write a comprehensive README covering: project overview, architecture diagram (text-based is fine), setup instructions (clone, install, configure wallet, deploy contracts, run agent), how to run the demo, tech stack, contract addresses on Monad testnet, key design decisions.
- **Owner:** —
- **Acceptance Criteria:**
  - README is complete and followable
  - Someone could clone the repo and run the demo
  - Architecture is explained clearly
  - Contract addresses listed
  - Tech stack documented

### Task 7.11 — Final E2E Validation

- **Description:** Run the full demo sequence end-to-end on Monad testnet. Verify everything works: registration, discovery, 5+ matches, multiple game types, tournament, bankroll positive, ELO climbed. Fix any issues found.
- **Owner:** —
- **Acceptance Criteria:**
  - Full sequence completes without errors
  - Bankroll is positive at the end
  - ELO has climbed
  - All tx hashes are valid and verifiable
  - Logs show adaptive strategy across opponents and games

### Task 7.12 — Submit on Moltiverse

- **Description:** Package everything and submit on moltiverse.dev. Include: repo link, demo video, deployed contract addresses, agent wallet address, README.
- **Owner:** —
- **Acceptance Criteria:**
  - Submission completed on moltiverse.dev
  - All required materials included
  - Links are accessible and working

---

## Deliverables

1. Psychological tactics module (timing, pattern seeding, tilt induction, reputation)
2. Enhanced terminal logging
3. Demo script and video
4. README and documentation
5. Moltbook integration (or stubs)
6. Final E2E validation log
7. Completed submission on moltiverse.dev

---

## Test / Acceptance Criteria

- Psychological tactics visible in logs during demo
- Demo video recorded and under 5 minutes
- README allows someone to set up and run the project
- Final E2E run completes successfully
- Submission complete on moltiverse.dev

---

## Gate Checklist

- [ ] Psychological tactics module active (timing, seeding, tilt)
- [ ] Enhanced logging shows strategy reasoning
- [ ] Demo script written and timed
- [ ] Demo video recorded
- [ ] README complete with setup instructions
- [ ] Moltbook integration working (or documented stubs)
- [ ] Final E2E validation passed on Monad testnet
- [ ] Bankroll positive after full demo run
- [ ] ELO climbed after full demo run
- [ ] All tx hashes verifiable on block explorer
- [ ] Submitted on moltiverse.dev
