# Task 02 — Phase 2: First Working Fighter Agent

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for OpenClaw SDK, ethers.js, and Monad RPC. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 2
- **Name:** First Working Fighter Agent
- **Status:** Not Started
- **Depends On:** Phase 1 (all contracts deployed, OpenClaw scaffold ready)
- **Blocks:** Phase 3

---

## Objectives

1. Build a minimal fighter skill in TypeScript that connects to Monad testnet
2. Implement the full RPS match lifecycle: register → discover → challenge → commit → reveal → collect payout
3. Complete one full autonomous end-to-end RPS match without manual intervention
4. Establish the agent's core loop (scan → evaluate → play → settle)

---

## Prerequisites

- Phase 1 gate passed: contracts deployed, OpenClaw scaffold ready, ABIs generated
- At least 2 funded wallets on Monad testnet (fighter + one test opponent)
- Monad testnet RPC accessible

---

## Scope

### In Scope

- OpenClaw skill entry point and main loop
- ethers.js provider and wallet setup for Monad testnet
- Contract interaction layer (typed wrappers around ABI calls)
- Registration on AgentRegistry
- Opponent discovery (scan registry for open agents)
- Match creation via Escrow (lock MON)
- RPS gameplay: commit hash, wait for opponent commit, reveal, wait for result
- Payout collection
- Basic error handling (tx failures, timeouts, reverts)
- Event listening for opponent actions

### Out of Scope

- Smart strategy (Phase 3) — use random moves for now
- Multiple opponents (Phase 3)
- Bankroll management (Phase 3)
- Poker or Auction gameplay (Phase 4–5)
- Dashboard or fancy logging (Phase 7)

---

## Tasks

### Task 2.1 — Contract Interaction Layer

- **Description:** Create typed TypeScript wrappers around the three deployed contracts (AgentRegistry, Escrow, RPSGame). Use ethers.js Contract class with the generated ABIs. Provide methods for every on-chain action the agent needs: `register()`, `createMatch()`, `acceptMatch()`, `commitMove()`, `revealMove()`, `claimPayout()`, `getOpenAgents()`, etc.
- **Owner:** —
- **Acceptance Criteria:**
  - Each contract has a typed wrapper class/module
  - All methods call the correct contract functions with proper parameters
  - Gas estimation and nonce management handled
  - Error messages are human-readable (decode revert reasons)

### Task 2.2 — Agent Registration

- **Description:** On startup, the fighter agent checks if it's already registered on the AgentRegistry. If not, it registers with: its wallet address, supported game types (initially just "RPS"), wager range, and open-to-challenge = true.
- **Owner:** —
- **Acceptance Criteria:**
  - Agent registers successfully on first run
  - On subsequent runs, detects existing registration and skips
  - Registration verifiable via `cast call` to AgentRegistry

### Task 2.3 — Opponent Discovery

- **Description:** Agent scans the AgentRegistry for other registered agents that are open to challenges and support RPS. Returns a list of potential opponents with their addresses, ELO, and wager ranges.
- **Owner:** —
- **Acceptance Criteria:**
  - Discovery returns all open RPS-capable agents
  - Excludes self from results
  - Returns structured opponent data (address, ELO, wager range)

### Task 2.4 — Match Initiation via Escrow

- **Description:** Agent selects an opponent and creates a match via the Escrow contract. Locks the wager amount in MON. Emits an event that the opponent can listen for.
- **Owner:** —
- **Acceptance Criteria:**
  - Match created with correct wager amount
  - MON locked in Escrow contract
  - Match ID returned and stored
  - Event emitted for opponent notification

### Task 2.5 — RPS Commit-Reveal Flow

- **Description:** Implement the full RPS round: generate a random move (rock/paper/scissors), create salt, compute `keccak256(move + salt)`, submit commit to RPSGame contract, wait for opponent commit, then reveal move + salt. Handle per-round logic for best-of-N matches.
- **Owner:** —
- **Acceptance Criteria:**
  - Commit hash computed correctly (matches contract verification)
  - Agent waits for opponent commit before revealing
  - Reveal transaction succeeds and is verified by contract
  - Round result detected from contract events
  - Best-of-N match tracking works (win/loss/draw per round)

### Task 2.6 — Payout Collection

- **Description:** After match completion, agent detects the result and collects winnings from Escrow if it won. On loss, logs the result and updates local state. On draw, verifies refund.
- **Owner:** —
- **Acceptance Criteria:**
  - Winner collects full payout from Escrow
  - Loss is handled gracefully (no crashes)
  - Draw triggers refund verification
  - Final MON balance reflects match outcome

### Task 2.7 — Main Agent Loop

- **Description:** Wire all components into a main loop: startup → register → scan for opponents → select opponent → create/accept match → play RPS → collect result → repeat. Include basic logging (which opponent, what happened, MON balance changes).
- **Owner:** —
- **Acceptance Criteria:**
  - Agent runs autonomously from a single start command
  - Completes at least 1 full match without human intervention
  - Logs show each step: registration, discovery, match creation, commits, reveals, result, payout
  - Agent handles "no opponents available" gracefully (waits and retries)

### Task 2.8 — End-to-End Test

- **Description:** Run the fighter agent against a second instance (or a simple manual opponent using cast) on Monad testnet. Verify the full flow works: both agents register, match is created, RPS rounds play out, escrow settles, registry updates.
- **Owner:** —
- **Acceptance Criteria:**
  - Full match completes on Monad testnet (not just local Anvil)
  - Both agents' registries show updated match history
  - Escrow balance changes are correct
  - ELO ratings updated in registry
  - All transaction hashes logged

---

## Deliverables

1. Fighter skill TypeScript codebase with contract interaction layer
2. Working agent that completes 1 autonomous RPS match
3. Transaction log from the end-to-end test
4. ABI wrapper modules for all 3 contracts

---

## Test / Acceptance Criteria

- Agent starts, registers, finds opponent, plays RPS match, and collects result — all autonomously
- At least 1 complete match on Monad testnet verified by transaction hashes
- No manual intervention required after initial `start` command

---

## Gate Checklist

- [ ] Contract interaction layer covers all needed functions
- [ ] Agent registers itself on AgentRegistry
- [ ] Agent discovers opponents from registry
- [ ] Agent creates/accepts a match via Escrow
- [ ] Commit-reveal RPS flow completes without errors
- [ ] Payout collected (or loss handled) correctly
- [ ] 1 full autonomous match completed on Monad testnet
- [ ] All tx hashes logged and verifiable on block explorer
