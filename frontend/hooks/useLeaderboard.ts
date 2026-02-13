/**
 * useLeaderboard — Fetches leaderboard data from AgentRegistry on-chain.
 *
 * Agent discovery: Uses agentList to include ALL registered agents (including
 * those who closed their status). Previously used getOpenAgents which excluded them.
 *
 * Caching strategy:
 * - Module-level cache with 60s TTL: no RPC if data is fresh
 * - Optional localStorage: show last known data on cold load, fetch in background
 * - Poll every 60s to refresh
 * - Filter changes sort client-side only (no re-fetch)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { publicClient, ADDRESSES, GameType } from "@/lib/contracts";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";
import type { LeaderboardEntry } from "@/lib/types";

// Address → display name from agents.json (known agents get friendly names)
import agentsData from "@/data/agents.json";

const STORAGE_KEY = "leaderboard-data-v3"; // v3: all registered agents (not just open)
const CACHE_TTL = 60_000; // 60 seconds

// Build address→name map (case-insensitive)
const NAME_MAP: Record<string, string> = {};
(agentsData as { address: string; name: string }[]).forEach((a) => {
  NAME_MAP[a.address.toLowerCase()] = a.name;
});

function getDisplayName(address: string): string {
  return NAME_MAP[address.toLowerCase()] ?? `${address.slice(0, 8)}...`;
}

export type LeaderboardFilter = "" | "rps" | "poker" | "auction";

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  loading: boolean;
  refresh: () => void;
}

// Raw entry with all ELO and per-game wins/losses (for client-side filter/sort)
interface RawEntry {
  address: string;
  name: string;
  eloRps: number;
  eloPoker: number;
  eloAuction: number;
  eloOverall: number;
  winsRps: number;
  lossesRps: number;
  winsPoker: number;
  lossesPoker: number;
  winsAuction: number;
  lossesAuction: number;
  winsOverall: number;
  lossesOverall: number;
}

// ─── Module-level cache ────────────────────────────────────────────────────
let cachedRaw: RawEntry[] | null = null;
let fetchPromise: Promise<RawEntry[]> | null = null;
let lastFetchTime = 0;

// Fetch all registered agents by iterating agentList (includes closed agents)
async function fetchAllAgentAddresses(): Promise<string[]> {
  const addresses: string[] = [];
  const MAX_AGENTS = 100;
  for (let i = 0; i < MAX_AGENTS; i++) {
    try {
      const addr = await publicClient.readContract({
        address: ADDRESSES.agentRegistry,
        abi: agentRegistryAbi,
        functionName: "agentList",
        args: [BigInt(i)],
      });
      addresses.push((addr as string).toLowerCase());
    } catch {
      break; // Reached end of list or error
    }
  }
  return addresses;
}

// Core fetch — RPC rate limiting handled at transport layer (lib/contracts.ts)
async function fetchLeaderboard(): Promise<RawEntry[]> {
  // Step 1: Get ALL registered agents (not just open ones) via agentList
  const uniqueAddresses = await fetchAllAgentAddresses();

  // Step 2: For each agent, fetch ELO + match history (sequential to respect rate limits)
  const rawEntries: RawEntry[] = [];

  for (const addrLower of uniqueAddresses) {
    try {
      const addr = addrLower as `0x${string}`;
      const [eloRps, eloPoker, eloAuction, matchHistory] = await Promise.all([
        publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "elo",
          args: [addr, GameType.RPS],
        }),
        publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "elo",
          args: [addr, GameType.Poker],
        }),
        publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "elo",
          args: [addr, GameType.Auction],
        }),
        publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "getMatchHistory",
          args: [addr],
        }),
      ]);

      const eloByGame = {
        rps: Number(eloRps),
        poker: Number(eloPoker),
        auction: Number(eloAuction),
      };

      // Overall ELO = average of non-zero game ELOs (default 1000 if none)
      const nonZero = [eloByGame.rps, eloByGame.poker, eloByGame.auction].filter((e) => e > 0);
      const eloOverall = nonZero.length > 0
        ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
        : 1000;

      // Wins/losses per game type from match history (gameType: 0=RPS, 1=Poker, 2=Auction)
      const history = matchHistory as unknown as { won: boolean; gameType: number }[];
      const winsRps = history.filter((r) => r.gameType === GameType.RPS && r.won).length;
      const lossesRps = history.filter((r) => r.gameType === GameType.RPS && !r.won).length;
      const winsPoker = history.filter((r) => r.gameType === GameType.Poker && r.won).length;
      const lossesPoker = history.filter((r) => r.gameType === GameType.Poker && !r.won).length;
      const winsAuction = history.filter((r) => r.gameType === GameType.Auction && r.won).length;
      const lossesAuction = history.filter((r) => r.gameType === GameType.Auction && !r.won).length;
      const winsOverall = history.filter((r) => r.won).length;
      const lossesOverall = history.filter((r) => !r.won).length;

      rawEntries.push({
        address: addrLower,
        name: getDisplayName(addrLower),
        eloRps: eloByGame.rps,
        eloPoker: eloByGame.poker,
        eloAuction: eloByGame.auction,
        eloOverall,
        winsRps,
        lossesRps,
        winsPoker,
        lossesPoker,
        winsAuction,
        lossesAuction,
        winsOverall,
        lossesOverall,
      });
    } catch {
      // Skip failed agent reads
    }
  }

  return rawEntries;
}

// Convert raw entries to LeaderboardEntry[] sorted by filter's ELO, with filter-specific wins/losses
function toLeaderboardEntries(raw: RawEntry[], filter: LeaderboardFilter): LeaderboardEntry[] {
  const eloKey = filter === "rps" ? "eloRps" : filter === "poker" ? "eloPoker" : filter === "auction" ? "eloAuction" : "eloOverall";
  const winsKey = filter === "rps" ? "winsRps" : filter === "poker" ? "winsPoker" : filter === "auction" ? "winsAuction" : "winsOverall";
  const lossesKey = filter === "rps" ? "lossesRps" : filter === "poker" ? "lossesPoker" : filter === "auction" ? "lossesAuction" : "lossesOverall";

  return raw
    .sort((a, b) => b[eloKey] - a[eloKey])
    .map((e, i) => {
      // Fallback to 0 if undefined (e.g. old cache format); ensures W/L always render
      const wins = e[winsKey] ?? 0;
      const losses = e[lossesKey] ?? 0;
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      return {
        rank: i + 1,
        address: e.address,
        name: e.name,
        elo: e[eloKey],
        wins,
        losses,
        winRate,
        recentChange: 0,
      };
    });
}

// Check if cached entry has v2 format (per-game wins/losses)
function isValidCacheFormat(entries: RawEntry[] | null): entries is RawEntry[] {
  if (!entries?.length) return false;
  const first = entries[0];
  return "winsRps" in first && "winsOverall" in first;
}

// Deduped fetch — one in-flight request at a time, with TTL cache
function getLeaderboard(): Promise<RawEntry[]> {
  const now = Date.now();

  // Return cached data if still fresh and valid format
  if (cachedRaw && isValidCacheFormat(cachedRaw) && now - lastFetchTime < CACHE_TTL) {
    return Promise.resolve(cachedRaw);
  }

  // Invalidate stale-format cache so we refetch
  if (cachedRaw && !isValidCacheFormat(cachedRaw)) cachedRaw = null;

  // Return in-flight promise if already fetching
  if (fetchPromise) return fetchPromise;

  // Start new fetch
  fetchPromise = fetchLeaderboard()
    .then((result) => {
      cachedRaw = result;
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

// Load from localStorage (for instant render on cold load)
function loadFromStorage(): RawEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { entries: RawEntry[] };
    const entries = parsed.entries ?? null;
    // Validate v2 format (must have per-game wins/losses)
    if (!entries?.length || !("winsRps" in (entries[0] ?? {}))) return null;
    return entries;
  } catch {
    return null;
  }
}

function saveToStorage(entries: RawEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, timestamp: Date.now() }));
  } catch {
    // localStorage may be full — non-critical
  }
}

export function useLeaderboard(filter: LeaderboardFilter = ""): LeaderboardResult {
  // Always start with empty/loading so server and client render identically (avoids hydration mismatch)
  const [rawData, setRawData] = useState<RawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Convert to LeaderboardEntry[] sorted by current filter (client-side only)
  const entries = useMemo(
    () => toLeaderboardEntries(rawData, filter),
    [rawData, filter]
  );

  const refresh = useCallback(() => {
    cachedRaw = null;
    lastFetchTime = 0;
    setRefreshTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Show cached/localStorage immediately if available (client-only, after mount)
      const cached = cachedRaw ?? loadFromStorage();
      if (cached && isValidCacheFormat(cached) && cached.length > 0 && !cancelled) {
        setRawData(cached);
        setLoading(false);
      }
      try {
        const raw = await getLeaderboard();
        if (!cancelled) {
          setRawData(raw);
          setLoading(false);
          saveToStorage(raw);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Poll every 60s — invalidate cache so next call refetches
    intervalRef.current = setInterval(() => {
      lastFetchTime = 0;
      load();
    }, CACHE_TTL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshTrigger]);

  return { entries, loading, refresh };
}
