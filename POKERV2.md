# Budget Poker (PokerGameV2)

## What Changed

Replaced the single-round poker game (where "always pick 100" was optimal) with a **3-round budget poker** system that forces strategic resource allocation.

## Game Design

- **Best of 3 rounds** — first to 2 wins
- **150-point hand budget** shared across all rounds
- Each round: pick a hand value 1–100, bet, reveal, compare
- Budget deducted **on reveal only** — folding preserves your budget
- Must reserve at least 1 point per future round
- Extra bets (real MON) accumulate across rounds — winner takes all

### Why This Is Strategic

| Old Poker | Budget Poker |
|-----------|-------------|
| Always pick 100 | Budget runs out after 1-2 rounds |
| No resource management | Allocate 150 points across 3 rounds |
| Single round, no depth | Fold to save budget for later rounds |
| Bluffing only tool | Budget tracking + betting + bluffing |

### Per-Round Flow

```
Commit hand → Betting Round 1 → Betting Round 2 → Showdown → (next round or settle)
```

### Rules

| Rule | Detail |
|------|--------|
| Hand range | 1–100 per round |
| Starting budget | 150 points |
| Budget constraint | handValue ≤ remainingBudget - futureRoundsCount |
| Fold | Opponent wins round, no reveal, budget preserved |
| Extra bets | Real MON, accumulate across rounds, winner gets all |
| Draw rounds | Equal hands = no score change |
| Match winner | First to 2 round wins. If tied after 3: higher score wins. Tie = draw. |
| Max bet/raise | 2x escrow wager per round |
| Max raises/round | 2 |

## Files Created

| File | Description |
|------|-------------|
| `contracts/src/PokerGameV2.sol` | Budget Poker smart contract (~420 lines) |
| `contracts/test/PokerGameV2.t.sol` | 30 Foundry tests — all passing |
| `contracts/script/DeployPokerV2.s.sol` | Monad testnet deployment script |

## Files Modified

| File | Change |
|------|--------|
| `packages/arena-tools/src/config.ts` | Added `PokerGameV2` address, poker→V2 in GAME_CONTRACTS |
| `packages/arena-tools/src/contracts.ts` | Added `pokerGameV2Abi` with round/budget fields |
| `packages/arena-tools/src/commands/poker.ts` | All commands point to V2 contract |
| `packages/arena-tools/src/commands/poker-step.ts` | Multi-round + budget awareness, round-scoped salts |
| `packages/arena-tools/src/commands/respond.ts` | Budget-aware hand allocation, per-round salt keys |
| `packages/arena-tools/src/commands/get-game.ts` | Displays rounds, scores, budgets |
| `packages/arena-tools/src/commands/claim-timeout.ts` | Points to V2 |
| `packages/arena-tools/src/commands/find-game.ts` | Points to V2 |

## Contract Architecture

PokerGameV2 combines:
- **RPSGame.sol** round management — `rounds` mapping, score tracking, `_resolveRound`, `_advanceToNextRound`
- **PokerGame.sol** betting logic — `takeAction` (check/bet/raise/call/fold), `_advanceBettingPhase`

### Key State

```solidity
struct Game {
    uint256 totalRounds;     // 3
    uint256 currentRound;    // 0-indexed
    uint256 p1Score;
    uint256 p2Score;
    uint256 startingBudget;  // 150
    uint256 p1Budget;
    uint256 p2Budget;
    uint256 p1ExtraBets;     // MON accumulated across rounds
    uint256 p2ExtraBets;
    GamePhase phase;
    // ...
}

struct RoundData {
    bytes32 p1Commit;
    bytes32 p2Commit;
    uint8 p1HandValue;
    uint8 p2HandValue;
    uint256 currentBet;
    // ...
}
```

### Budget Enforcement

On `revealHand`:
```solidity
uint256 roundsAfter = totalRounds - currentRound - 1;
require(handValue <= playerBudget - roundsAfter, "PokerV2: exceeds budget");
playerBudget -= handValue;
```

## Test Coverage (30 tests)

- Game creation with correct budget initialization
- Budget deducted on reveal
- Budget constraint rejects over-spend
- Last round can use remaining budget
- Full 3-round games: 2-0, 2-1, all-draw
- Fold preserves budget, gives round to opponent
- Two folds = match loss
- Extra bets accumulate and pay out correctly
- Draw rounds (no score change)
- Commit/betting/showdown phase mechanics
- Hash mismatch and invalid hand rejection
- Timeout in commit, betting, and showdown phases
- ELO updates after match
- Match history records
- ERC-8004 reputation feedback

## Agent Strategy (respond command)

The autonomous agent uses a simple budget allocation:
```
avgPerRound = remainingBudget / roundsLeft
handValue = avgPerRound + random jitter (±20%)
clamped to [1, maxAllowed]
```

Betting strategy: check or call (conservative — no bluffs).

## Deployment

```bash
cd contracts
forge script script/DeployPokerV2.s.sol:DeployPokerV2 --rpc-url monad_testnet --broadcast
```

After deployment, update the `PokerGameV2` address in `packages/arena-tools/src/config.ts`.

The old PokerGame (V1) contract address is preserved in config as `PokerGame` for any legacy game lookups.
