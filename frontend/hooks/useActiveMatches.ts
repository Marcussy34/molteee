import { useState, useEffect, useRef, useCallback } from "react";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { escrowAbi } from "@/lib/abi/Escrow";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameFilter = "all" | "rps" | "poker" | "auction";

// Match status from Escrow contract: 0=Pending, 1=Active, 2=Settled, 3=Cancelled
export type MatchStatus = "pending" | "active" | "settled" | "cancelled";

export interface OnChainMatch {
  matchId: number;
  player1: string;
  player2: string;
  wager: bigint;
  gameContract: string;
  status: MatchStatus;
  createdAt: number;
  gameType: "rps" | "poker" | "auction" | "unknown";
  winner?: string; // populated for settled matches
}

// ─── Game type detection from contract address ────────────────────────────────

// Map game contract addresses to game types (lowercase for comparison)
const GAME_CONTRACT_MAP: Record<string, "rps" | "poker" | "auction"> = {
  [ADDRESSES.rpsGame.toLowerCase()]: "rps",
  [ADDRESSES.pokerGame.toLowerCase()]: "poker",
  [ADDRESSES.auctionGame.toLowerCase()]: "auction",
};

function detectGameType(gameContract: string): "rps" | "poker" | "auction" | "unknown" {
  return GAME_CONTRACT_MAP[gameContract.toLowerCase()] || "unknown";
}

function parseStatus(status: number): MatchStatus {
  switch (status) {
    case 0: return "pending";
    case 1: return "active";
    case 2: return "settled";
    case 3: return "cancelled";
    default: return "pending";
  }
}

// ─── Module-level cache ──────────────────────────────────────────────────────
// Prevents duplicate fetches across component re-renders and strict mode

let cachedLive: OnChainMatch[] = [];
let cachedSettled: OnChainMatch[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 8_000; // Don't re-fetch if data is <8s old
const POLL_INTERVAL_MS = 10_000;
const SCAN_WINDOW = 30; // How many recent matches to scan

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActiveMatches(filter: GameFilter = "all") {
  const [liveMatches, setLiveMatches] = useState<OnChainMatch[]>(cachedLive);
  const [recentSettled, setRecentSettled] = useState<OnChainMatch[]>(cachedSettled);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchMatches = useCallback(async () => {
    // Dedup: skip if already fetching
    if (fetchingRef.current) return;

    // Skip if cache is fresh
    const now = Date.now();
    if (now - lastFetchTime < CACHE_TTL_MS && cachedLive.length + cachedSettled.length > 0) {
      setLiveMatches(cachedLive);
      setRecentSettled(cachedSettled);
      setLoading(false);
      return;
    }

    fetchingRef.current = true;

    try {
      // Get total match count
      const nextMatchId = await publicClient.readContract({
        address: ADDRESSES.escrow,
        abi: escrowAbi,
        functionName: "nextMatchId",
      }) as bigint;

      const total = Number(nextMatchId);
      if (total === 0) {
        cachedLive = [];
        cachedSettled = [];
        lastFetchTime = Date.now();
        setLiveMatches([]);
        setRecentSettled([]);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // Scan the last SCAN_WINDOW matches
      const startId = Math.max(0, total - SCAN_WINDOW);
      const matchPromises: Promise<OnChainMatch | null>[] = [];

      for (let id = startId; id < total; id++) {
        matchPromises.push(
          (async () => {
            try {
              const data = await publicClient.readContract({
                address: ADDRESSES.escrow,
                abi: escrowAbi,
                functionName: "getMatch",
                args: [BigInt(id)],
              }) as any;

              const status = parseStatus(Number(data.status));
              const match: OnChainMatch = {
                matchId: id,
                player1: data.player1,
                player2: data.player2,
                wager: data.wager,
                gameContract: data.gameContract,
                status,
                createdAt: Number(data.createdAt),
                gameType: detectGameType(data.gameContract),
              };

              // Get winner for settled matches
              if (status === "settled") {
                try {
                  const winner = await publicClient.readContract({
                    address: ADDRESSES.escrow,
                    abi: escrowAbi,
                    functionName: "winners",
                    args: [BigInt(id)],
                  }) as string;
                  if (winner && winner !== "0x0000000000000000000000000000000000000000") {
                    match.winner = winner;
                  }
                } catch {
                  // Winner lookup is best-effort
                }
              }

              return match;
            } catch {
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(matchPromises);
      const matches = results.filter((m): m is OnChainMatch => m !== null);

      // Separate live (active/pending) from settled
      const live = matches
        .filter((m) => m.status === "active" || m.status === "pending")
        .sort((a, b) => b.createdAt - a.createdAt);

      const settled = matches
        .filter((m) => m.status === "settled")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10); // Keep only 10 most recent settled

      // Update module cache
      cachedLive = live;
      cachedSettled = settled;
      lastFetchTime = Date.now();

      setLiveMatches(live);
      setRecentSettled(settled);
    } catch (err) {
      console.error("[useActiveMatches] fetch error:", err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Apply game type filter
  const filteredLive = filter === "all"
    ? liveMatches
    : liveMatches.filter((m) => m.gameType === filter);

  const filteredSettled = filter === "all"
    ? recentSettled
    : recentSettled.filter((m) => m.gameType === filter);

  return { liveMatches: filteredLive, recentSettled: filteredSettled, loading };
}
