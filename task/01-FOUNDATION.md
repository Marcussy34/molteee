# Task 01 — Phase 1: Foundation & Environment Setup

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for Foundry, Monad testnet, OpenClaw SDK, and Solidity. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 1
- **Name:** Foundation & Environment Setup
- **Status:** Not Started
- **Depends On:** None
- **Blocks:** Phase 2

---

## Objectives

1. Set up the Foundry development environment for Solidity contract development
2. Configure a Monad testnet wallet and fund it with testnet MON
3. Write, test, and deploy three core smart contracts: AgentRegistry, Escrow, RPSGame
4. Set up the OpenClaw SDK and scaffold the skill project
5. Verify all contracts work correctly on Monad testnet via manual interaction

---

## Prerequisites

- Node.js and npm/pnpm installed
- Rust + Foundry (forge, cast, anvil) installed
- Git configured
- Access to Monad testnet faucet
- OpenClaw account and SDK access

---

## Scope

### In Scope

- Foundry project initialization with Monad testnet config
- Wallet creation and funding
- AgentRegistry.sol — registration, discovery, ELO fields, match history storage
- Escrow.sol — wager locking, payout, timeout/draw handling
- RPSGame.sol — commit-reveal RPS, best-of-N, timeout forfeit
- Foundry unit tests for all three contracts
- Deployment scripts targeting Monad testnet
- Manual verification via `cast` calls
- OpenClaw SDK installation and skill project scaffold

### Out of Scope

- PokerGame, AuctionGame, Tournament, PredictionMarket contracts (later phases)
- Agent logic / strategy (Phase 2+)
- Opponent agents (Phase 3)
- Dashboard or logging (Phase 7)

---

## Tasks

### Task 1.1 — Initialize Foundry Project

- **Description:** Create a new Foundry project under `contracts/`. Configure `foundry.toml` with Monad testnet RPC endpoint, chain ID, and compiler settings. Add OpenZeppelin as a dependency if needed.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge build` succeeds with zero errors
  - `foundry.toml` contains Monad testnet RPC URL and chain ID
  - Directory structure matches: `contracts/src/`, `contracts/test/`, `contracts/script/`

### Task 1.2 — Monad Testnet Wallet Setup

- **Description:** Create a new wallet (or import existing) for the main deployer. Claim testnet MON from the Monad faucet. Create 5 additional wallets for opponent agents (Phase 3 will use them, but create them now).
- **Owner:** —
- **Acceptance Criteria:**
  - Deployer wallet has ≥100 testnet MON
  - 5 opponent wallets created and addresses recorded
  - Private keys stored securely (`.env` file, gitignored)
  - `cast balance <deployer_address> --rpc-url <monad_rpc>` returns non-zero

### Task 1.3 — Write AgentRegistry.sol

- **Description:** Implement the Agent Registry contract. Agents register with: wallet address, supported game types (array), min/max wager range, open-to-challenge flag. The contract stores per-game-type ELO ratings (default 1000) and match history entries (opponent, game type, result, wager). Include functions: `register()`, `updateStatus()`, `getAgent()`, `listOpenAgents()`, `updateELO()`, `recordMatch()`.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Agent can register and query own data
  - ELO defaults to 1000 per game type
  - Match history records append correctly
  - Open-to-challenge filtering works
  - Only authorized game contracts can call `updateELO()` and `recordMatch()`

### Task 1.4 — Write Escrow.sol

- **Description:** Implement the shared Escrow contract. Supports: creating a match escrow (locks challenger MON), accepting (locks opponent MON), settling (winner gets both minus optional fee), timeout forfeit, draw refund. Must support tournament-mode payout structures (different distribution). Game contracts call settle functions.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - MON locks correctly on create and accept
  - Winner receives correct payout on settlement
  - Draw returns funds to both parties
  - Timeout forfeit releases funds to non-forfeiting party
  - Only authorized game contracts can trigger settlement

### Task 1.5 — Write RPSGame.sol

- **Description:** Implement commit-reveal Rock-Paper-Scissors. Flow: both players commit `keccak256(move + salt)` → both reveal move + salt → contract verifies hashes → determines round winner. Support best-of-1, best-of-3, best-of-N modes. Include timeout enforcement (failure to commit/reveal = forfeit). On match completion, call Escrow to settle and AgentRegistry to update ELO/history.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Full commit-reveal flow works in tests
  - Best-of-N rounds tracked correctly
  - Hash verification catches invalid reveals
  - Timeout forfeit triggers correctly
  - Match result settles escrow and updates registry

### Task 1.6 — Write Foundry Tests

- **Description:** Write comprehensive Foundry tests for all three contracts. Test happy paths, edge cases (double registration, invalid reveals, timeout scenarios, insufficient funds), and contract interactions (RPS → Escrow settlement → Registry ELO update).
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all tests
  - Coverage includes: registration, escrow create/accept/settle/timeout/draw, RPS commit/reveal/win/draw/timeout
  - Integration test: full RPS match flow from escrow lock through ELO update

### Task 1.7 — Deploy to Monad Testnet

- **Description:** Write Foundry deployment scripts for all three contracts. Deploy in order: AgentRegistry → Escrow → RPSGame. Configure cross-contract references (RPSGame knows Escrow and Registry addresses). Verify deployments.
- **Owner:** —
- **Acceptance Criteria:**
  - All three contracts deployed to Monad testnet
  - Contract addresses recorded in a config file / `.env`
  - `cast call` to each contract returns expected data
  - Cross-contract references configured correctly

### Task 1.8 — Manual Verification via Cast

- **Description:** Run through the full RPS flow manually using `cast` CLI commands: register two agents, create escrow, commit moves, reveal moves, verify settlement. This validates the contracts work on Monad testnet (not just local Anvil).
- **Owner:** —
- **Acceptance Criteria:**
  - Two agents registered via `cast send`
  - Escrow created and funded
  - RPS commit-reveal completes
  - Winner receives payout
  - Registry shows updated ELO and match history

### Task 1.9 — OpenClaw SDK Setup

- **Description:** Install the OpenClaw SDK. Scaffold a new skill project (TypeScript). Configure it to connect to Monad testnet. Verify the skill can be loaded and executed in the OpenClaw runtime. Generate ABIs from compiled contracts for use in the skill.
- **Owner:** —
- **Acceptance Criteria:**
  - OpenClaw SDK installed and configured
  - Skill project scaffolded with TypeScript
  - ABI files generated from Foundry artifacts
  - Skill loads in OpenClaw runtime without errors
  - Basic ethers.js connection to Monad testnet works from within the skill

---

## Deliverables

1. Foundry project with three compiled, tested contracts
2. Deployment scripts and deployed contract addresses on Monad testnet
3. 6 funded wallets (1 deployer + 5 opponent placeholders)
4. OpenClaw skill project scaffold with ABI files
5. Manual verification log (cast commands and outputs)

---

## Test / Acceptance Criteria

- `forge build` — zero errors
- `forge test` — all tests pass
- All 3 contracts deployed to Monad testnet and responding to `cast call`
- OpenClaw skill project loads without errors
- Manual RPS match completed on testnet via `cast`

---

## Gate Checklist

- [ ] Foundry project compiles cleanly
- [ ] All Foundry tests pass
- [ ] AgentRegistry deployed to Monad testnet
- [ ] Escrow deployed to Monad testnet
- [ ] RPSGame deployed to Monad testnet
- [ ] Manual RPS match verified on testnet
- [ ] Deployer wallet funded with testnet MON
- [ ] 5 opponent wallets created
- [ ] OpenClaw skill scaffold ready
- [ ] ABI files generated and accessible to skill project
