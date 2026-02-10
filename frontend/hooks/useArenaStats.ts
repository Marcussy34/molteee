import { useState, useEffect, useRef } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES, GameType } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";
import { escrowAbi } from "@/lib/abi/Escrow";

// Match status enum from Escrow contract
// 0 = Open, 1 = Active, 2 = Settled, 3 = Cancelled
const MATCH_STATUS_SETTLED = 2;

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

// Core fetch — RPC rate limiting is handled at the transport layer (lib/contracts.ts)
async function fetchArenaStats(): Promise<ArenaStats> {
  // Step 1: Get agent count using getOpenAgents per game type + nextMatchId
  // getOpenAgents returns arrays — we deduplicate across game types
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

  // Deduplicate agent addresses across game types
  const uniqueAgents = new Set([
    ...(rpsAgents as string[]).map((a) => a.toLowerCase()),
    ...(pokerAgents as string[]).map((a) => a.toLowerCase()),
    ...(auctionAgents as string[]).map((a) => a.toLowerCase()),
  ]);
  const agentCount = uniqueAgents.size;

  const totalMatches = Number(nextMatchId) - 1; // IDs start at 1
  const matchCount = Math.max(0, totalMatches);

  // Step 2: Fetch recent matches (last 10) — sequentially to respect rate limits
  const recentIds = Array.from(
    { length: Math.min(10, matchCount) },
    (_, i) => matchCount - i // most recent first
  );

  const recentMatches: GlobalMatch[] = [];
  let totalWageredWei = BigInt(0);

  // Fetch each match + winner sequentially (transport queue handles pacing)
  for (const id of recentIds) {
    try {
      const [match, winner] = await Promise.all([
        publicClient.readContract({
          address: ADDRESSES.escrow,
          abi: escrowAbi,
          functionName: "getMatch",
          args: [BigInt(id)],
        }),
        publicClient.readContract({
          address: ADDRESSES.escrow,
          abi: escrowAbi,
          functionName: "winners",
          args: [BigInt(id)],
        }).catch(() => "0x0000000000000000000000000000000000000000"),
      ]);

      const m = match as {
        player1: string;
        player2: string;
        wager: bigint;
        gameContract: string;
        status: number;
        createdAt: bigint;
      };

      const gameAddr = m.gameContract.toLowerCase();
      const status = Number(m.status);

      recentMatches.push({
        matchId: id,
        player1: m.player1,
        player2: m.player2,
        wager: parseFloat(formatEther(m.wager)).toFixed(4),
        wagerRaw: m.wager,
        gameType: GAME_NAME_MAP[gameAddr] || "Unknown",
        winner: winner as string,
        createdAt: Number(m.createdAt),
        status,
      });

      if (status === MATCH_STATUS_SETTLED) {
        totalWageredWei += m.wager * BigInt(2);
      }
    } catch {
      // Skip failed match reads
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
