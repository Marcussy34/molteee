# Phase 1 — Foundation & Environment Setup (COMPLETED)

> **Completed:** February 6, 2026
> **Phase:** 1 of 8
> **Status:** Done

---

## Summary

Phase 1 established the full development foundation for the Gaming Arena Agent hackathon project. All smart contracts are written, tested (60 tests passing), deployed to Monad testnet (v2 with ERC-8004 reputation), and verified on-chain. The OpenClaw fighter skill is scaffolded and discoverable. Six wallets are created and the deployer is funded. ERC-8004 agent registration scaffold created.

---

## What Was Done

### 1. Environment Setup

- **Foundry upgraded** from v1.2.3 (Homebrew) to **v1.5.1** (required v1.5.0+ for Prague EVM)
- **`.gitignore`** created — covers Foundry artifacts, `.env`, Python, Node, OS files
- **`.env.example`** created — template with all required env vars
- **`.env`** created — populated with all keys, addresses, and deployed contract addresses

### 2. Foundry Project Initialized

- Initialized via `forge init contracts --template monad-developers/foundry-monad`
- Template provided: forge-std, OpenZeppelin contracts, pre-configured structure
- **`foundry.toml`** configured with:
  - `evm_version = "prague"` (required by Monad)
  - `solc_version = "0.8.28"` with optimizer (200 runs)
  - Remappings for `@openzeppelin/contracts/` and `forge-std/`
  - Monad testnet RPC endpoint and explorer
  - `cbor_metadata = false` + `bytecode_hash = "none"` for smaller bytecode
- Removed template Counter files (Counter.sol, Counter.t.sol, Counter.s.sol)
- Removed nested `.git` from contracts/ (integrated into parent repo)

### 3. Wallets Created

6 wallets generated via `cast wallet new`:

| Wallet | Address | Purpose |
|--------|---------|---------|
| Deployer/Fighter | `0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf` | Main agent wallet |
| Opponent 1 | `0xCD40Da7306672aa1151bA43ff479e93023e21e1f` | Phase 3 bot |
| Opponent 2 | `0x37D06C086C9DFC48205d777B0159680ADe7FEfE1` | Phase 3 bot |
| Opponent 3 | `0x8290c36e60A57F86bab44949CE114B348c4C8c5A` | Phase 3 bot |
| Opponent 4 | `0x3828B000Fed74Bac8636405DF366FcEb72710496` | Phase 3 bot |
| Opponent 5 | `0xA56766DD77917EFE3E6403BDDDB32E7c9576CAFE` | Phase 3 bot |

- All private keys stored in `.env` (gitignored)
- Deployer funded with 2 MON via faucet (~1.39 MON remaining after deployment)

### 4. AgentRegistry.sol

**File:** `contracts/src/AgentRegistry.sol`

Features implemented:
- `GameType` enum: RPS, Poker, Auction (extensible)
- `AgentInfo` struct: wallet, gameTypes[], minWager, maxWager, isOpen, exists
- ELO storage: `mapping(address => mapping(GameType => uint256))` — defaults to 1000
- Match history: `MatchRecord` struct array per agent (opponent, gameType, won, wager, timestamp)
- Authorization: `mapping(address => bool) authorizedContracts` — set by owner
- Functions: `register()`, `updateStatus()`, `getAgent()`, `getOpenAgents()`, `updateELO()`, `recordMatch()`, `getMatchHistory()`, `getMatchCount()`, `authorizeContract()`
- Inherits OpenZeppelin `Ownable`

### 5. Escrow.sol

**File:** `contracts/src/Escrow.sol`

Features implemented:
- `Match` struct: player1, player2, wager, gameContract, status (Created/Active/Settled/Cancelled), createdAt
- `createMatch()` — locks challenger's MON, validates game contract is authorized
- `acceptMatch()` — locks opponent's matching wager
- `settle()` — sends both wagers to winner (only authorized game contracts)
- `settleDraw()` — refunds both players
- `cancelMatch()` — challenger reclaims wager after 1-hour timeout
- Inherits OpenZeppelin `Ownable` + `ReentrancyGuard`

### 6. RPSGame.sol

**File:** `contracts/src/RPSGame.sol`

Features implemented:
- Commit-reveal flow: `commit(hash)` → `reveal(move, salt)` — prevents front-running
- Best-of-N rounds (odd numbers only), early majority termination
- `Game` struct with phase tracking (Commit/Reveal/Complete), scores, deadlines
- `RoundData` struct with commit hashes, revealed moves, reveal flags
- All 9 move combinations handled correctly (Rock/Paper/Scissors)
- Timeout enforcement: configurable per-phase timeout (default 5 minutes)
- `claimTimeout()` — awards match to the player who acted on time
- On completion: calls `escrow.settle()` / `settleDraw()` + `registry.updateELO()` + `registry.recordMatch()`
- ELO calculation: simplified integer approximation with K-factor of 32, floor of 100

### 7. Foundry Tests

**60 tests across 3 test suites — all passing.**

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| `AgentRegistry.t.sol` | 16 | Registration, double-register revert, status toggle, open agents filtering by game type, ELO updates, match records, authorization |
| `Escrow.t.sol` | 17 | Create/accept match, wager locking, settlement to winner, draw refund, timeout cancellation, authorization checks, balance verification |
| `RPSGame.t.sol` | 27 | Game creation, all 9 move combinations, best-of-1 (win/loss/draw), best-of-3 (early majority + full 3 rounds), commit/reveal validation (double commit, hash mismatch, wrong phase, Move.None), timeout (commit/reveal phases, neither committed), ELO update integration, match record integration, **ERC-8004 reputation feedback** (after match, not on draw, skipped without agentIds, skipped without registry), setAgentId, setAgentId revert |

### 8. Deployment to Monad Testnet

**File:** `contracts/script/Deploy.s.sol`

Deployment order:
1. AgentRegistry deployed
2. Escrow deployed
3. RPSGame deployed (with Escrow + Registry addresses)
4. `escrow.authorizeContract(rpsGame)` — RPSGame can settle matches
5. `registry.authorizeContract(rpsGame)` — RPSGame can update ELO/history

| Contract | Deployed Address (v1 — no ERC-8004) | Deployed Address (v2 — with ERC-8004) |
|----------|--------------------------------------|---------------------------------------|
| AgentRegistry | `0x88Ca39AE...` (deprecated) | `0x96728e0962d7B3fA3B1c632bf489004803C165cE` |
| Escrow | `0x8C685b42...` (deprecated) | `0x16d9CD10c426B4c82d07E4f90B7fB7E02b2715Bc` |
| RPSGame | `0x14C394b4...` (deprecated) | `0x2A622c1878335149c251Be32dE5660297609A12f` |

ERC-8004 Singletons (not deployed by us):
| Registry | Address |
|----------|---------|
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

**On-chain verification (v2):**
- `reputationRegistry()` returns `0x8004B663...` (ERC-8004 Reputation Registry)
- `phaseTimeout()` returns 300 (5 minutes)
- `authorizedContracts(rpsGame)` returns true on both Escrow and Registry
- v2 deployment cost: ~0.64 MON

### 9. ERC-8004 Agent Registration

- **Agent ID: 10** on ERC-8004 Identity Registry
- Registration metadata uploaded to IPFS: `ipfs://QmbtN8zWfhVmSJ4HoDztwEWpP6osFD5vXMHZrsZXgpJJtY`
- Registration TX: `0x6432f1b64bdcf04f95755f3c230705e4f1fd23455f46b44efb27116b1588c06e` (block 11036490)
- `setAgentId` TX: `0xfd93e3738532531ad0d0fe342a8d558b2ba95ccf025bd1a158f6e3be1fc66493` (block 11036527)
- Agent viewable at: https://8004scan.io/agent/10
- Pinata gateway: https://gateway.pinata.cloud/ipfs/QmbtN8zWfhVmSJ4HoDztwEWpP6osFD5vXMHZrsZXgpJJtY
- `agentIds(fighterAddress)` returns `10` in RPSGame contract — reputation feedback will be posted after matches

**Agent registration directory:**
```
agent/
├── package.json              # Registration-only deps (dotenv, ethers)
├── tsconfig.json             # ES2022 target
├── registration.json         # ERC-8004 metadata (name, description, trust models)
├── .well-known/
│   └── agent-card.json       # A2A discovery card
├── src/
│   └── register.ts           # IPFS upload + Identity Registry mint script
├── .env                      # Private key + Pinata JWT (gitignored)
└── .gitignore
```

### 10. OpenClaw Installation & Fighter Skill Scaffold

- **OpenClaw v2026.2.3-1** installed globally via npm
- Onboarded with workspace set to `/Users/marcus/Projects/molteee`
- **Fighter skill discovered** by OpenClaw (`✓ ready`, source: `openclaw-workspace`)

Skill directory structure:
```
skills/fighter/
├── SKILL.md              # Frontmatter (name, description, requires) + LLM instructions
├── pyproject.toml        # Python deps (web3>=7.0.0, python-dotenv)
├── scripts/
│   └── arena.py          # CLI dispatcher stub (status, register, find-opponents, etc.)
├── lib/
│   ├── __init__.py
│   └── contracts.py      # ABI loader from Foundry artifacts + deployed addresses + constants
├── references/           # Empty — to be filled in Phase 3+
└── venv/                 # Python 3.13.5 venv with web3.py 7.14.1 installed
```

**Verified:**
- `web3.py` connects to Monad testnet (Chain ID 10143, block 11000839+)
- ABI loader reads all 3 contract ABIs from Foundry build artifacts (24 + 25 + 27 entries)
- `arena.py` CLI dispatcher responds to all commands (stubs for Phase 2)

---

## Files Created/Modified

```
/Users/marcus/Projects/molteee/
├── .gitignore                                    # NEW
├── .env.example                                  # NEW
├── .env                                          # NEW (gitignored, has all keys + addresses)
├── contracts/
│   ├── foundry.toml                              # MODIFIED (Prague EVM, remappings, Monad config)
│   ├── src/
│   │   ├── AgentRegistry.sol                     # NEW (162 lines)
│   │   ├── Escrow.sol                            # NEW (131 lines)
│   │   └── RPSGame.sol                           # NEW (370 lines)
│   ├── test/
│   │   ├── AgentRegistry.t.sol                   # NEW (16 tests)
│   │   ├── Escrow.t.sol                          # NEW (17 tests)
│   │   └── RPSGame.t.sol                         # NEW (21 tests)
│   ├── script/
│   │   └── Deploy.s.sol                          # NEW
│   └── broadcast/Deploy.s.sol/10143/             # AUTO-GENERATED (deployment receipts)
├── agent/                                        # NEW (ERC-8004 registration)
│   ├── package.json                              # NEW
│   ├── tsconfig.json                             # NEW
│   ├── registration.json                         # NEW (agent metadata)
│   ├── .well-known/agent-card.json               # NEW (A2A discovery)
│   ├── src/register.ts                           # NEW (IPFS upload + mint)
│   ├── .env                                      # NEW (gitignored)
│   └── .gitignore                                # NEW
├── skills/fighter/
│   ├── SKILL.md                                  # NEW
│   ├── pyproject.toml                            # NEW
│   ├── scripts/arena.py                          # NEW (stub)
│   ├── lib/__init__.py                           # NEW
│   ├── lib/contracts.py                          # NEW
│   ├── references/                               # NEW (empty)
│   └── venv/                                     # NEW (web3.py installed)
└── opponents/                                    # NEW (empty, for Phase 3)
```

---

## Gate Checklist

- [x] OpenClaw installed and configured with LLM provider
- [x] Foundry project compiles cleanly (`forge build` — zero errors)
- [x] All Foundry tests pass (`forge test` — 60/60)
- [x] AgentRegistry deployed to Monad testnet (`0x96728e09...`)
- [x] Escrow deployed to Monad testnet (`0x16d9CD10...`)
- [x] RPSGame deployed to Monad testnet (`0x2A622c18...`)
- [x] Cross-contract authorization verified on-chain
- [x] Fighter wallet funded with testnet MON (~1.39 MON remaining)
- [x] 5 opponent wallets created (addresses in `.env`)
- [x] Fighter skill scaffold created and discovered by OpenClaw
- [x] Contract ABIs and addresses in `lib/contracts.py`
- [x] web3.py installed and connects to Monad testnet
- [x] ERC-8004 agent registered (Agent ID: 10) on Identity Registry
- [x] IPFS metadata uploaded via Pinata (`QmbtN8z...`)
- [x] agentId set in RPSGame contract for reputation feedback

---

## Notes for Phase 2

- Arena.py commands are stubs — need actual implementations using web3.py
- SKILL.md instructions are basic — need detailed match lifecycle and strategy guidance
- Opponent wallets have 0 MON — fund via faucet when Phase 3 starts
- The `references/` directory is empty — strategy docs come in Phase 3+
- Contracts use `try/catch` for registry calls in RPSGame — unregistered agents can still play but won't get ELO updates
