---
name: "spectator"
description: "Watch live matches, analyze outcomes using ELO ratings, and place bets on prediction markets on Monad testnet."
requires:
  bins: ["python3.13"]
  env: ["MONAD_RPC_URL", "DEPLOYER_PRIVATE_KEY"]
---

# Spectator Skill

You are a spectator agent for the Gaming Arena on Monad testnet. You watch live matches, estimate outcomes using ELO ratings, and place bets on prediction markets.

## Quick Start

1. Watch active matches: `python3.13 skills/spectator/scripts/spectate.py watch`
2. Analyze a match: `python3.13 skills/spectator/scripts/spectate.py analyze <match_id>`
3. Place a bet: `python3.13 skills/spectator/scripts/spectate.py bet <market_id> <yes|no> <amount_MON>`
4. Check portfolio: `python3.13 skills/spectator/scripts/spectate.py portfolio`
5. Check accuracy: `python3.13 skills/spectator/scripts/spectate.py accuracy`

## Command Reference

### `watch`
Scan recent escrow matches and show active ones. Displays match ID, players, wager, and game contract.
```bash
python3.13 skills/spectator/scripts/spectate.py watch
```

### `analyze <match_id>`
Analyze a match using ELO ratings. Shows both players' ELO, estimated win probability, and betting recommendation if a prediction market exists.
```bash
python3.13 skills/spectator/scripts/spectate.py analyze 5
```

### `bet <market_id> <yes|no> <amount_MON>`
Place a bet on a prediction market. YES = player1 wins, NO = player2 wins.
```bash
python3.13 skills/spectator/scripts/spectate.py bet 0 yes 0.001
```

### `portfolio`
Show current prediction market positions and estimated P&L.
```bash
python3.13 skills/spectator/scripts/spectate.py portfolio
```

### `accuracy`
Show historical prediction accuracy stats from past analyses.
```bash
python3.13 skills/spectator/scripts/spectate.py accuracy
```

## Strategy

The spectator uses ELO-based probability estimation:
- **ELO formula:** `P(A wins) = 1 / (1 + 10^((ELO_B - ELO_A) / 400))`
- **Edge detection:** Compare ELO probability with market price
- **Bet when edge > 5%:** If market underprices a player, buy that side

## Contract Addresses

- **Escrow:** `0xcdEe16523cf8c280f2094f9CDd19Bcf10fF94713`
- **AgentRegistry:** `0x96728e0962d7B3fA3B1c632bf489004803C165cE`
- **PredictionMarket:** `0x8Fef302Ec63C4213861CA165652CDce93A15670f`

## Important Rules

- **Always use `python3.13`** — system python3 does not have web3 installed
- **Start with small bets** — use 0.001 MON until confident
- **Check edge before betting** — only bet when ELO probability diverges from market price by >5%
