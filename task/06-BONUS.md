# Phase 6: Bonus

**Phase:** 6 of 6
**Name:** Bonus
**Status:** Not Started
**Priority:** Stretch Goals

---

## Objectives

1. (Stretch) Implement prediction market for matches
2. (Stretch) Build spectator skill for betting
3. (Stretch) Add additional game types
4. (Stretch) Create tournament system

---

## Prerequisites

- [ ] Phase 5 complete (core submission ready)
- [ ] Extra time available
- [ ] Core system stable

---

## Scope

### In Scope
- Prediction market AMM contract
- Spectator betting skill
- Additional game types
- Tournament mechanics

### Out of Scope (Even for Bonus)
- Complex DeFi integrations
- Cross-chain functionality
- Production-grade security audits

---

## Why Bonus Features?

These features add significant value but are not required for a working submission:

1. **Prediction Market** — Adds DeFi angle, lets others bet on matches
2. **Spectator Skill** — Community engagement, passive income source
3. **More Games** — Shows extensibility of the system
4. **Tournaments** — Adds competitive structure

---

## Tasks

### 6.1: Write PredictionMarket.sol AMM

**Description:** Create automated market maker for betting on match outcomes.

**Owner:** _____

**Priority:** Medium (impactful if completed)

**Acceptance Criteria:**
- [ ] Create market for any match
- [ ] Allow bets on either player
- [ ] Use constant product AMM (x * y = k)
- [ ] Dynamic odds based on bet distribution
- [ ] Resolve market when match ends
- [ ] Distribute winnings to correct bettors

**Contract Interface:**
```solidity
interface IPredictionMarket {
    function createMarket(uint256 matchId) external;
    function bet(uint256 matchId, address player) external payable;
    function resolveMarket(uint256 matchId) external;
    function claimWinnings(uint256 matchId) external;
    function getOdds(uint256 matchId) external view returns (uint256, uint256);
}
```

**AMM Logic:**
```
Initial: 50% Player A, 50% Player B
Bet on A: Increases A odds, decreases B odds
Formula: odds_a = reserve_b / (reserve_a + reserve_b)
```

**Code Location:** `contracts/src/PredictionMarket.sol`

**Verification:**
```bash
forge test --match-contract PredictionMarketTest -vvv
```

---

### 6.2: Deploy Prediction Market Contract

**Description:** Deploy prediction market to Monad testnet.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Contract deployed to Monad testnet
- [ ] Address documented
- [ ] Integration with RPSGame verified
- [ ] Can create markets for matches
- [ ] Basic betting works

**Verification:**
```bash
cast send $PREDICTION "createMarket(uint256)" 1 --rpc-url $MONAD_RPC
```

---

### 6.3: Build Spectator Skill

**Description:** OpenClaw skill for spectators to bet on matches.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Find active matches
- [ ] Analyze fighters (history, win rate)
- [ ] Predict likely winner
- [ ] Place bet on prediction market
- [ ] Collect winnings after match
- [ ] Track spectator P&L

**Spectator Logic:**
```typescript
async function spectate() {
  const matches = await getActiveMatches();
  for (const match of matches) {
    const analysis = await analyzeFighters(match);
    if (analysis.confidence > 0.6) {
      await placeBet(match.id, analysis.predictedWinner, betAmount);
    }
  }
}
```

**Code Location:** `agent/src/spectator/`

**Verification:**
```bash
npm run spectator:run
# Should find matches and place bets
```

---

### 6.4: Test Spectator Betting on Matches

**Description:** End-to-end test of spectator betting flow.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Spectator finds match
- [ ] Spectator places bet
- [ ] Match resolves
- [ ] Spectator claims winnings (if won)
- [ ] P&L tracked correctly

**Test Scenario:**
1. Start fighter match
2. Spectator detects and analyzes
3. Spectator bets on predicted winner
4. Match completes
5. Spectator claims winnings

**Verification:**
```bash
npm run test:spectator-flow
```

---

### 6.5: (Optional) Second Game Type

**Description:** Add another simple game beyond RPS.

**Owner:** _____

**Priority:** Low

**Ideas:**
- **Coin Flip** — 50/50, pure chance
- **High-Low** — Guess if number is higher or lower
- **Odd-Even** — Guess if hash is odd or even

**Acceptance Criteria:**
- [ ] New game contract deployed
- [ ] Fighter can play new game
- [ ] Strategy adapts to game type
- [ ] Works with prediction market

**Verification:**
```bash
npm run agent:fight -- --game coinflip
```

---

### 6.6: (Optional) Tournament System

**Description:** Create structured tournament brackets.

**Owner:** _____

**Priority:** Low

**Acceptance Criteria:**
- [ ] Create tournament with N players
- [ ] Single or double elimination
- [ ] Automatic bracket progression
- [ ] Prize pool distribution
- [ ] Tournament results recorded

**Contract Interface:**
```solidity
interface ITournament {
    function createTournament(uint256 entryFee, uint256 maxPlayers) external;
    function enter(uint256 tournamentId) external payable;
    function startTournament(uint256 tournamentId) external;
    function recordResult(uint256 tournamentId, uint256 matchId) external;
    function claimPrize(uint256 tournamentId) external;
}
```

**Verification:**
```bash
npm run tournament:create -- --players 8 --entry 0.1
npm run tournament:start
```

---

## Deliverables

1. **(Stretch) PredictionMarket.sol** deployed
2. **(Stretch) Spectator skill** working
3. **(Stretch) Second game type** implemented
4. **(Stretch) Tournament system** deployed

---

## Test/Acceptance Criteria

This phase is complete when (any of):

1. Prediction market allows betting on matches
2. Spectator skill successfully bets and profits
3. Additional game type works with fighter
4. Tournament completes full bracket

---

## Gate Checklist

These are stretch goals; completion is not required:

- [ ] PredictionMarket contract deployed
- [ ] Spectator skill operational
- [ ] At least one bonus feature working
- [ ] Demo video updated (if time)
- [ ] README updated with bonus features

---

## Bonus Feature Value

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Prediction Market | High | High | 1 |
| Spectator Skill | Medium | High | 2 |
| Tournament | High | Medium | 3 |
| Second Game | Medium | Low | 4 |

---

## Notes

- Only attempt if core submission is solid
- Better to have polished core than rushed bonuses
- Prediction market is highest value-add
- Document anything partially completed
- Judges appreciate ambition, even incomplete
