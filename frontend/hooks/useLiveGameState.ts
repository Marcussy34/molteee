import { useState, useEffect, useRef, useCallback } from "react";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { rpsGameAbi } from "@/lib/abi/RPSGame";
import { pokerGameV2Abi } from "@/lib/abi/PokerGameV2";
import { auctionGameAbi } from "@/lib/abi/AuctionGame";
import { discoverGameId, getGameAbi, getGameAddress } from "@/lib/gameDiscovery";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Completed round data fetched from chain (immutable once round is done) */
export interface RoundHistoryEntry {
  round: number;
  p1Move: number;   // 0=None, 1=Rock, 2=Paper, 3=Scissors
  p2Move: number;
  winner: "A" | "B" | "draw";
}

export interface LiveGameState {
  gameId: number;
  matchId: number;
  gameType: "rps" | "poker" | "auction";
  phase: string;       // Human-readable phase label
  phaseRaw: number;    // Raw contract enum value
  settled: boolean;

  // Common fields
  player1: string;
  player2: string;
  phaseDeadline: number; // Unix timestamp

  // ─── Transition detection (computed each poll cycle) ───────────────────────
  commitCount: number;       // 0, 1, or 2 — how many players have committed
  revealCount: number;       // 0, 1, or 2 — how many players have revealed
  phaseChanged: boolean;     // True if phaseRaw changed since last poll
  commitCountChanged: boolean; // True if commitCount changed since last poll
  revealCountChanged: boolean; // True if revealCount changed since last poll

  // ─── RPS-specific ─────────────────────────────────────────────────────────
  totalRounds?: number;
  currentRound?: number;
  p1Score?: number;
  p2Score?: number;
  // Current round RPS moves (visible after reveal)
  p1Move?: number;     // 0=None, 1=Rock, 2=Paper, 3=Scissors
  p2Move?: number;
  p1Committed?: boolean;
  p2Committed?: boolean;
  p1Revealed?: boolean;
  p2Revealed?: boolean;
  // Completed rounds history (immutable, cached permanently per game)
  roundHistory: RoundHistoryEntry[];

  // ─── Poker-specific ───────────────────────────────────────────────────────
  startingBudget?: number;
  p1Budget?: number;
  p2Budget?: number;
  currentBet?: bigint;
  currentTurn?: string;
  p1ExtraBets?: bigint;
  p2ExtraBets?: bigint;

  // ─── Auction-specific ─────────────────────────────────────────────────────
  prize?: bigint;
  p1Bid?: bigint;
  p2Bid?: bigint;
}

// ─── Phase label mappings ─────────────────────────────────────────────────────

// RPS phases: 0=Commit, 1=Reveal, 2=Complete (no Idle — contract starts at Commit)
const RPS_PHASES: Record<number, string> = {
  0: "COMMITTING MOVES",
  1: "REVEALING",
  2: "COMPLETE",
};

// PokerGameV2 phases: 0=Commit, 1=BettingRound1, 2=BettingRound2, 3=Showdown, 4=Complete
const POKER_PHASES: Record<number, string> = {
  0: "COMMITTING HANDS",
  1: "BETTING ROUND 1",
  2: "BETTING ROUND 2",
  3: "SHOWDOWN",
  4: "SETTLED",
};

// AuctionGame phases: 0=Commit, 1=Reveal, 2=Complete
const AUCTION_PHASES: Record<number, string> = {
  0: "SEALED BIDDING",
  1: "REVEALING BIDS",
  2: "COMPLETE",
};

function getPhaseLabel(gameType: string, phase: number): string {
  switch (gameType) {
    case "rps": return RPS_PHASES[phase] || `PHASE ${phase}`;
    case "poker": return POKER_PHASES[phase] || `PHASE ${phase}`;
    case "auction": return AUCTION_PHASES[phase] || `PHASE ${phase}`;
    default: return `PHASE ${phase}`;
  }
}

// ─── Game ID discovery ──────────────────────────────────────────────────────
// Uses shared discoverGameId() from @/lib/gameDiscovery — event log lookup
// with backward-scan fallback. See that module for implementation details.

// ─── Settled match cache (past matches never change — skip chain calls) ───────
// Key: `${matchId}-${gameType}`. Settled game state is immutable.
const settledMatchCache = new Map<string, LiveGameState>();
const SETTLED_CACHE_MAX = 50; // Limit memory use

// ─── Round history cache (completed rounds never change) ─────────────────────
// Key: `${gameId}-${roundIndex}`. Once a round is complete, its data is immutable.
const roundHistoryCache = new Map<string, RoundHistoryEntry>();

// ─── ABI / address helpers ──────────────────────────────────────────────────
// Imported from @/lib/gameDiscovery (shared with useActiveMatches)

// ─── RPS round winner logic ──────────────────────────────────────────────────

function determineRoundWinner(p1Move: number, p2Move: number): "A" | "B" | "draw" {
  if (!p1Move || !p2Move) return "draw";
  if (p1Move === p2Move) return "draw";
  if (
    (p1Move === 1 && p2Move === 3) ||
    (p1Move === 2 && p2Move === 1) ||
    (p1Move === 3 && p2Move === 2)
  ) return "A";
  return "B";
}

// ─── Fetch completed round history for RPS ───────────────────────────────────
// Only fetches rounds we haven't cached yet. Rounds are immutable once complete.

async function fetchRoundHistory(
  gameId: number,
  currentRound: number,
): Promise<RoundHistoryEntry[]> {
  const history: RoundHistoryEntry[] = [];

  for (let i = 0; i < currentRound; i++) {
    const cacheKey = `${gameId}-${i}`;

    // Use cached data if available (rounds are immutable)
    if (roundHistoryCache.has(cacheKey)) {
      history.push(roundHistoryCache.get(cacheKey)!);
      continue;
    }

    // Fetch from chain — this only happens once per completed round
    try {
      const round = await publicClient.readContract({
        address: ADDRESSES.rpsGame,
        abi: rpsGameAbi,
        functionName: "getRound",
        args: [BigInt(gameId), BigInt(i)],
      }) as any;

      const entry: RoundHistoryEntry = {
        round: i,
        p1Move: Number(round.p1Move),
        p2Move: Number(round.p2Move),
        winner: determineRoundWinner(Number(round.p1Move), Number(round.p2Move)),
      };

      roundHistoryCache.set(cacheKey, entry);
      history.push(entry);
    } catch {
      // Skip rounds we can't fetch (shouldn't happen for completed rounds)
    }
  }

  return history;
}


// ─── Helper: compute commit/reveal counts from booleans ──────────────────────

function computeCommitCount(p1: boolean, p2: boolean): number {
  return (p1 ? 1 : 0) + (p2 ? 1 : 0);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL = 5_000;

function getSettledCacheKey(matchId: number, gameType: string): string {
  return `${matchId}-${gameType}`;
}

function evictSettledCacheIfNeeded() {
  while (settledMatchCache.size > SETTLED_CACHE_MAX) {
    const firstKey = settledMatchCache.keys().next().value;
    if (firstKey !== undefined) settledMatchCache.delete(firstKey);
  }
}

export function useLiveGameState(
  matchId: number | null,
  gameType: "rps" | "poker" | "auction" | "unknown" | null,
  isSettled?: boolean,
  pollInterval: number = DEFAULT_POLL_INTERVAL,
) {
  const [state, setState] = useState<LiveGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const gameIdRef = useRef<number | null>(null);

  // Track previous state for transition detection
  const prevStateRef = useRef<{
    phaseRaw: number;
    commitCount: number;
    revealCount: number;
  } | null>(null);

  const fetchState = useCallback(async () => {
    if (!matchId || !gameType || gameType === "unknown") return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Cache hit for past match — no chain calls needed
      if (isSettled) {
        const cacheKey = getSettledCacheKey(matchId, gameType);
        const cached = settledMatchCache.get(cacheKey);
        if (cached) {
          setState(cached);
          setError(null);
          setLoading(false);
          fetchingRef.current = false;
          return;
        }
      }

      // Discover game ID if we don't have it yet
      if (gameIdRef.current === null) {
        setLoading(true);
        const gid = await discoverGameId(matchId, gameType);
        if (gid === null) {
          // Game not created yet — could be pending accept
          setState(null);
          setError("Game not found — may not be created yet");
          setLoading(false);
          fetchingRef.current = false;
          return;
        }
        gameIdRef.current = gid;
      }

      const gameId = gameIdRef.current;
      const address = getGameAddress(gameType);
      const abi = getGameAbi(gameType);

      // Fetch game state
      const game = await publicClient.readContract({
        address,
        abi,
        functionName: "getGame",
        args: [BigInt(gameId)],
      }) as any;

      const phaseRaw = Number(game.phase);

      // ─── Compute commit/reveal counts ───────────────────────────────────
      let p1Committed = false;
      let p2Committed = false;
      let p1Revealed = false;
      let p2Revealed = false;

      // Build base state (common fields first, game-specific below)
      const liveState: LiveGameState = {
        gameId,
        matchId,
        gameType,
        phase: getPhaseLabel(gameType, phaseRaw),
        phaseRaw,
        settled: game.settled,
        player1: game.player1,
        player2: game.player2,
        phaseDeadline: Number(game.phaseDeadline),
        // Transition detection — computed after we know commit/reveal
        commitCount: 0,
        revealCount: 0,
        phaseChanged: false,
        commitCountChanged: false,
        revealCountChanged: false,
        // Round history (populated for RPS below)
        roundHistory: [],
      };

      // Game-type-specific fields
      if (gameType === "rps") {
        liveState.totalRounds = Number(game.totalRounds);
        liveState.currentRound = Number(game.currentRound);
        liveState.p1Score = Number(game.p1Score);
        liveState.p2Score = Number(game.p2Score);

        // Fetch current round data for move/commit info
        try {
          const round = await publicClient.readContract({
            address,
            abi: rpsGameAbi,
            functionName: "getRound",
            args: [BigInt(gameId), BigInt(game.currentRound)],
          }) as any;

          liveState.p1Move = Number(round.p1Move);
          liveState.p2Move = Number(round.p2Move);
          p1Committed = round.p1Commit !== "0x0000000000000000000000000000000000000000000000000000000000000000";
          p2Committed = round.p2Commit !== "0x0000000000000000000000000000000000000000000000000000000000000000";
          p1Revealed = round.p1Revealed;
          p2Revealed = round.p2Revealed;
          liveState.p1Committed = p1Committed;
          liveState.p2Committed = p2Committed;
          liveState.p1Revealed = p1Revealed;
          liveState.p2Revealed = p2Revealed;
        } catch {
          // Round data is supplementary
        }

        // Fetch completed round history (only new rounds, rest from cache)
        liveState.roundHistory = await fetchRoundHistory(gameId, Number(game.currentRound));
      } else if (gameType === "poker") {
        liveState.totalRounds = Number(game.totalRounds);
        liveState.currentRound = Number(game.currentRound);
        liveState.p1Score = Number(game.p1Score);
        liveState.p2Score = Number(game.p2Score);
        liveState.startingBudget = Number(game.startingBudget);
        liveState.p1Budget = Number(game.p1Budget);
        liveState.p2Budget = Number(game.p2Budget);
        liveState.currentBet = game.currentBet;
        liveState.currentTurn = game.currentTurn;
        p1Committed = game.p1Committed;
        p2Committed = game.p2Committed;
        p1Revealed = game.p1Revealed;
        p2Revealed = game.p2Revealed;
        liveState.p1Committed = p1Committed;
        liveState.p2Committed = p2Committed;
        liveState.p1Revealed = p1Revealed;
        liveState.p2Revealed = p2Revealed;
        liveState.p1ExtraBets = game.p1ExtraBets;
        liveState.p2ExtraBets = game.p2ExtraBets;
      } else if (gameType === "auction") {
        liveState.prize = game.prize;
        liveState.p1Bid = game.p1Bid;
        liveState.p2Bid = game.p2Bid;
        p1Committed = game.p1Committed;
        p2Committed = game.p2Committed;
        p1Revealed = game.p1Revealed;
        p2Revealed = game.p2Revealed;
        liveState.p1Committed = p1Committed;
        liveState.p2Committed = p2Committed;
        liveState.p1Revealed = p1Revealed;
        liveState.p2Revealed = p2Revealed;
      }

      // ─── Compute commit/reveal counts and transition flags ──────────────
      const commitCount = computeCommitCount(p1Committed, p2Committed);
      const revealCount = computeCommitCount(p1Revealed, p2Revealed);
      const prev = prevStateRef.current;

      liveState.commitCount = commitCount;
      liveState.revealCount = revealCount;
      liveState.phaseChanged = prev !== null && prev.phaseRaw !== phaseRaw;
      liveState.commitCountChanged = prev !== null && prev.commitCount !== commitCount;
      liveState.revealCountChanged = prev !== null && prev.revealCount !== revealCount;

      // Update previous state ref for next poll cycle
      prevStateRef.current = { phaseRaw, commitCount, revealCount };

      setState(liveState);
      setError(null);

      // Cache settled matches — they never change, so skip future chain calls
      if (liveState.settled) {
        const cacheKey = getSettledCacheKey(matchId, gameType);
        settledMatchCache.set(cacheKey, liveState);
        evictSettledCacheIfNeeded();
      }
    } catch (err) {
      console.error("[useLiveGameState] fetch error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [matchId, gameType, isSettled]);

  // Reset when match changes
  useEffect(() => {
    gameIdRef.current = null;
    prevStateRef.current = null;
    setState(null);
    setError(null);
  }, [matchId, gameType]);

  // Initial fetch + polling (no polling for settled matches — they never change)
  useEffect(() => {
    if (!matchId || !gameType || gameType === "unknown") return;

    fetchState();
    if (isSettled) {
      // Past match: no polling needed
      return;
    }
    const interval = setInterval(fetchState, pollInterval);
    return () => clearInterval(interval);
  }, [fetchState, matchId, gameType, isSettled, pollInterval]);

  return { state, loading, error };
}
