# Phase 3: Opponents

**Phase:** 3 of 6
**Name:** Opponents
**Status:** Not Started

---

## Objectives

1. Create 5 distinct opponent agents with different strategies
2. Deploy each opponent on a separate wallet
3. Register all opponents on AgentRegistry
4. Verify all opponents can play matches correctly
5. Provide training targets for the main fighter agent

---

## Prerequisites

- [ ] Phase 2 complete (basic agent works)
- [ ] 5 additional wallets funded with testnet MON
- [ ] OpenClaw skill template ready
- [ ] Contract addresses documented

---

## Scope

### In Scope
- 5 opponent agents with distinct strategies
- Separate wallet for each opponent
- Registration on AgentRegistry
- Basic match-playing capability
- Strategy implementation per opponent

### Out of Scope
- Complex adaptive strategies (opponents are predictable)
- Opponent coordination
- Tournament system
- Bankroll management for opponents

---

## Opponent Overview

| Name | Strategy | Predictability | Purpose |
|------|----------|----------------|---------|
| The Rock | Favors one move heavily | High | Easy to exploit |
| The Gambler | Random, variable bets | Medium | Noise baseline |
| The Mirror | Tit-for-tat | Medium | Pattern target |
| The Random | Pure random | Low | Baseline control |
| The Counter | Frequency counter | Medium | Test adaptation |

---

## Tasks

### 3.1: Create Opponent Skill Template

**Description:** Create base template for opponent agents to reduce code duplication.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Base opponent class/module created
- [ ] Common functionality abstracted (connect, register, play)
- [ ] Strategy pattern for move selection
- [ ] Easy to instantiate with different strategies
- [ ] Shared configuration management

**Code Location:** `agent/src/opponents/base.ts`

**Template Structure:**
```typescript
abstract class OpponentBase {
  abstract selectMove(history: MoveHistory): Move;
  async playMatch(matchId: bigint): Promise<void>;
  async register(): Promise<void>;
}
```

**Verification:**
```bash
# Template should compile without errors
npm run build
```

---

### 3.2: Implement "The Rock" (Conservative)

**Description:** Opponent that heavily favors one move (e.g., Rock 70% of the time).

**Owner:** _____

**Strategy:**
- Plays Rock 70% of the time
- Plays Paper 20% of the time
- Plays Scissors 10% of the time
- Easy to exploit with Paper

**Acceptance Criteria:**
- [ ] Move distribution matches specification
- [ ] Registers with name "The Rock"
- [ ] Plays matches correctly
- [ ] Consistent behavior over multiple matches

**Code Location:** `agent/src/opponents/the-rock.ts`

**Verification:**
```bash
npm run opponent:rock -- --matches 10
# Check move distribution in logs
```

---

### 3.3: Implement "The Gambler" (Random, Big Bets)

**Description:** Opponent that plays randomly but with variable wager sizes.

**Owner:** _____

**Strategy:**
- Pure random move selection (33/33/33)
- Wagers vary: sometimes small, sometimes large
- Provides bankroll variance testing

**Acceptance Criteria:**
- [ ] Move selection is truly random
- [ ] Wager sizes vary between matches
- [ ] Registers with name "The Gambler"
- [ ] Plays matches correctly

**Code Location:** `agent/src/opponents/the-gambler.ts`

**Verification:**
```bash
npm run opponent:gambler -- --matches 10
# Verify random distribution and wager variance
```

---

### 3.4: Implement "The Mirror" (Tit-for-Tat)

**Description:** Opponent that copies the fighter's previous move.

**Owner:** _____

**Strategy:**
- First move: Random
- Subsequent moves: Play what opponent played last round
- Classic tit-for-tat pattern

**Acceptance Criteria:**
- [ ] Tracks opponent's last move
- [ ] Mirrors correctly after first round
- [ ] Registers with name "The Mirror"
- [ ] Handles first match correctly (no history)

**Code Location:** `agent/src/opponents/the-mirror.ts`

**Verification:**
```bash
npm run opponent:mirror -- --matches 5
# Manually verify mirroring behavior
```

---

### 3.5: Implement "The Random" (Pure Random)

**Description:** Baseline opponent with pure random move selection.

**Owner:** _____

**Strategy:**
- Exactly 33.33% chance for each move
- No pattern, no adaptation
- Control group for testing

**Acceptance Criteria:**
- [ ] Uses cryptographically secure random
- [ ] Equal distribution over many games
- [ ] Registers with name "The Random"
- [ ] Stateless between matches

**Code Location:** `agent/src/opponents/the-random.ts`

**Verification:**
```bash
npm run opponent:random -- --matches 100
# Chi-square test should show uniform distribution
```

---

### 3.6: Implement "The Counter" (Frequency Counter)

**Description:** Opponent that tracks fighter's move frequency and counters the most common.

**Owner:** _____

**Strategy:**
- Track opponent's move history
- Count frequency of each move
- Play the counter to most frequent move
- Adapts over time

**Acceptance Criteria:**
- [ ] Tracks move history correctly
- [ ] Counters most frequent move
- [ ] Registers with name "The Counter"
- [ ] Adaptation visible over matches

**Code Location:** `agent/src/opponents/the-counter.ts`

**Verification:**
```bash
npm run opponent:counter -- --matches 10
# Test against predictable pattern, verify countering
```

---

### 3.7: Deploy All 5 on Separate Wallets

**Description:** Configure each opponent with its own wallet and deploy.

**Owner:** _____

**Acceptance Criteria:**
- [ ] 5 wallets created and funded
- [ ] Each opponent configured with correct wallet
- [ ] Private keys stored securely
- [ ] Wallet mapping documented
- [ ] Each wallet has sufficient MON

**Wallet Configuration:**
```
Opponent         Wallet
--------         ------
The Rock         0x...
The Gambler      0x...
The Mirror       0x...
The Random       0x...
The Counter      0x...
```

**Verification:**
```bash
# Check all wallets funded
for wallet in $ROCK $GAMBLER $MIRROR $RANDOM $COUNTER; do
  cast balance $wallet --rpc-url $MONAD_RPC
done
```

---

### 3.8: Register All on Agent Registry

**Description:** Register each opponent on the AgentRegistry contract.

**Owner:** _____

**Acceptance Criteria:**
- [ ] All 5 opponents registered
- [ ] Agent IDs documented
- [ ] Names match strategy names
- [ ] Registration confirmed on-chain

**Agent ID Mapping:**
```
Opponent         Agent ID
--------         --------
The Rock         ?
The Gambler      ?
The Mirror       ?
The Random       ?
The Counter      ?
```

**Verification:**
```bash
# Query each agent
for id in 1 2 3 4 5; do
  cast call $REGISTRY "getAgent(uint256)" $id
done
```

---

### 3.9: Test Each Opponent Plays Correctly

**Description:** Verify each opponent can complete matches independently.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Each opponent completes at least 2 matches
- [ ] Strategy behavior matches specification
- [ ] No crashes or hangs
- [ ] Payouts work correctly
- [ ] Logs show expected behavior

**Test Matrix:**
| Opponent | Match 1 | Match 2 | Strategy Verified |
|----------|---------|---------|-------------------|
| Rock | | | |
| Gambler | | | |
| Mirror | | | |
| Random | | | |
| Counter | | | |

**Verification:**
```bash
# Run test matches for each opponent
npm run test:opponents
```

---

## Deliverables

1. **5 opponent agents** in `/agent/src/opponents`
2. **Opponent base template** for shared functionality
3. **5 funded wallets** with documented addresses
4. **Agent ID mapping** for all opponents
5. **Test results** showing all opponents working

---

## Test/Acceptance Criteria

This phase is complete when:

1. All 5 opponents are implemented
2. All 5 opponents are registered on-chain
3. Each opponent successfully completes matches
4. Strategy behavior matches documentation
5. Fighter agent can play against all opponents

---

## Gate Checklist

Before relying on opponents for Phase 4 testing:

- [ ] The Rock implemented and registered
- [ ] The Gambler implemented and registered
- [ ] The Mirror implemented and registered
- [ ] The Random implemented and registered
- [ ] The Counter implemented and registered
- [ ] All opponents tested (2+ matches each)
- [ ] Wallet addresses documented
- [ ] Agent IDs documented
- [ ] Strategies verified

---

## Notes

- Opponents don't need sophisticated bankroll management
- Keep opponent code simple and predictable
- Opponents are training targets, not competitors
- Can run opponents manually or as background processes
- Document any strategy modifications
