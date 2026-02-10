import { useState, useEffect, useRef } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES, GameType } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";
import { escrowAbi } from "@/lib/abi/Escrow";

// Match status enum from Escrow contract
// 0 = Open, 1 = Active, 2 = Settled, 3 = Cancelled
const MATCH_STATUS_SETTLED = 2;

// Max concurrent RPC calls per batch — Monad testnet is heavily rate-limited
const BATCH_SIZE = 2;

// Delay between batches (ms) to avoid 429s
const BATCH_DELAY = 300;

// Map game contract address → human-readable name
const GAME_NAME_MAP: Record<string, string> = {
  [ADDRESSES.rpsGame.toLowerCase()]: "RPS",
  [ADDRESSES.pokerGame.toLowerCase()]: "Poker",
  [ADDRESSES.auctionGame.toLowerCase()]: "Auction",
};

export interface GlobalMatch {
  matchId: number;
  player1: string;
  player2: string;
  wager: string;
  wagerRaw: bigint;
  gameType: string;
  winner: string;
  createdAt: number;
  status: number;
}

export interface ArenaStats {
  agentCount: number;
  matchCount: number;
  totalWagered: string; // in MON
  recentMatches: GlobalMatch[];
  loading: boolean;
}

const DEFAULTS: ArenaStats = {
  agentCount: 0,
  matchCount: 0,
  totalWagered: "0",
  recentMatches: [],
  loading: true,
};

// ─── Module-level cache ────────────────────────────────────────────────────
// Prevents duplicate fetches when multiple components call useArenaStats()
let cachedData: ArenaStats | null = null;
let fetchPromise: Promise<ArenaStats> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

// Helper: sleep for ms
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper: run promises in small batches with delay to avoid RPC rate limits
async function batchedAll<T>(fns: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < fns.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY);
    const batch = fns.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// Core fetch function — minimizes RPC calls to work within Monad rate limits
async function fetchArenaStats(): Promise<ArenaStats> {
  // Step 1: Get agent count using getOpenAgents (3 calls) + nextMatchId (1 call)
  // This replaces probing 20 agentList indices with just 3 calls
  const [rpsAgents, pokerAgents, auctionAgents, nextMatchId] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "getOpenAgents",
      args: [GameType.RPS],
    }).catch(() => [] as readonly string[]),
    publicClient.readContract({
      address: ADDRESSES.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "getOpenAgents",
      args: [GameType.Poker],
    }).catch(() => [] as readonly string[]),
    publicClient.readContract({
      address: ADDRESSES.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "getOpenAgents",
      args: [GameType.Auction],
    }).catch(() => [] as readonly string[]),
    publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: escrowAbi,
      functionName: "nextMatchId",
    }),
  ]);

  // Deduplicate addresses across game types
  const uniqueAgents = new Set([
    ...(rpsAgents as string[]).map((a) => a.toLowerCase()),
    ...(pokerAgents as string[]).map((a) => a.toLowerCase()),
    ...(auctionAgents as string[]).map((a) => a.toLowerCase()),
  ]);
  const agentCount = uniqueAgents.size;

  const totalMatches = Number(nextMatchId) - 1; // IDs start at 1
  const matchCount = Math.max(0, totalMatches);

  // Step 2: Fetch recent matches (last 10) — getMatch + winners in small batches
  const recentIds = Array.from(
    { length: Math.min(10, matchCount) },
    (_, i) => matchCount - i // most recent first
  );

  let recentMatches: GlobalMatch[] = [];
  let totalWageredWei = BigInt(0);

  if (recentIds.length > 0) {
    // Fetch match data in small batches with delay
    const matchFns = recentIds.map((id) => () =>
      publicClient.readContract({
        address: ADDRESSES.escrow,
        abi: escrowAbi,
        functionName: "getMatch",
        args: [BigInt(id)],
      })
    );
    const matchResults = await batchedAll(matchFns);

    // Small delay before winner calls
    await sleep(BATCH_DELAY);

    // Fetch winners in small batches with delay
    const winnerFns = recentIds.map((id) => () =>
      publicClient.readContract({
        address: ADDRESSES.escrow,
        abi: escrowAbi,
        functionName: "winners",
        args: [BigInt(id)],
      })
    );
    const winnerResults = await batchedAll(winnerFns);

    for (let i = 0; i < recentIds.length; i++) {
      const matchResult = matchResults[i];
      if (matchResult.status !== "fulfilled") continue;

      const match = matchResult.value as {
        player1: string;
        player2: string;
        wager: bigint;
        gameContract: string;
        status: number;
        createdAt: bigint;
      };

      const winnerResult = winnerResults[i];
      const winner = winnerResult.status === "fulfilled"
        ? (winnerResult.value as string)
        : "0x0000000000000000000000000000000000000000";

      const gameAddr = match.gameContract.toLowerCase();
      const status = Number(match.status);

      recentMatches.push({
        matchId: recentIds[i],
        player1: match.player1,
        player2: match.player2,
        wager: parseFloat(formatEther(match.wager)).toFixed(4),
        wagerRaw: match.wager,
        gameType: GAME_NAME_MAP[gameAddr] || "Unknown",
        winner,
        createdAt: Number(match.createdAt),
        status,
      });

      // Accumulate wager for settled matches (both players stake)
      if (status === MATCH_STATUS_SETTLED) {
        totalWageredWei += match.wager * BigInt(2);
      }
    }
  }

  return {
    agentCount,
    matchCount,
    totalWagered: parseFloat(formatEther(totalWageredWei)).toFixed(4),
    recentMatches,
    loading: false,
  };
}

// Deduped fetch — only one in-flight request at a time, with TTL cache
function getArenaStats(): Promise<ArenaStats> {
  const now = Date.now();

  // Return cached data if still fresh
  if (cachedData && now - lastFetchTime < CACHE_TTL) {
    return Promise.resolve(cachedData);
  }

  // Return in-flight promise if already fetching
  if (fetchPromise) return fetchPromise;

  // Start new fetch
  fetchPromise = fetchArenaStats()
    .then((result) => {
      cachedData = result;
      lastFetchTime = Date.now();
      fetchPromise = null;
      return result;
    })
    .catch((err) => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
}

// Hook — multiple components can call this without duplicate RPC requests
export function useArenaStats(): ArenaStats {
  const [data, setData] = useState<ArenaStats>(cachedData || DEFAULTS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const stats = await getArenaStats();
        if (!cancelled) setData(stats);
      } catch (err) {
        console.error("Failed to fetch arena stats:", err);
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      }
    }

    load();

    // Poll every 60s
    intervalRef.current = setInterval(() => {
      lastFetchTime = 0; // Invalidate cache so next call refetches
      load();
    }, CACHE_TTL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return data;
}
