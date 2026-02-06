# Phase 1: Foundation

**Phase:** 1 of 6
**Name:** Foundation
**Status:** Not Started

---

## Objectives

1. Set up Foundry development environment for smart contracts
2. Set up OpenClaw skill development environment
3. Write and test 3 core smart contracts
4. Deploy all contracts to Monad testnet
5. Verify contracts work via manual testing

---

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Foundry installed (`curl -L https://foundry.paradigm.xyz | bash`)
- [ ] Git configured
- [ ] Monad testnet RPC URL available
- [ ] Wallet with testnet MON for gas

---

## Scope

### In Scope
- Foundry project initialization
- AgentRegistry.sol contract
- Escrow.sol contract
- RPSGame.sol contract
- Unit tests for all contracts
- Deployment scripts
- Manual integration testing

### Out of Scope
- Agent code (Phase 2)
- Prediction market contract (Phase 6)
- Frontend/dashboard
- Advanced game mechanics

---

## Tasks

### 1.1: Initialize Foundry Project

**Description:** Create Foundry project structure with proper configuration for Monad testnet.

**Owner:** _____

**Acceptance Criteria:**
- [ ] `forge init` creates project structure
- [ ] `foundry.toml` configured with Monad RPC
- [ ] `.env.example` shows required env vars
- [ ] `forge build` succeeds

**Verification:**
```bash
cd contracts && forge build
```

---

### 1.2: Set Up Monad Testnet Wallet

**Description:** Create or configure wallet for testnet deployment. Fund with MON.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Wallet address documented (not private key!)
- [ ] Wallet has sufficient MON (>1 MON)
- [ ] Private key stored securely in `.env`
- [ ] `.env` is in `.gitignore`

**Verification:**
```bash
cast balance $WALLET_ADDRESS --rpc-url $MONAD_RPC
```

---

### 1.3: Write AgentRegistry.sol

**Description:** Smart contract for registering fighter agents with their metadata.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Agents can register with name, owner address
- [ ] Registration requires small fee (prevents spam)
- [ ] Agents can update their metadata
- [ ] Owner can deactivate agent
- [ ] Events emitted for registration/updates
- [ ] View functions for querying agents

**Interface:**
```solidity
interface IAgentRegistry {
    function register(string calldata name) external payable returns (uint256 agentId);
    function updateAgent(uint256 agentId, string calldata name) external;
    function deactivate(uint256 agentId) external;
    function getAgent(uint256 agentId) external view returns (Agent memory);
    function isActive(uint256 agentId) external view returns (bool);
}
```

**Verification:**
```bash
forge test --match-contract AgentRegistryTest -vvv
```

---

### 1.4: Write Escrow.sol

**Description:** Smart contract for holding wagers during matches.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Accept deposits from two parties
- [ ] Lock funds until match resolves
- [ ] Release to winner on resolution
- [ ] Handle draws (return funds)
- [ ] Timeout mechanism if match stalls
- [ ] Only authorized game contracts can resolve

**Interface:**
```solidity
interface IEscrow {
    function createEscrow(uint256 matchId, address player1, address player2) external;
    function deposit(uint256 matchId) external payable;
    function resolve(uint256 matchId, address winner) external;
    function refund(uint256 matchId) external;
    function claimTimeout(uint256 matchId) external;
}
```

**Verification:**
```bash
forge test --match-contract EscrowTest -vvv
```

---

### 1.5: Write RPSGame.sol

**Description:** Core Rock-Paper-Scissors game logic with commit-reveal scheme.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Create match with wager amount
- [ ] Accept challenge (match wager)
- [ ] Commit phase: both players submit hash(move + salt)
- [ ] Reveal phase: both players reveal move + salt
- [ ] Determine winner based on RPS rules
- [ ] Handle timeouts at each phase
- [ ] Integrate with Escrow for payouts
- [ ] Events for all state changes

**Interface:**
```solidity
interface IRPSGame {
    function createMatch(uint256 wager) external payable returns (uint256 matchId);
    function acceptMatch(uint256 matchId) external payable;
    function commitMove(uint256 matchId, bytes32 commitment) external;
    function revealMove(uint256 matchId, uint8 move, bytes32 salt) external;
    function claimTimeout(uint256 matchId) external;
    function getMatch(uint256 matchId) external view returns (Match memory);
}
```

**Verification:**
```bash
forge test --match-contract RPSGameTest -vvv
```

---

### 1.6: Write Comprehensive Foundry Tests

**Description:** Full test coverage for all contracts including edge cases.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Unit tests for each function
- [ ] Integration tests for full match flow
- [ ] Edge case tests (timeouts, invalid moves, etc.)
- [ ] Fuzz tests for numeric inputs
- [ ] All tests pass
- [ ] Coverage report generated

**Test Cases Required:**
- Registration happy path
- Registration with insufficient fee
- Full match: create → accept → commit → reveal → payout
- Timeout at commit phase
- Timeout at reveal phase
- Draw handling
- Invalid move rejection
- Double-reveal prevention

**Verification:**
```bash
forge test -vvv
forge coverage
```

---

### 1.7: Deploy Contracts to Monad Testnet

**Description:** Deploy all 3 contracts to Monad testnet with proper configuration.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Deployment script in `script/Deploy.s.sol`
- [ ] All 3 contracts deployed successfully
- [ ] Contract addresses documented
- [ ] Contracts verified on block explorer (if available)
- [ ] Deployment transaction hashes recorded

**Verification:**
```bash
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC --broadcast
```

**Output to Record:**
- AgentRegistry: `0x...`
- Escrow: `0x...`
- RPSGame: `0x...`

---

### 1.8: Manual Integration Test via Cast

**Description:** Manually test the full flow using cast commands to verify deployment.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Register test agent via cast
- [ ] Create match via cast
- [ ] Complete commit-reveal via cast
- [ ] Verify winner receives funds
- [ ] Document all commands used

**Verification Steps:**
```bash
# Register agent
cast send $REGISTRY "register(string)" "TestAgent" --value 0.01ether --rpc-url $MONAD_RPC

# Create match
cast send $RPSGAME "createMatch(uint256)" 100000000000000000 --value 0.1ether --rpc-url $MONAD_RPC

# etc...
```

---

## Deliverables

1. **Foundry project** in `/contracts` folder
2. **Three deployed contracts** on Monad testnet
3. **Contract addresses** documented in `/contracts/DEPLOYED.md`
4. **Test suite** with >90% coverage
5. **Deployment script** that can redeploy if needed

---

## Test/Acceptance Criteria

This phase is complete when:

1. `forge test` passes all tests
2. All 3 contracts are deployed to Monad testnet
3. Manual cast test completes a full match
4. Contract addresses are documented
5. Another developer can clone and deploy using docs

---

## Gate Checklist

Before moving to Phase 2, verify:

- [ ] `forge build` succeeds without warnings
- [ ] `forge test` passes all tests
- [ ] AgentRegistry deployed and verified
- [ ] Escrow deployed and verified
- [ ] RPSGame deployed and verified
- [ ] Manual integration test completed
- [ ] Contract addresses documented
- [ ] Deployment instructions documented

---

## Notes

- Keep contracts simple; optimize later if needed
- Use OpenZeppelin libraries where appropriate
- Commit after each task completion
- Document any deviations from plan
