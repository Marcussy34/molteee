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

1. Add psychological tactics to fighter scripts (timing manipulation, pattern seeding, tilt induction)
2. Enhance script output for demo-quality visibility
3. Integrate with Moltbook for social/ecosystem presence
4. Prepare and record demo video showing OpenClaw agent running autonomously
5. Write README and submission documentation
6. Run final end-to-end test
7. Submit on moltiverse.dev

---

## Prerequisites

- Phase 6 gate passed: all three games, tournament, ELO all working via OpenClaw
- All 5 opponents deployed and functional
- Full autonomous match capability across game types

---

## Scope

### In Scope

- Psychological tactics scripts (`scripts/psychology.py`)
- Enhanced script output (color-coded, strategy reasoning visible)
- Optional React dashboard (stretch within this phase)
- Moltbook integration
- Demo script and video recording (shows OpenClaw agent in action)
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

- **Description:** Create `scripts/psychology.py`. Add configurable delays to on-chain actions. Fast commits = confidence. Slow bets = deliberation. Monad's sub-second finality makes timing observable. Add `--timing` flag to play scripts that enables psychological timing.
- **Owner:** —
- **Acceptance Criteria:**
  - Timing varies by strategic context
  - Delays configurable per game type
  - Timing decisions logged with reasoning

### Task 7.2 — Psychological Tactics: Pattern Seeding

- **Description:** In RPS, seed a predictable pattern in early rounds (e.g., rock-rock-rock). Monitor if opponent adapts (starts playing paper). Break pattern at right moment. Add to strategy module as an optional "seeding" mode.
- **Owner:** —
- **Acceptance Criteria:**
  - Seeding activates in early rounds
  - Monitors opponent adaptation
  - Breaks pattern to exploit
  - Logged with success/failure

### Task 7.3 — Psychological Tactics: Tilt Induction

- **Description:** After winning, immediately re-challenge same opponent at higher wager. Opponents that tilt (change behavior after losses) become more exploitable. Uses cross-game tilt detection from opponent profiles.
- **Owner:** —
- **Acceptance Criteria:**
  - Post-win re-challenge logic in CLI dispatcher
  - Higher wager within Kelly limits
  - Tilt detection from profile informs exploitation
  - Logged

### Task 7.4 — Psychological Tactics: Reputation Manipulation

- **Description:** Strategically manage ELO. Option A: pump ELO with easy wins (intimidation). Option B: sandbagging (lose cheap, then exploit). Add as a strategy option the LLM can choose based on context.
- **Owner:** —
- **Acceptance Criteria:**
  - Agent recognizes when sandbagging/pumping is useful
  - Only activates when strategically beneficial
  - Reasoning logged

### Task 7.5 — Enhanced Script Output

- **Description:** Upgrade all script output to be demo-quality. Include: opponent name, game type, strategy reasoning, move/bet/bid chosen and why, opponent model state, bankroll before/after, ELO before/after, tx hashes. Use color coding if terminal supports it. Output should be readable both by the LLM and by a human watching the demo.
- **Owner:** —
- **Acceptance Criteria:**
  - Every match shows: opponent, game, strategy, moves, result, bankroll, ELO
  - Strategy reasoning visible inline
  - Tx hashes included
  - Readable and demo-worthy

### Task 7.6 — Update SKILL.md with Psychology Instructions

- **Description:** Add psychological tactics to SKILL.md. Teach the LLM when to use timing manipulation, pattern seeding, tilt induction, and reputation manipulation. The LLM decides when psychological tactics are appropriate based on context.
- **Owner:** —
- **Acceptance Criteria:**
  - SKILL.md covers all psychological tactics
  - LLM can choose to apply tactics situationally

### Task 7.7 — Optional React Dashboard

- **Description:** (Stretch) Simple React app showing: live match feed, bankroll chart, ELO progression, opponent profiles, win rates by game type. Reads from the agent's JSON log files or on-chain data.
- **Owner:** —
- **Acceptance Criteria:**
  - Dashboard renders match history and bankroll
  - ELO progression visible
  - Can run locally during demo
  - (Optional — enhanced terminal output is sufficient)

### Task 7.8 — Moltbook Integration

- **Description:** Add Moltbook posting to the fighter skill. After notable matches, post results: "Just beat @TheRock 7-3 in RPS. Detected 70% rock frequency in round 2. ELO: 1045 → 1062." This can be a separate script or integrated into the match flow.
- **Owner:** —
- **Acceptance Criteria:**
  - Agent posts to Moltbook after matches
  - Posts include: opponent, result, strategy highlight, ELO change
  - (If API unavailable, stub and document)

### Task 7.9 — Demo Script

- **Description:** Write the exact sequence for the demo. Shows: agent startup in OpenClaw, registration, discovery, 5+ matches across all game types, bluffs, bid shading, pattern exploitation, tournament, bankroll growth, ELO climb. Time it to 3–5 minutes. Include fallback plan.
- **Owner:** —
- **Acceptance Criteria:**
  - Script lists each step with expected output
  - All key features demonstrated
  - Timed to fit demo window
  - Fallback plan documented

### Task 7.10 — Demo Video Recording

- **Description:** Record the demo showing the OpenClaw agent terminal. The video shows: user prompts the agent, agent reads skill, calls scripts, plays matches autonomously, reports results. Annotate key moments.
- **Owner:** —
- **Acceptance Criteria:**
  - Video shows OpenClaw agent running full sequence
  - Key features highlighted
  - Under 5 minutes
  - Clear and readable

### Task 7.11 — README and Documentation

- **Description:** README covering: project overview, architecture (OpenClaw + skills + contracts), setup instructions (install OpenClaw, deploy contracts, install skill, run opponents, start agent), how to run the demo, tech stack, contract addresses, design decisions.
- **Owner:** —
- **Acceptance Criteria:**
  - README is complete and followable
  - Someone could clone and run the demo
  - OpenClaw setup documented
  - Contract addresses listed

### Task 7.12 — Final E2E Validation

- **Description:** Run the full demo sequence via OpenClaw on Monad testnet. Verify everything works. Fix any issues.
- **Owner:** —
- **Acceptance Criteria:**
  - Full sequence completes without errors
  - Bankroll positive at end
  - ELO climbed
  - All tx hashes valid

### Task 7.13 — Submit on Moltiverse

- **Description:** Submit on moltiverse.dev. Include: repo link, demo video, contract addresses, agent wallet, README.
- **Owner:** —
- **Acceptance Criteria:**
  - Submission completed
  - All materials included
  - Links accessible

---

## Deliverables

1. Psychological tactics module (`scripts/psychology.py`)
2. Enhanced script output
3. Updated SKILL.md with full instructions
4. Demo script and video
5. README and documentation
6. Moltbook integration (or stubs)
7. Completed submission on moltiverse.dev

---

## Gate Checklist

- [ ] Psychological tactics active (timing, seeding, tilt)
- [ ] Enhanced output shows strategy reasoning
- [ ] SKILL.md is comprehensive (covers all features)
- [ ] Demo script written and timed
- [ ] Demo video recorded
- [ ] README complete with setup instructions
- [ ] Moltbook integration working (or stubs documented)
- [ ] Final E2E validation passed on Monad testnet
- [ ] Bankroll positive after full demo run
- [ ] ELO climbed after full demo run
- [ ] All tx hashes verifiable
- [ ] Submitted on moltiverse.dev
