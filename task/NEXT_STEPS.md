# Next Steps — Submission Prep

> **Deadline:** February 15, 2026 23:59 ET (~5 days)
> **Submit on:** moltiverse.dev

---

## What's Done

- [x] 8 smart contracts deployed to Monad testnet (160 tests passing)
- [x] Fighter skill: 32 CLI commands, multi-signal strategy, psychology, bankroll management
- [x] Spectator skill: 5 commands, ELO-based prediction market betting
- [x] 5 opponent bots with distinct strategies
- [x] Next.js dashboard reading live on-chain data (5 pages, dark mode)
- [x] ERC-8004 agent identity registered (Agent ID 10)
- [x] 32+ matches played (ELO 1099)
- [x] Social integration: Moltbook + MoltX registered, MoltX posting live, wallet linked

---

## Priority 1 — E2E Testnet Validation (CRITICAL)

Play live matches and verify every feature works end-to-end on Monad testnet. This is the most important thing before submission.

### 1a. Run more matches
```bash
# Start opponent bots
python3.13 opponents/run_all.py

# Challenge to RPS, Poker, Auction using arena-tools CLI
npx arena-tools challenge <opponent> 0.001 rps
npx arena-tools challenge <opponent> 0.001 poker
npx arena-tools challenge <opponent> 0.001 auction

# After opponent accepts + you create game, play rounds:
npx arena-tools rps-round <game_id> rock
npx arena-tools poker-step <game_id> 75
npx arena-tools auction-round <game_id> 0.0005
```
**Goal:** 20+ total matches, positive win rate, all 3 game types played.

### 1b. Test prediction market lifecycle
```bash
# List existing markets
npx arena-tools list-markets

# While a match is Active, create a market
npx arena-tools create-market <match_id> 0.01

# Buy tokens
npx arena-tools bet <market_id> yes 0.005

# After match settles, resolve + redeem
npx arena-tools resolve-market <market_id>
npx arena-tools redeem <market_id>
```

### 1c. Test tournament lifecycle
```bash
# Create a 4-player round-robin
npx arena-tools create-tournament round-robin 4 --entry-fee 0.01 --base-wager 0.001

# Join the tournament
npx arena-tools join-tournament <tournament_id>
```

### 1d. Verify dashboard shows real data
```bash
cd frontend && npm run dev
# Check: stat cards, match table, opponent cards, market prices, tournament cards
```

---

## Priority 2 — README + Dashboard Reference Update

### 2a. Update README.md
- Change `dashboard/` references to `frontend/` (the old Vite dashboard was deleted)
- Update the dashboard section to mention Next.js + shadcn/ui instead of Vite + React
- Update `npm run dev` port from 5173 to 3000
- Update project structure tree to show `frontend/` instead of `dashboard/`

### 2b. Update SOLUTION.md if needed
- `docs/SOLUTION.md` may reference old dashboard — check and update

---

## Priority 3 — Demo Recording

Record a 3-5 minute demo video showing:

1. **Agent status** — `arena.py status` showing registration, ELO, balance
2. **Opponent discovery** — `arena.py find-opponents` listing available bots
3. **Live match** — Play an RPS match showing strategy reasoning + psychology timing
4. **Match history** — `arena.py history` showing wins/losses
5. **Dashboard** — Browser showing live stat cards, ELO chart, match table
6. **Prediction market** — Create market, buy tokens, resolve, redeem
7. **Tournament** — Show tournament status/standings
8. **OpenClaw integration** — (Optional) Show the LLM agent autonomously playing

**Tips:**
- Use `demo.py` as the script backbone
- Have the dashboard open in a browser side-by-side with terminal
- Highlight the on-chain tx hashes in terminal output

---

## Priority 4 — Polish (If Time Allows)

### 4a. Social integration (DONE — see task/completed/09-SOCIAL-COMPLETED.md)
- [x] Moltbook registered, API key saved, owner account created
- [x] MoltX registered, API key saved, wallet linked, challenge invite posted
- [x] Both platforms wired into RPS, Poker, Auction game settlement
- [ ] Moltbook claim pending (rate-limited, retry after cooldown)
- [ ] MoltX claim optional (tweet claim code `molt-OK`)

### 4b. OpenClaw autonomous run
- Start `openclaw gateway --port 18789`
- Run `openclaw agent` with fighter skill loaded
- Let the agent autonomously play 5+ matches
- Capture the agent's reasoning output for the demo

### 4c. Spectator autonomous run
- Run the spectator skill watching for active matches
- Let it auto-bet on markets with positive edge
- Show the prediction accuracy tracker

---

## Priority 5 — Submission

1. Push all code to repository
2. Collect tx hashes from all on-chain activity
3. Record demo video (Priority 3)
4. Fill out submission form on moltiverse.dev:
   - Project name, description, repo link
   - Demo video link
   - Contract addresses
   - Key features list
5. Double-check submission checklist from `task/00-OVERVIEW.md`

---

## Submission Checklist

- [x] 20+ matches played on Monad testnet (32+ matches, ELO 1099)
- [x] All 3 game types demonstrated (RPS, Poker, Auction)
- [x] Prediction market full lifecycle completed on-chain (Market ID 2, Match 33, 16 txs)
- [x] Tournament completed on-chain (Tournament ID 1, 4 players, 6 RR matches scheduled)
- [x] Dashboard shows live data at localhost:3000
- [ ] Demo video recorded (3-5 minutes)
- [x] README.md updated with `frontend/` references
- [ ] All tx hashes documented
- [x] Social presence: Moltbook + MoltX registered, posting live
- [ ] Code pushed to repository
- [ ] Submitted on moltiverse.dev before Feb 15 23:59 ET
