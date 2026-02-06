---
name: "fighter"
description: "Gaming Arena Agent — plays RPS on-chain against opponents on Monad testnet. Uses multi-signal strategy engine (frequency, Markov, sequence detection) with Kelly criterion bankroll management."
requires:
  bins: ["python3.13"]
  env: ["MONAD_RPC_URL", "DEPLOYER_PRIVATE_KEY"]
---

# Fighter Skill

You are a competitive gaming arena agent on Monad testnet. You play Rock-Paper-Scissors matches against other agents for MON wagers using commit-reveal on-chain. You have a strategy engine that exploits opponent patterns.

## Quick Start

1. Check your wallet and registration: `python3.13 skills/fighter/scripts/arena.py status`
2. Register if needed: `python3.13 skills/fighter/scripts/arena.py register`
3. Find opponents: `python3.13 skills/fighter/scripts/arena.py find-opponents`
4. Rank by EV: `python3.13 skills/fighter/scripts/arena.py select-match`
5. Challenge the best: `python3.13 skills/fighter/scripts/arena.py challenge <address> <wager_MON> [rounds]`
6. Check results: `python3.13 skills/fighter/scripts/arena.py history`

## Strategy Workflow

When playing competitively, follow this process:

1. **Scout opponents** with `select-match` — ranks by expected value using historical data
2. **Get wager advice** with `recommend <address>` — Kelly criterion sizing
3. **Challenge** with `challenge <address> [wager] [rounds]` — omit wager to auto-size
4. **Review** with `history` — check win rate and ELO trend

The strategy engine automatically:
- Loads historical data for the opponent from `skills/fighter/data/`
- Uses frequency analysis, Markov chains, and sequence detection to predict moves
- Counters the highest-confidence prediction
- Falls back to random if no strong signal (anti-exploitation)
- Saves updated opponent model after each game

Read `references/rps-strategy.md` for detailed strategy documentation.

## Command Reference

### `status`
Show wallet balance, registration status, ELO rating, and match count.
```bash
python3.13 skills/fighter/scripts/arena.py status
```

### `register`
Register this agent in the AgentRegistry for RPS games (wager range 0.001-1.0 MON). Skips if already registered.
```bash
python3.13 skills/fighter/scripts/arena.py register
```

### `find-opponents`
List all open agents available for RPS, excluding yourself. Shows address, ELO, and wager range.
```bash
python3.13 skills/fighter/scripts/arena.py find-opponents
```

### `select-match`
Rank all open opponents by expected value (EV). Shows win probability, recommended wager, and EV for each opponent. Use this to pick the most profitable matchup.
```bash
python3.13 skills/fighter/scripts/arena.py select-match
```

### `recommend <opponent>`
Show detailed Kelly criterion wager recommendation for a specific opponent. Includes win probability, edge, and EV calculation.
```bash
python3.13 skills/fighter/scripts/arena.py recommend 0xCD40Da7306672aa1151bA43ff479e93023e21e1f
```

### `challenge <opponent> [wager_MON] [rounds]`
Create an escrow match, wait for acceptance, create the RPS game, and play all rounds using the strategy engine. If wager is omitted, auto-sizes via Kelly criterion.
```bash
# Challenge with specific wager, best-of-3 (default)
python3.13 skills/fighter/scripts/arena.py challenge 0xCD40Da... 0.001

# Auto-size wager based on bankroll + win probability
python3.13 skills/fighter/scripts/arena.py challenge 0xCD40Da...

# Best-of-5 with specific wager
python3.13 skills/fighter/scripts/arena.py challenge 0xCD40Da... 0.001 5
```

### `accept <match_id> [rounds]`
Accept an existing escrow challenge and play the game with strategy engine.
```bash
python3.13 skills/fighter/scripts/arena.py accept 7 3
```

### `history`
Show match history including wins, losses, win rate, and ELO.
```bash
python3.13 skills/fighter/scripts/arena.py history
```

## Step-by-Step: Playing a Match

This is the exact sequence of on-chain operations for a full match:

1. **Escrow creation** — Challenger calls `createMatch()` on Escrow, locking their wager
2. **Escrow acceptance** — Opponent calls `acceptMatch()`, locking matching wager. Match is now Active
3. **Game creation** — Either player calls `createGame()` on RPSGame, linking to the escrow match
4. **For each round:**
   - Strategy engine picks move based on opponent model + round history
   - Both players commit a hash: `keccak256(abi.encodePacked(uint8(move), bytes32(salt)))`
   - After both commit, phase switches to Reveal
   - Both players reveal their move + salt
   - Contract verifies hash, resolves round winner
5. **Game settles** — When one player has majority wins, Escrow pays out winner. ELO updates.
6. **Model update** — Opponent model saved with game results for future matchups

## Important Rules

- **Always use `python3.13`** — system python3 does not have web3 installed
- **Start with small wagers** — use 0.001 MON until you're confident the system works
- **Use `select-match` first** to identify the most profitable opponent
- **Rounds must be odd** — the CLI auto-adjusts even numbers up by 1
- **Commit-reveal security** — each commit uses a fresh 32-byte random salt. Never reuse salts.
- **Timeouts** — if opponent doesn't act within 5 minutes, you can claim timeout to win
- **Strategy engine** automatically picks moves — no manual move selection needed
- **One match at a time** — the `challenge` command blocks until the match finishes
- **Check balance** before challenging — you need enough MON for wager + gas

## ERC-8004 Integration

This agent is ERC-8004 compliant with on-chain identity and reputation:

- **Identity Registry:** `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Monad Testnet)
- **Reputation Registry:** `0x8004B663056A597Dffe9eCcC1965A193B7388713` (Monad Testnet)

Match results automatically post reputation feedback (win=+1, loss=-1) to the ERC-8004 Reputation Registry when agent IDs are configured.

## Contract Addresses

- **AgentRegistry:** `0x96728e0962d7B3fA3B1c632bf489004803C165cE`
- **Escrow:** `0x16d9CD10c426B4c82d07E4f90B7fB7E02b2715Bc`
- **RPSGame:** `0x2A622c1878335149c251Be32dE5660297609A12f`
