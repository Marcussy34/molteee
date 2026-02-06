# Task 02 — Phase 2: First Working Fighter Skill

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for OpenClaw skills (https://docs.openclaw.ai/tools/skills), web3.py, and Monad RPC. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 2
- **Name:** First Working Fighter Skill
- **Status:** Not Started
- **Depends On:** Phase 1 (OpenClaw running, contracts deployed, skill scaffold ready)
- **Blocks:** Phase 3

---

## Objectives

1. Write the SKILL.md instructions that teach the OpenClaw LLM how to play RPS matches
2. Build Python scripts that handle all on-chain interactions (registry, escrow, RPS)
3. Complete one full autonomous RPS match — the LLM reads the skill, calls scripts, and the match plays out
4. Establish the script architecture (CLI dispatcher pattern) used by all later phases

---

## Prerequisites

- Phase 1 gate passed: OpenClaw running, contracts deployed, skill scaffold ready
- At least 2 funded wallets on Monad testnet (fighter + one test opponent)
- Monad testnet RPC accessible
- web3.py installed in skill's Python environment

---

## Scope

### In Scope

- SKILL.md with full instructions for RPS match flow
- Python CLI dispatcher (`scripts/arena.py`) — entry point for all agent actions
- Contract interaction scripts (registry, escrow, RPS)
- Registration, opponent discovery, match creation, commit-reveal, payout collection
- Basic error handling (tx failures, timeouts, reverts)
- Event/state polling for opponent actions

### Out of Scope

- Smart strategy (Phase 3) — use random moves for now
- Multiple opponents (Phase 3)
- Bankroll management (Phase 3)
- Poker or Auction gameplay (Phase 4–5)
- Fancy logging or dashboard (Phase 7)

---

## Tasks

### Task 2.1 — Write Contract Interaction Library

- **Description:** Create `lib/contracts.py` with web3.py wrappers for all three deployed contracts (AgentRegistry, Escrow, RPSGame). Use the ABIs from Foundry artifacts. Provide Python functions for every on-chain action: `register()`, `get_open_agents()`, `create_match()`, `accept_match()`, `commit_move()`, `reveal_move()`, `claim_payout()`, `get_match_state()`, etc. Handle gas estimation, nonce management, and tx receipt waiting.
- **Owner:** —
- **Acceptance Criteria:**
  - Each contract has typed Python functions
  - All functions call the correct contract methods with proper parameters
  - Tx receipt waiting and error decoding work
  - Can be imported by any script in `scripts/`

### Task 2.2 — Write CLI Dispatcher (`scripts/arena.py`)

- **Description:** Create the main entry point that the OpenClaw LLM will call. CLI pattern: `python3 scripts/arena.py <command> [args]`. Commands: `register`, `discover`, `challenge <opponent> <wager>`, `accept <match_id>`, `play-rps <match_id>`, `status`, `balance`. Each command calls the appropriate contract interaction functions and prints structured output the LLM can parse.
- **Owner:** —
- **Acceptance Criteria:**
  - CLI dispatcher handles all commands
  - Output is structured and parseable (JSON or clear text)
  - Error messages are human-readable
  - `python3 scripts/arena.py --help` shows available commands

### Task 2.3 — Registration Script

- **Description:** `arena.py register` — checks if the fighter is already registered on AgentRegistry. If not, registers with: wallet address, supported game types (initially "rps"), wager range, open-to-challenge = true. Prints registration result.
- **Owner:** —
- **Acceptance Criteria:**
  - Registers successfully on first run
  - Detects existing registration and skips on subsequent runs
  - Output confirms registration with tx hash

### Task 2.4 — Discovery Script

- **Description:** `arena.py discover` — scans AgentRegistry for open-to-challenge agents that support RPS. Excludes self. Returns list with: address, ELO, wager range, supported games. Output formatted for the LLM to reason about.
- **Owner:** —
- **Acceptance Criteria:**
  - Returns all eligible opponents
  - Excludes fighter's own address
  - Output includes relevant data for match selection

### Task 2.5 — RPS Match Script

- **Description:** `arena.py play-rps <opponent_address> <wager>` — handles the full RPS match lifecycle:
  1. Create escrow (lock wager)
  2. Wait for opponent to accept (poll state)
  3. For each round: generate random move, compute `keccak256(move + salt)`, submit commit, wait for opponent commit, submit reveal, wait for result
  4. After all rounds: check match result, collect payout if won
  5. Print round-by-round results and final outcome

  The script handles the entire flow — the LLM just calls it once and gets results.
- **Owner:** —
- **Acceptance Criteria:**
  - Full commit-reveal flow executes correctly
  - Script waits/polls for opponent actions at each step
  - Handles best-of-N rounds
  - Reports round results and final outcome with tx hashes
  - Handles timeout gracefully (claims forfeit win)

### Task 2.6 — Balance and Status Scripts

- **Description:** `arena.py balance` — shows current MON balance. `arena.py status` — shows fighter's registry data (ELO, match history, open status). These give the LLM situational awareness.
- **Owner:** —
- **Acceptance Criteria:**
  - Balance shows correct MON amount
  - Status shows ELO, match count, open-to-challenge flag
  - Output is concise and parseable

### Task 2.7 — Write SKILL.md Instructions

- **Description:** Write the full SKILL.md for the fighter skill. YAML frontmatter: name ("gaming-arena-fighter"), description (when to use this skill), requires (python3, env vars for MONAD_PRIVATE_KEY and MONAD_RPC_URL). Markdown body: step-by-step instructions teaching the LLM how to:
  1. Check balance and status
  2. Register if not already registered
  3. Discover available opponents
  4. Evaluate and select an opponent
  5. Play an RPS match via `python3 scripts/arena.py play-rps`
  6. Review results and decide next action

  Include example commands and expected output formats. The LLM should be able to autonomously run a full match just by reading these instructions.
- **Owner:** —
- **Acceptance Criteria:**
  - SKILL.md has valid YAML frontmatter
  - Instructions cover the full match lifecycle
  - Example commands are correct and runnable
  - OpenClaw LLM can follow the instructions without additional guidance
  - Skill loads in OpenClaw without errors

### Task 2.8 — End-to-End Test via OpenClaw

- **Description:** Run the OpenClaw agent with the fighter skill. Tell the agent to "play an RPS match." The agent should: read the SKILL.md, call the scripts, register, discover opponents, play a match, and report results. Test against a manually-run opponent (using `cast` or a simple Python script on the second wallet). This validates the full OpenClaw → SKILL.md → scripts → on-chain flow.
- **Owner:** —
- **Acceptance Criteria:**
  - OpenClaw LLM reads SKILL.md and follows instructions autonomously
  - Agent registers, discovers opponent, and initiates match
  - Full RPS match plays out on Monad testnet
  - Agent reports results with tx hashes
  - No manual intervention after initial "play a match" prompt

---

## Deliverables

1. Fighter skill SKILL.md with complete instructions
2. CLI dispatcher (`scripts/arena.py`) with all commands
3. Contract interaction library (`lib/contracts.py`)
4. Working end-to-end match via OpenClaw on Monad testnet
5. Test transcript showing the LLM autonomously completing a match

---

## Test / Acceptance Criteria

- OpenClaw agent reads skill, calls scripts, completes 1 RPS match autonomously
- At least 1 complete match on Monad testnet verified by tx hashes
- No manual intervention required after initial prompt
- Scripts work both standalone (for testing) and via OpenClaw

---

## Gate Checklist

- [ ] `lib/contracts.py` covers all contract interactions
- [ ] `scripts/arena.py` CLI dispatcher handles all commands
- [ ] SKILL.md has valid frontmatter and complete instructions
- [ ] OpenClaw discovers and loads the fighter skill
- [ ] Agent registers itself on AgentRegistry via skill
- [ ] Agent discovers opponents via skill
- [ ] Agent plays full RPS match via skill scripts
- [ ] 1 full autonomous match completed on Monad testnet
- [ ] All tx hashes logged and verifiable on block explorer
