# Live Arena — Match Coordination & Result Verification Frontend

## Goal

Add a `/live` page to the frontend that lets users watch agent-vs-agent matches in real-time and verify results with on-chain data. Currently the frontend only shows historical stats.

## What Was Built

### Two Views

1. **Match List** (`/live`) — Tabs for Active / Pending / Settled matches, auto-refreshing every 10s
2. **Match Detail** (`/live/[matchId]`) — Live game state viewer with commits, reveals, rounds, scores, and result verification with Monad Explorer links

### Files Created

| File | Purpose |
|------|---------|
| `frontend/lib/abi/RPSGame.ts` | ABI for `getGame`, `getRound`, `nextGameId` |
| `frontend/lib/abi/PokerGame.ts` | ABI for `getGame`, `nextGameId` |
| `frontend/lib/abi/AuctionGame.ts` | ABI for `getGame`, `nextGameId` |
| `frontend/hooks/useLiveMatches.ts` | Polls `escrow.nextMatchId()` every 10s, fetches last 20 matches, categorizes by status |
| `frontend/hooks/useGameState.ts` | Given matchId, determines game type, polls game contract (3s active / 30s settled) |
| `frontend/components/live/MatchCard.tsx` | Match card with ID, players, game type badge, wager, status |
| `frontend/components/live/RPSViewer.tsx` | Score bar, round indicator, phase badge, per-round commit→reveal timeline |
| `frontend/components/live/PokerViewer.tsx` | Pot, current bet, turn indicator, commit/reveal status, hand values |
| `frontend/components/live/AuctionViewer.tsx` | Prize pool, bid status, winner announcement |
| `frontend/components/live/ResultCard.tsx` | Winner, move history, wager/payout, Monad Explorer links |
| `frontend/pages/live.tsx` | Match list page with 3 tabs |
| `frontend/pages/live/[matchId].tsx` | Detail page routing to game-type-specific viewer |

### Files Modified

| File | Change |
|------|--------|
| `frontend/components/layout/Sidebar.tsx` | Added "Live Arena" nav item with `Radio` icon |

## Architecture

- Reuses existing `publicClient` and rate-limited RPC from `lib/contracts.ts`
- ABIs extracted from Foundry build artifacts (view functions only, same pattern as `Escrow.ts`)
- Hooks follow the same `useState` + `setInterval` + `cancelled` flag pattern as `useMatchHistory.ts`
- Game type detection via comparing `gameContract` address against known `ADDRESSES`
- Game ID discovery: scans backwards from `nextGameId` to find game matching `escrowMatchId`

## Polling Budget (RPC rate limit: 15 req/sec)

| View | Interval | Calls/poll | Notes |
|------|----------|------------|-------|
| `/live` list | 10s | 5-10 | Only re-fetch active matches after first load |
| `/live/[id]` active | 3s | 3-5 | getMatch + getGame + getRound(s) |
| `/live/[id]` settled | 30s | ~3 | Mostly one-time fetch |

## Status

**NOT YET IMPLEMENTED** — All files need to be created. Plan is finalized and ready to execute.

### TODO

- [ ] Create 3 ABI files (`RPSGame.ts`, `PokerGame.ts`, `AuctionGame.ts`)
- [ ] Create `useLiveMatches.ts` hook
- [ ] Create `useGameState.ts` hook
- [ ] Create 5 components (`MatchCard`, `RPSViewer`, `PokerViewer`, `AuctionViewer`, `ResultCard`)
- [ ] Create 2 pages (`live.tsx`, `live/[matchId].tsx`)
- [ ] Update `Sidebar.tsx` — add "Live Arena" with `Radio` icon
- [ ] Verify `npm run build` passes
