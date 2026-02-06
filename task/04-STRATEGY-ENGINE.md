# Phase 4: Strategy Engine

**Phase:** 4 of 6
**Name:** Strategy Engine
**Status:** Not Started

---

## Objectives

1. Implement opponent modeling and move history tracking
2. Build pattern recognition (frequency analysis, Markov chains)
3. Create adaptive strategy selection system
4. Implement Kelly criterion bankroll management
5. Add smart match selection logic
6. Achieve positive win rate against opponent gauntlet

---

## Prerequisites

- [ ] Phase 2 complete (basic agent works)
- [ ] Phase 3 in progress (opponents available for testing)
- [ ] Match history storage implemented
- [ ] Basic agent can play matches

---

## Scope

### In Scope
- Move history tracking and persistence
- Frequency analysis of opponent moves
- Markov chain prediction model
- Strategy selection logic
- Kelly criterion wager sizing
- Match selection heuristics
- Performance logging and tuning

### Out of Scope
- Machine learning models
- Deep neural networks
- Multi-game lookahead
- Social/meta-game analysis

---

## Strategy Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Strategy Engine                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   History    │───►│   Pattern    │───►│   Strategy   │   │
│  │   Tracker    │    │   Analyzer   │    │   Selector   │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                    │           │
│         ▼                   ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Decision Engine                    │   │
│  │  • Select move based on prediction                    │   │
│  │  • Size wager based on confidence + bankroll          │   │
│  │  • Choose matches based on expected value             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tasks

### 4.1: Implement Move History Tracking

**Description:** Build system to track and persist move history per opponent.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Track own moves and opponent moves per match
- [ ] Persist history between sessions
- [ ] Index by opponent address/ID
- [ ] Query history for specific opponent
- [ ] Handle first encounter (no history)

**Data Structure:**
```typescript
interface MoveRecord {
  matchId: bigint;
  round: number;
  ourMove: Move;
  theirMove: Move;
  timestamp: number;
  result: 'win' | 'loss' | 'draw';
}

interface OpponentHistory {
  opponentId: string;
  matches: MoveRecord[];
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
}
```

**Code Location:** `agent/src/strategy/history.ts`

**Verification:**
```bash
# Play match, check history persisted
npm run agent:fight
npm run history:show -- --opponent 0x...
```

---

### 4.2: Implement Frequency Analysis

**Description:** Analyze opponent move frequency to detect biases.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Count occurrences of each move
- [ ] Calculate percentages
- [ ] Detect significant biases (>40% for one move)
- [ ] Decay older data (recent moves weighted more)
- [ ] Confidence score based on sample size

**Algorithm:**
```typescript
function analyzeFrequency(history: MoveRecord[]): FrequencyAnalysis {
  // Count moves with exponential decay
  // Recent moves weighted 2x vs old moves
  // Return distribution + confidence
}
```

**Code Location:** `agent/src/strategy/frequency.ts`

**Verification:**
```bash
# Test against The Rock (should detect Rock bias)
npm run analyze:frequency -- --opponent rock
# Expected: Rock ~70%, Paper ~20%, Scissors ~10%
```

---

### 4.3: Implement Markov Chain Prediction

**Description:** Build Markov chain model to predict opponent's next move based on sequences.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Build transition matrix from history
- [ ] Track first-order transitions (last move → next move)
- [ ] Track second-order transitions (last 2 moves → next)
- [ ] Predict most likely next move
- [ ] Confidence based on observation count

**Model:**
```
Transition Matrix Example (First Order):
           → Rock  → Paper  → Scissors
Rock      [  0.3     0.4       0.3    ]
Paper     [  0.5     0.2       0.3    ]
Scissors  [  0.2     0.3       0.5    ]
```

**Code Location:** `agent/src/strategy/markov.ts`

**Verification:**
```bash
# Test against The Mirror (should detect pattern)
npm run analyze:markov -- --opponent mirror
# Should show "after X, likely plays X"
```

---

### 4.4: Implement Strategy Selection

**Description:** Choose between exploitation and randomization based on confidence.

**Owner:** _____

**Acceptance Criteria:**
- [ ] High confidence → exploit predicted move
- [ ] Low confidence → play randomly (Nash equilibrium)
- [ ] Blend strategies based on confidence level
- [ ] Avoid becoming predictable ourselves
- [ ] Log strategy choice for analysis

**Strategy Logic:**
```typescript
function selectMove(analysis: Analysis): Move {
  if (analysis.confidence > 0.7) {
    // High confidence: counter predicted move
    return counter(analysis.predictedMove);
  } else if (analysis.confidence > 0.4) {
    // Medium: weighted random favoring counter
    return weightedRandom(analysis);
  } else {
    // Low confidence: pure random
    return randomMove();
  }
}
```

**Code Location:** `agent/src/strategy/selector.ts`

**Verification:**
```bash
# Run gauntlet, check win rate improves
npm run gauntlet:run
# Compare to random baseline
```

---

### 4.5: Implement Kelly Criterion Wager Sizing

**Description:** Size wagers optimally based on edge and bankroll.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Calculate win probability from analysis
- [ ] Apply Kelly formula: `f* = (bp - q) / b`
- [ ] Cap maximum bet (fractional Kelly for safety)
- [ ] Minimum bet for information gathering
- [ ] Adjust for bankroll size

**Kelly Formula:**
```
f* = (bp - q) / b

Where:
- f* = fraction of bankroll to wager
- b = odds received (1:1 for RPS = 1)
- p = probability of winning
- q = probability of losing (1-p)
```

**Code Location:** `agent/src/strategy/kelly.ts`

**Implementation:**
```typescript
function calculateWager(
  winProbability: number,
  bankroll: bigint,
  minBet: bigint,
  maxBetFraction: number = 0.1
): bigint {
  // Kelly with caps
  const edge = winProbability - 0.5;
  const kellyFraction = edge > 0 ? edge * 2 : 0;
  const safeFraction = Math.min(kellyFraction * 0.5, maxBetFraction);
  // ...
}
```

**Verification:**
```bash
# Simulate betting strategy
npm run simulate:kelly -- --edge 0.1 --bankroll 10
# Should show ~5% bets for 10% edge
```

---

### 4.6: Implement Match Selection Logic

**Description:** Choose which matches to accept based on expected value.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Evaluate opponent before accepting
- [ ] Check historical win rate vs opponent
- [ ] Consider wager size vs bankroll
- [ ] Skip unfavorable matchups
- [ ] Prefer known exploitable opponents

**Selection Criteria:**
```typescript
function shouldAcceptMatch(match: Match): boolean {
  const opponent = match.creator;
  const history = getHistory(opponent);

  // Unknown opponent: accept if wager is small (gather info)
  // Known losing matchup: decline
  // Known winning matchup: accept based on Kelly
  // ...
}
```

**Code Location:** `agent/src/strategy/matchSelection.ts`

**Verification:**
```bash
# Agent should skip bad matchups
npm run agent:auto
# Check logs for match acceptance reasoning
```

---

### 4.7: Run 5+ Match Gauntlet

**Description:** Test fighter against all 5 opponents in sequence.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Play at least 1 match vs each opponent
- [ ] Track win/loss/draw per opponent
- [ ] Calculate overall win rate
- [ ] Log strategy decisions
- [ ] Document results

**Gauntlet Protocol:**
1. Start with equal bankroll
2. Play each opponent at least once
3. Randomize opponent order
4. Record all decisions and outcomes

**Code Location:** `agent/src/test/gauntlet.ts`

**Verification:**
```bash
npm run gauntlet:run
# Output: Win rate, bankroll change, per-opponent stats
```

---

### 4.8: Tune Parameters for Positive Win Rate

**Description:** Adjust strategy parameters to maximize performance.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Win rate >50% overall
- [ ] Positive bankroll growth
- [ ] Beat exploitable opponents (Rock) consistently
- [ ] Hold even vs random opponents
- [ ] Document optimal parameters

**Parameters to Tune:**
| Parameter | Default | Range | Purpose |
|-----------|---------|-------|---------|
| Confidence threshold | 0.6 | 0.4-0.8 | When to exploit |
| History decay | 0.9 | 0.8-0.99 | Weight of old data |
| Kelly fraction | 0.5 | 0.25-0.75 | Bet sizing conservatism |
| Min sample size | 5 | 3-10 | Before using analysis |

**Verification:**
```bash
npm run tune:parameters
# Grid search for optimal settings
```

---

### 4.9: Document Strategy Decisions in Logs

**Description:** Ensure all strategy decisions are clearly logged for demo/debugging.

**Owner:** _____

**Acceptance Criteria:**
- [ ] Log opponent identification
- [ ] Log historical analysis
- [ ] Log prediction and confidence
- [ ] Log move selection reasoning
- [ ] Log wager sizing calculation
- [ ] Logs are human-readable

**Log Format Example:**
```
[MATCH 42] vs 0x1234 (The Rock)
  History: 8 matches, 6-2-0 (W-L-D)
  Analysis: Rock 68%, Paper 20%, Scissors 12%
  Confidence: 0.82 (high)
  Prediction: They play Rock
  Strategy: EXPLOIT → Play Paper
  Wager: 0.15 ETH (Kelly 8% of 1.8 ETH bankroll)
```

**Code Location:** `agent/src/utils/logger.ts`

**Verification:**
```bash
npm run agent:fight -- --verbose
# Check log clarity and completeness
```

---

## Deliverables

1. **History tracking system** with persistence
2. **Frequency analyzer** for bias detection
3. **Markov predictor** for pattern recognition
4. **Strategy selector** with confidence-based logic
5. **Kelly criterion** wager sizing
6. **Match selector** for positive EV matches
7. **Gauntlet test suite** for validation
8. **Tuned parameters** documented

---

## Test/Acceptance Criteria

This phase is complete when:

1. Strategy engine integrates with basic agent
2. History persists between sessions
3. Exploitable opponents (Rock) beaten >60%
4. Random opponents held to ~50%
5. Overall gauntlet win rate >50%
6. Bankroll shows positive growth
7. All decisions logged clearly

---

## Gate Checklist

Before moving to Phase 5, verify:

- [ ] Move history tracking works
- [ ] Frequency analysis detects biases
- [ ] Markov prediction functional
- [ ] Strategy selection logic works
- [ ] Kelly criterion sizing implemented
- [ ] Match selection active
- [ ] Gauntlet passes (5 matches)
- [ ] Win rate >50%
- [ ] Positive bankroll growth
- [ ] Logs show clear decision reasoning

---

## Notes

- Start with simple strategies, add complexity if needed
- Don't over-engineer; RPS has limited depth
- Exploit predictable opponents heavily
- Play conservatively vs unknown/random
- Log everything for demo purposes
