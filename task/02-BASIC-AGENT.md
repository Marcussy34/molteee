# Phase 2: Basic Agent

**Phase:** 2 of 6
**Name:** Basic Agent
**Status:** Not Started

---

## Objectives

1. Set up OpenClaw skill project structure
2. Connect to Monad testnet via ethers.js
3. Build minimal fighter agent that can:
   - Register on AgentRegistry
   - Create or accept a match
   - Complete commit-reveal RPS flow
   - Collect winnings
4. Successfully complete 1 full autonomous match

---

## Prerequisites

- [ ] Phase 1 complete (all contracts deployed)
- [ ] Contract addresses documented
- [ ] OpenClaw SDK installed
- [ ] Monad testnet wallet funded
- [ ] Node.js 18+ installed

---

## Scope

### In Scope
- OpenClaw skill initialization
- ethers.js blockchain connection
- Contract ABI generation/import
- Basic agent registration flow
- Match creation and acceptance
- Commit-reveal implementation
- Payout collection
- Basic logging

### Out of Scope
- Strategy/pattern recognition (Phase 4)
- Multiple opponents (Phase 3)
- Dashboard/UI (Phase 5)
- Advanced bankroll management (Phase 4)

---

## Tasks

### 2.1: Initialize OpenClaw Skill Project

**Description:** Create OpenClaw skill project with proper structure for the fighter agent.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Skill project initialized with `openclaw init`
- [ ] TypeScript configured
- [ ] Project structure follows OpenClaw conventions
- [ ] Dependencies installed (ethers, etc.)
- [ ] Skill runs locally without errors

**Folder Structure:**
```
agent/
├── src/
│   ├── index.ts          # Main skill entry
│   ├── blockchain.ts     # Chain connection
│   ├── contracts/        # ABIs and types
│   ├── actions/          # Skill actions
│   └── utils/            # Helpers
├── package.json
├── tsconfig.json
└── .env.example
```

**Verification:**
```bash
cd agent && npm run dev
```

---

### 2.2: Set Up ethers.js Connection to Monad

**Description:** Create blockchain connection module with proper error handling.

**Owner:** _____

**Acceptance Criteria:**
- [ ] JsonRpcProvider connects to Monad testnet
- [ ] Wallet loaded from private key
- [ ] Connection verified (can get block number)
- [ ] Proper error handling for network issues
- [ ] Environment variables for configuration

**Code Location:** `agent/src/blockchain.ts`

**Verification:**
```typescript
// Should log current block number
const provider = getProvider();
console.log(await provider.getBlockNumber());
```

---

### 2.3: Implement Contract ABIs and Type Generation

**Description:** Import contract ABIs and generate TypeScript types for type-safe interactions.

**Owner:** _____

**Acceptance Criteria:**
- [ ] ABIs copied from Foundry build artifacts
- [ ] TypeScript types generated (typechain or manual)
- [ ] Contract instances created with proper typing
- [ ] All contract methods accessible and typed

**Files:**
- `agent/src/contracts/abis/AgentRegistry.json`
- `agent/src/contracts/abis/Escrow.json`
- `agent/src/contracts/abis/RPSGame.json`
- `agent/src/contracts/types.ts`
- `agent/src/contracts/index.ts`

**Verification:**
```typescript
const game = getRPSGame();
// TypeScript should autocomplete methods
game.createMatch(wager);
```

---

### 2.4: Build Registration Logic

**Description:** Implement agent registration with AgentRegistry contract.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Can register new agent with name
- [ ] Checks if already registered (avoids duplicate)
- [ ] Stores agent ID for future use
- [ ] Handles registration errors gracefully
- [ ] Logs registration success/failure

**Code Location:** `agent/src/actions/register.ts`

**Verification:**
```bash
# Run registration action
npm run action:register
# Check agent is registered on-chain
cast call $REGISTRY "getAgent(uint256)" 1
```

---

### 2.5: Build Challenge/Accept Logic

**Description:** Implement match creation and acceptance flow.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Can create new match with specified wager
- [ ] Can query open matches
- [ ] Can accept existing match
- [ ] Validates wager amount before accepting
- [ ] Returns match ID for tracking
- [ ] Logs match creation/acceptance

**Code Location:** `agent/src/actions/match.ts`

**Functions:**
```typescript
async function createMatch(wagerEth: string): Promise<bigint>;
async function getOpenMatches(): Promise<Match[]>;
async function acceptMatch(matchId: bigint): Promise<void>;
```

**Verification:**
```bash
npm run action:create-match -- --wager 0.1
npm run action:list-matches
npm run action:accept-match -- --id 1
```

---

### 2.6: Build Commit-Reveal RPS Logic

**Description:** Implement the core commit-reveal RPS game flow.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Generate random salt for commitment
- [ ] Create commitment hash: `keccak256(move + salt)`
- [ ] Submit commitment to contract
- [ ] Store move and salt locally (for reveal)
- [ ] Wait for opponent commitment
- [ ] Submit reveal with move and salt
- [ ] Handle reveal ordering (who reveals first)
- [ ] Detect and handle timeouts

**Code Location:** `agent/src/actions/rps.ts`

**Move Encoding:**
```typescript
enum Move {
  ROCK = 0,
  PAPER = 1,
  SCISSORS = 2
}
```

**Functions:**
```typescript
async function commitMove(matchId: bigint, move: Move): Promise<void>;
async function revealMove(matchId: bigint): Promise<void>;
function generateCommitment(move: Move): { hash: bytes32, salt: bytes32 };
```

**Verification:**
```bash
# Commit a move
npm run action:commit -- --match 1 --move rock
# Reveal the move
npm run action:reveal -- --match 1
```

---

### 2.7: Build Payout Collection Logic

**Description:** Implement logic to collect winnings after match resolution.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Detect when match is resolved
- [ ] Check if agent is the winner
- [ ] Claim payout from Escrow
- [ ] Handle draw case (refund)
- [ ] Log payout amount received
- [ ] Update local balance tracking

**Code Location:** `agent/src/actions/payout.ts`

**Functions:**
```typescript
async function checkMatchResult(matchId: bigint): Promise<MatchResult>;
async function claimPayout(matchId: bigint): Promise<void>;
```

**Verification:**
```bash
npm run action:check-result -- --match 1
npm run action:claim -- --match 1
# Verify balance increased
cast balance $WALLET --rpc-url $MONAD_RPC
```

---

### 2.8: End-to-End Test: One Full Match

**Description:** Run complete match flow from start to finish against a test opponent.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Agent registers (if not already)
- [ ] Agent creates match OR accepts open match
- [ ] Both players commit moves
- [ ] Both players reveal moves
- [ ] Winner determined correctly
- [ ] Payout distributed correctly
- [ ] Full flow completes without manual intervention
- [ ] All steps logged clearly

**Test Setup:**
- Use two wallets (fighter + test opponent)
- Can manually control opponent OR write simple opponent script

**Verification:**
```bash
# Terminal 1: Run fighter agent
npm run agent:fight

# Terminal 2: Run dummy opponent (or manual cast commands)
npm run agent:dummy

# Check final balances
cast balance $FIGHTER_WALLET
cast balance $OPPONENT_WALLET
```

---

## Deliverables

1. **OpenClaw skill project** in `/agent` folder
2. **Working fighter agent** that completes matches
3. **All action modules** (register, match, rps, payout)
4. **Configuration guide** for running the agent
5. **Test script** for end-to-end verification

---

## Test/Acceptance Criteria

This phase is complete when:

1. Agent successfully registers on AgentRegistry
2. Agent creates OR accepts a match
3. Agent completes commit-reveal flow
4. Agent collects payout (or handles loss)
5. Full match completes without manual steps
6. Clear logs show each step of the process

---

## Gate Checklist

Before moving to Phase 3/4, verify:

- [ ] OpenClaw skill runs without errors
- [ ] Agent connects to Monad testnet
- [ ] Registration works
- [ ] Match creation works
- [ ] Match acceptance works
- [ ] Commit phase works
- [ ] Reveal phase works
- [ ] Payout collection works
- [ ] End-to-end test passes
- [ ] Logs are clear and informative

---

## Notes

- Use random move selection for now (strategy in Phase 4)
- Keep code modular for easy enhancement later
- Log everything for debugging
- Handle errors gracefully (don't crash on network issues)
- Store state persistently if possible (for resuming)
