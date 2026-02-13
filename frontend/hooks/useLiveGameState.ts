import { useState, useEffect, useRef, useCallback } from "react";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { rpsGameAbi } from "@/lib/abi/RPSGame";
import { pokerGameV2Abi } from "@/lib/abi/PokerGameV2";
import { auctionGameAbi } from "@/lib/abi/AuctionGame";

// ─── Types ────────────────────────────────────────────────────────────────────

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

  // RPS-specific
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

  // Poker-specific
  startingBudget?: number;
  p1Budget?: number;
  p2Budget?: number;
  currentBet?: bigint;
  currentTurn?: string;
  p1ExtraBets?: bigint;
  p2ExtraBets?: bigint;

  // Auction-specific
  prize?: bigint;
  p1Bid?: bigint;
  p2Bid?: bigint;
}

// ─── Phase label mappings ─────────────────────────────────────────────────────

const RPS_PHASES: Record<number, string> = {
  0: "WAITING",
  1: "COMMITTING MOVES",
  2: "REVEALING",
  3: "COMPLETE",
};

// PokerGameV2 phases: 0=Idle, 1=Commit, 2=BettingRound1, 3=BettingRound2, 4=Showdown, 5=Settled
const POKER_PHASES: Record<number, string> = {
  0: "WAITING",
  1: "COMMITTING HANDS",
  2: "BETTING ROUND 1",
  3: "BETTING ROUND 2",
  4: "SHOWDOWN",
  5: "SETTLED",
};

// AuctionGame phases: 0=Idle, 1=Commit, 2=Reveal, 3=Complete
const AUCTION_PHASES: Record<number, string> = {
  0: "WAITING",
  1: "SEALED BIDDING",
  2: "REVEALING BIDS",
  3: "COMPLETE",
};

function getPhaseLabel(gameType: string, phase: number): string {
  switch (gameType) {
    case "rps": return RPS_PHASES[phase] || `PHASE ${phase}`;
    case "poker": return POKER_PHASES[phase] || `PHASE ${phase}`;
    case "auction": return AUCTION_PHASES[phase] || `PHASE ${phase}`;
    default: return `PHASE ${phase}`;
  }
}

// ─── Game ID discovery cache (matchId → gameId) ──────────────────────────────

const gameIdCache = new Map<string, number>(); // key: `${matchId}-${gameContract}`

// ─── ABI mapping ──────────────────────────────────────────────────────────────

function getGameAbi(gameType: string) {
  switch (gameType) {
    case "rps": return rpsGameAbi;
    case "poker": return pokerGameV2Abi;
    case "auction": return auctionGameAbi;
    default: return rpsGameAbi;
  }
}

function getGameAddress(gameType: string): `0x${string}` {
  switch (gameType) {
    case "rps": return ADDRESSES.rpsGame;
    case "poker": return ADDRESSES.pokerGame;
    case "auction": return ADDRESSES.auctionGame;
    default: return ADDRESSES.rpsGame;
  }
}

// ─── Game ID discovery ────────────────────────────────────────────────────────
// Scans backward from nextGameId to find the game that belongs to this match.

async function discoverGameId(
  matchId: number,
  gameType: string,
): Promise<number | null> {
  const address = getGameAddress(gameType);
  const abi = getGameAbi(gameType);
  const cacheKey = `${matchId}-${address}`;

  // Check cache first
  if (gameIdCache.has(cacheKey)) {
    return gameIdCache.get(cacheKey)!;
  }

  try {
    const nextId = await publicClient.readContract({
      address,
      abi,
      functionName: "nextGameId",
    }) as bigint;

    const total = Number(nextId);
    // Scan backward (most recent games are more likely to match)
    const scanLimit = Math.min(total, 20);

    for (let i = total - 1; i >= total - scanLimit && i >= 0; i--) {
      try {
        const game = await publicClient.readContract({
          address,
          abi,
          functionName: "getGame",
          args: [BigInt(i)],
        }) as any;

        if (Number(game.escrowMatchId) === matchId) {
          gameIdCache.set(cacheKey, i);
          return i;
        }
      } catch {
        // Skip invalid game IDs
      }
    }
  } catch (err) {
    console.error("[discoverGameId] error:", err);
  }

  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

export function useLiveGameState(
  matchId: number | null,
  gameType: "rps" | "poker" | "auction" | "unknown" | null,
) {
  const [state, setState] = useState<LiveGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const gameIdRef = useRef<number | null>(null);

  const fetchState = useCallback(async () => {
    if (!matchId || !gameType || gameType === "unknown") return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
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

      // Build base state
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
          liveState.p1Committed = round.p1Commit !== "0x0000000000000000000000000000000000000000000000000000000000000000";
          liveState.p2Committed = round.p2Commit !== "0x0000000000000000000000000000000000000000000000000000000000000000";
          liveState.p1Revealed = round.p1Revealed;
          liveState.p2Revealed = round.p2Revealed;
        } catch {
          // Round data is supplementary
        }
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
        liveState.p1Committed = game.p1Committed;
        liveState.p2Committed = game.p2Committed;
        liveState.p1Revealed = game.p1Revealed;
        liveState.p2Revealed = game.p2Revealed;
        liveState.p1ExtraBets = game.p1ExtraBets;
        liveState.p2ExtraBets = game.p2ExtraBets;
      } else if (gameType === "auction") {
        liveState.prize = game.prize;
        liveState.p1Bid = game.p1Bid;
        liveState.p2Bid = game.p2Bid;
        liveState.p1Committed = game.p1Committed;
        liveState.p2Committed = game.p2Committed;
        liveState.p1Revealed = game.p1Revealed;
        liveState.p2Revealed = game.p2Revealed;
      }

      setState(liveState);
      setError(null);
    } catch (err) {
      console.error("[useLiveGameState] fetch error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [matchId, gameType]);

  // Reset when match changes
  useEffect(() => {
    gameIdRef.current = null;
    setState(null);
    setError(null);
  }, [matchId, gameType]);

  // Initial fetch + polling
  useEffect(() => {
    if (!matchId || !gameType || gameType === "unknown") return;

    fetchState();
    const interval = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchState, matchId, gameType]);

  return { state, loading, error };
}
