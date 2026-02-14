# RPS Strategy Reference

This document describes the strategy engine used by the Fighter agent to gain an edge in Rock-Paper-Scissors matches on the Monad Gaming Arena.

## Strategy Overview

The engine combines four signals to predict the opponent's next move and counter it:

1. **Frequency Analysis** — exploit biased move distributions
2. **Markov Chain** — exploit transition patterns (move A → move B)
3. **Sequence Detection** — exploit repeating cycles and win-stay/lose-shift
4. **Anti-Exploitation** — fallback to random when being countered

## How Each Strategy Works

### Frequency Analysis
- Count how often the opponent plays Rock, Paper, and Scissors
- If one move appears >40% of the time, counter it
- Example: opponent plays 70% Rock → we play Paper
- Confidence = percentage of the most frequent move
- Works best against: **Rock Bot** (70% rock bias)

### Markov Chain (1st Order)
- Build a transition matrix: P(next move | last move)
- Predict the most likely next move based on what they just played
- Counter the prediction
- Needs 5+ rounds of data to be reliable
- Confidence = probability of the predicted transition
- Works best against: **Mirror Bot** (tit-for-tat has deterministic transitions)

### Sequence Detection
- Look for repeating cycles (e.g., R→P→S→R→P→S)
- Detect win-stay/lose-shift behavior patterns
- If cycle found, predict next move in the sequence
- Works best against: bots with fixed move rotation

### Anti-Exploitation
- Track win rate over last 5 rounds
- If win rate drops below 35%, switch to pure random for safety
- Prevents **Counter Bot** from exploiting our predictability
- After random cooldown, re-engage strategic play

## Strategy Selection

The combined selector:
1. Checks anti-exploitation first (emergency override)
2. Runs all three predictive strategies
3. Picks the highest-confidence prediction
4. Requires minimum 40% confidence to act on a signal
5. Falls back to random if no strategy has enough confidence

## Opponent Model Persistence

- Historical data is saved per-opponent to `skills/fighter/data/{address}.json`
- Cumulative move frequencies, transitions, and match results persist across games
- More data = better predictions, especially Markov and frequency analysis
- Model is loaded before each game and updated after

## Bankroll Management (Kelly Criterion)

- **Kelly fraction** for even-money bets: f* = 2p - 1 (where p = win probability)
- We use **half-Kelly** for safety (half the theoretical optimal bet)
- Maximum bet capped at **5% of bankroll**
- Minimum bet floor when balance is very low
- Win probability estimated from historical match data with Bayesian regression

## Expected Win Rates by Opponent

| Opponent | Strategy Used | Expected Win Rate |
|----------|--------------|-------------------|
| Rock Bot | Frequency | >60% |
| Mirror Bot | Markov/Sequence | >55% |
| Counter Bot | Anti-Exploit + Mix | ~50% |
| Random Bot | None (pure random) | ~33% |
| Gambler Bot | None (pure random) | ~33% |

## Commands

- `arena.py select-match` — ranks opponents by expected value
- `arena.py recommend <addr>` — shows Kelly-sized wager recommendation
- `arena.py challenge <addr> <wager> [rounds]` — plays with strategy engine
