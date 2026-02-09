# Next Steps — Submission Prep

> **Deadline:** February 15, 2026 23:59 ET (~5 days)
> **Submit on:** moltiverse.dev

---

## What's Done

- [x] 8 smart contracts deployed to Monad testnet (160 tests passing)
- [x] Fighter skill: 27 CLI commands, multi-signal strategy, psychology, bankroll management
- [x] Spectator skill: 5 commands, ELO-based prediction market betting
- [x] 5 opponent bots with distinct strategies
- [x] Next.js dashboard reading live on-chain data (5 pages, dark mode)
- [x] ERC-8004 agent identity registered (Agent ID 10)
- [x] 12 matches played (58.3% win rate, ELO 1059)

---

## Priority 1 — E2E Testnet Validation (CRITICAL)

Play live matches and verify every feature works end-to-end on Monad testnet. This is the most important thing before submission.

### 1a. Run more matches
```bash
# Start opponent bots
python3.13 opponents/run_all.py

# Play RPS, Poker, Auction matches against all 5 bots
python3.13 skills/fighter/scripts/arena.py challenge <opponent> 0.001
python3.13 skills/fighter/scripts/arena.py challenge-poker <opponent> 0.001
python3.13 skills/fighter/scripts/arena.py challenge-auction <opponent> 0.001
```
**Goal:** 20+ total matches, positive win rate, all 3 game types played.

### 1b. Test prediction market lifecycle
```bash
# While a match is Active, create a market
python3.13 skills/fighter/scripts/arena.py create-market <match_id> 0.01

# Buy tokens
python3.13 skills/fighter/scripts/arena.py bet <market_id> yes 0.005

# After match settles, resolve + redeem
python3.13 skills/fighter/scripts/arena.py resolve-market <market_id>
python3.13 skills/fighter/scripts/arena.py redeem <market_id>
```

### 1c. Test tournament lifecycle
```bash
# Create a 4-player round-robin
python3.13 skills/fighter/scripts/arena.py create-round-robin 0.01 0.001 4

# Register fighter + 3 bots, then play all matches
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

### 4a. Moltbook integration
- Test `arena.py moltbook-register` and `arena.py moltbook-post`
- Verify posts appear on moltbook.com
- Set `MOLTBOOK_API_KEY` in `.env`

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

- [ ] 20+ matches played on Monad testnet
- [ ] All 3 game types demonstrated (RPS, Poker, Auction)
- [ ] Prediction market full lifecycle completed on-chain
- [ ] Tournament completed on-chain
- [ ] Dashboard shows live data at localhost:3000
- [ ] Demo video recorded (3-5 minutes)
- [ ] README.md updated with `frontend/` references
- [ ] All tx hashes documented
- [ ] Code pushed to repository
- [ ] Submitted on moltiverse.dev before Feb 15 23:59 ET
