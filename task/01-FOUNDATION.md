# Task 01 — Phase 1: Foundation & Environment Setup

> **DISCLAIMER:** Before starting development, reference official and up-to-date documentation for OpenClaw (https://docs.openclaw.ai), Foundry, Monad testnet, and Solidity. Do not assume cached knowledge is current. Use MCP tools or official docs sites.

---

## Phase Metadata

- **Phase:** 1
- **Name:** Foundation & Environment Setup
- **Status:** Not Started
- **Depends On:** None
- **Blocks:** Phase 2

---

## Objectives

1. Install and configure OpenClaw locally
2. Set up the Foundry development environment for Solidity contract development
3. Configure a Monad testnet wallet and fund it with testnet MON
4. Write, test, and deploy three core smart contracts: AgentRegistry, Escrow, RPSGame
5. Scaffold the fighter skill directory (`SKILL.md` + `scripts/` + `lib/`)
6. Verify all contracts work correctly on Monad testnet via manual interaction

---

## Prerequisites

- Node.js and npm/pnpm installed
- Python 3.10+ installed (for skill scripts)
- Rust + Foundry (forge, cast, anvil) installed
- Git configured
- Access to Monad testnet faucet
- LLM API key (Claude or GPT-4) for OpenClaw

---

## Scope

### In Scope

- OpenClaw installation and onboarding
- Foundry project initialization with Monad testnet config
- Wallet creation and funding
- AgentRegistry.sol — registration, discovery, ELO fields, match history storage
- Escrow.sol — wager locking, payout, timeout/draw handling
- RPSGame.sol — commit-reveal RPS, best-of-N, timeout forfeit
- Foundry unit tests for all three contracts
- Deployment scripts targeting Monad testnet
- Manual verification via `cast` calls
- Fighter skill directory scaffold with SKILL.md stub

### Out of Scope

- PokerGame, AuctionGame, Tournament, PredictionMarket contracts (later phases)
- Fighter skill logic / strategy scripts (Phase 2+)
- Opponent bots (Phase 3)
- Dashboard or logging (Phase 7)

---

## Tasks

### Task 1.1 — Install and Configure OpenClaw

- **Description:** Install OpenClaw via npm (`npm i -g openclaw`) or the one-liner install script. Run `openclaw onboard` to complete initial setup. Configure LLM provider (Claude API key or other). Verify OpenClaw starts and can respond to messages. Understand the skill loading system: how skills are discovered from `~/.openclaw/skills/` and workspace `skills/` directories.
- **Owner:** —
- **Acceptance Criteria:**
  - OpenClaw installed and running locally
  - LLM provider configured and responding
  - `openclaw` CLI starts without errors
  - Understand skill discovery paths and SKILL.md format

### Task 1.2 — Initialize Foundry Project

- **Description:** Create a new Foundry project under `contracts/`. Configure `foundry.toml` with Monad testnet RPC endpoint, chain ID, and compiler settings. Add OpenZeppelin as a dependency if needed.
- **Owner:** —
- **Acceptance Criteria:**
  - `forge build` succeeds with zero errors
  - `foundry.toml` contains Monad testnet RPC URL and chain ID
  - Directory structure matches: `contracts/src/`, `contracts/test/`, `contracts/script/`

### Task 1.3 — Monad Testnet Wallet Setup

- **Description:** Create a new wallet (or import existing) for the main deployer/fighter. Claim testnet MON from the Monad faucet. Create 5 additional wallets for opponent bots (Phase 3 will use them, but create them now). Store private keys securely in `.env` (gitignored).
- **Owner:** —
- **Acceptance Criteria:**
  - Deployer/fighter wallet has ≥100 testnet MON
  - 5 opponent wallets created and addresses recorded
  - Private keys stored securely (`.env` file, gitignored)
  - `cast balance <deployer_address> --rpc-url <monad_rpc>` returns non-zero

### Task 1.4 — Write AgentRegistry.sol

- **Description:** Implement the Agent Registry contract. Agents register with: wallet address, supported game types (array), min/max wager range, open-to-challenge flag. The contract stores per-game-type ELO ratings (default 1000) and match history entries (opponent, game type, result, wager). Include functions: `register()`, `updateStatus()`, `getAgent()`, `listOpenAgents()`, `updateELO()`, `recordMatch()`.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Agent can register and query own data
  - ELO defaults to 1000 per game type
  - Match history records append correctly
  - Open-to-challenge filtering works
  - Only authorized game contracts can call `updateELO()` and `recordMatch()`

### Task 1.5 — Write Escrow.sol

- **Description:** Implement the shared Escrow contract. Supports: creating a match escrow (locks challenger MON), accepting (locks opponent MON), settling (winner gets both minus optional fee), timeout forfeit, draw refund. Must support tournament-mode payout structures (different distribution). Game contracts call settle functions.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - MON locks correctly on create and accept
  - Winner receives correct payout on settlement
  - Draw returns funds to both parties
  - Timeout forfeit releases funds to non-forfeiting party
  - Only authorized game contracts can trigger settlement

### Task 1.6 — Write RPSGame.sol

- **Description:** Implement commit-reveal Rock-Paper-Scissors. Flow: both players commit `keccak256(move + salt)` → both reveal move + salt → contract verifies hashes → determines round winner. Support best-of-1, best-of-3, best-of-N modes. Include timeout enforcement (failure to commit/reveal = forfeit). On match completion, call Escrow to settle and AgentRegistry to update ELO/history.
- **Owner:** —
- **Acceptance Criteria:**
  - Contract compiles with `forge build`
  - Full commit-reveal flow works in tests
  - Best-of-N rounds tracked correctly
  - Hash verification catches invalid reveals
  - Timeout forfeit triggers correctly
  - Match result settles escrow and updates registry

### Task 1.7 — Write Foundry Tests

- **Description:** Write comprehensive Foundry tests for all three contracts. Test happy paths, edge cases (double registration, invalid reveals, timeout scenarios, insufficient funds), and contract interactions (RPS → Escrow settlement → Registry ELO update).
- **Owner:** —
- **Acceptance Criteria:**
  - `forge test` passes all tests
  - Coverage includes: registration, escrow create/accept/settle/timeout/draw, RPS commit/reveal/win/draw/timeout
  - Integration test: full RPS match flow from escrow lock through ELO update

### Task 1.8 — Deploy to Monad Testnet

- **Description:** Write Foundry deployment scripts for all three contracts. Deploy in order: AgentRegistry → Escrow → RPSGame. Configure cross-contract references (RPSGame knows Escrow and Registry addresses). Verify deployments.
- **Owner:** —
- **Acceptance Criteria:**
  - All three contracts deployed to Monad testnet
  - Contract addresses recorded in a config file
  - `cast call` to each contract returns expected data
  - Cross-contract references configured correctly

### Task 1.9 — Manual Verification via Cast

- **Description:** Run through the full RPS flow manually using `cast` CLI commands: register two agents, create escrow, commit moves, reveal moves, verify settlement. This validates the contracts work on Monad testnet (not just local Anvil).
- **Owner:** —
- **Acceptance Criteria:**
  - Two agents registered via `cast send`
  - Escrow created and funded
  - RPS commit-reveal completes
  - Winner receives payout
  - Registry shows updated ELO and match history

### Task 1.10 — Scaffold Fighter Skill Directory

- **Description:** Create the fighter skill directory structure at `skills/fighter/`. Write a stub `SKILL.md` with proper YAML frontmatter (name, description, requires.bins for python3, requires.env for MONAD_PRIVATE_KEY and MONAD_RPC_URL). Create `scripts/`, `lib/`, `references/` directories. Set up `pyproject.toml` with web3.py dependency. Create `lib/contracts.py` with deployed contract ABIs and addresses. Verify OpenClaw discovers the skill.
- **Owner:** —
- **Acceptance Criteria:**
  - `skills/fighter/SKILL.md` exists with valid YAML frontmatter
  - `skills/fighter/scripts/` directory created
  - `skills/fighter/lib/contracts.py` has ABIs and deployed addresses
  - `pyproject.toml` lists web3.py as dependency
  - Python venv created and web3.py installed
  - OpenClaw discovers the fighter skill (shows in skill list)
  - Config file has Monad RPC URL and wallet reference

---

## Deliverables

1. OpenClaw installed and running locally
2. Foundry project with three compiled, tested contracts
3. Deployment scripts and deployed contract addresses on Monad testnet
4. 6 funded wallets (1 fighter + 5 opponent placeholders)
5. Fighter skill scaffold (`SKILL.md` + directory structure + ABIs)
6. Manual verification log (cast commands and outputs)

---

## Test / Acceptance Criteria

- OpenClaw starts and responds to basic commands
- `forge build` — zero errors
- `forge test` — all tests pass
- All 3 contracts deployed to Monad testnet and responding to `cast call`
- Fighter skill discovered by OpenClaw
- Manual RPS match completed on testnet via `cast`

---

## Gate Checklist

- [x] OpenClaw installed and configured with LLM provider
- [x] Foundry project compiles cleanly
- [x] All Foundry tests pass (60/60 — 27 RPSGame + 17 Escrow + 16 AgentRegistry)
- [x] AgentRegistry deployed to Monad testnet (`0x96728e09...`)
- [x] Escrow deployed to Monad testnet (`0x16d9CD10...`)
- [x] RPSGame deployed to Monad testnet (`0x2A622c18...`) — includes ERC-8004 reputation
- [x] ERC-8004 interfaces created (IReputationRegistry, IIdentityRegistry)
- [x] ERC-8004 agent registration scaffold (`agent/` directory)
- [ ] Manual RPS match verified on testnet
- [x] Fighter wallet funded with testnet MON
- [x] 5 opponent wallets created
- [x] Fighter skill scaffold created and discovered by OpenClaw
- [x] Contract ABIs and addresses in `lib/contracts.py`
- [x] web3.py installed and able to connect to Monad testnet
