/**
 * useTournaments — Fetches tournament list from TournamentV2 contract.
 *
 * Caching strategy (mirrors useMarkets / useLeaderboard):
 * - Module-level cache with 30s TTL: no RPC if data is fresh
 * - localStorage: show last known data on cold load, fetch in background
 * - Permanent cache for complete/cancelled tournaments (immutable on-chain)
 * - Deduped fetch: only one in-flight request at a time
 * - Incremental fetch: only new tournament IDs + re-check non-terminal ones
 * - Poll every 30s for updates
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { tournamentV2Abi } from "@/lib/abi/TournamentV2";

// ─── Enums ──────────────────────────────────────────────────────────────────

// Tournament status (matches TournamentV2.sol)
export enum TournamentStatus {
  Registration = 0,
  Active = 1,
  Complete = 2,
  Cancelled = 3,
}

// Tournament format (matches arena-tools: round-robin, double-elim)
export enum TournamentFormat {
  RoundRobin = 0,
  DoubleElimination = 1,
}

export interface TournamentData {
  id: number;
  format?: number;
  entryFee: string;
  baseWager: string;
  maxPlayers: number;
  playerCount: number;
  prizePool: string;
  status: number;
  creator: string;
  winner: string;
  participants: string[];
}

export interface TournamentsResult {
  tournaments: TournamentData[];
  loading: boolean;
  refresh: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "tournaments-list-v1";
const PERM_CACHE_KEY = "tournaments-settled-v1";
const CACHE_TTL = 30_000;  // 30s module-level TTL
const POLL_MS = 30_000;    // 30s poll interval

// ─── Module-level cache ─────────────────────────────────────────────────────

let cachedTournaments: TournamentData[] | null = null;
let fetchPromise: Promise<TournamentData[]> | null = null;
let lastFetchTime = 0;

// Permanent cache: complete/cancelled tournaments never change on-chain
let permCache: Map<number, TournamentData> = new Map();
let permCacheLoaded = false;

// ─── localStorage helpers ───────────────────────────────────────────────────

/** Load permanent cache (complete/cancelled tournaments) from localStorage */
function loadPermCacheFromStorage(): void {
  if (typeof window === "undefined" || permCacheLoaded) return;
  permCacheLoaded = true;
  try {
    const raw = localStorage.getItem(PERM_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as TournamentData[];
    for (const t of parsed) {
      if (t.status === TournamentStatus.Complete || t.status === TournamentStatus.Cancelled) {
        permCache.set(t.id, t);
      }
    }
  } catch {
    // Non-critical
  }
}

/** Save permanent cache to localStorage */
function savePermCacheToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERM_CACHE_KEY, JSON.stringify(Array.from(permCache.values())));
  } catch {
    // localStorage may be full — non-critical
  }
}

/** Load all tournaments from localStorage for instant cold-load render */
function loadFromStorage(): TournamentData[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tournaments: TournamentData[] };
    if (!parsed.tournaments?.length) return null;
    return parsed.tournaments;
  } catch {
    return null;
  }
}

/** Save all tournaments to localStorage */
function saveToStorage(tournaments: TournamentData[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tournaments, timestamp: Date.now() }));
  } catch {
    // Non-critical
  }
}

// ─── Core fetch logic ───────────────────────────────────────────────────────

/** Fetch a single tournament's data + participants (2 RPC calls) */
async function fetchOneTournament(id: number): Promise<TournamentData | null> {
  try {
    const [info, participants] = await Promise.all([
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "getTournament",
        args: [BigInt(id)],
      }),
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "getParticipants",
        args: [BigInt(id)],
      }),
    ]);

    const t = info as {
      format: number;
      entryFee: bigint;
      baseWager: bigint;
      maxPlayers: bigint;
      playerCount: bigint;
      prizePool: bigint;
      status: number;
      creator: string;
      winner: string;
    };

    return {
      id,
      format: Number(t.format),
      entryFee: formatEther(t.entryFee),
      baseWager: formatEther(t.baseWager),
      maxPlayers: Number(t.maxPlayers),
      playerCount: Number(t.playerCount),
      prizePool: formatEther(t.prizePool),
      status: Number(t.status),
      creator: t.creator,
      winner: t.winner,
      participants: participants as string[],
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all tournaments from chain.
 *
 * Incremental approach:
 * - Permanently cached (complete/cancelled) tournaments are never re-fetched
 * - Only new IDs + non-terminal tournaments are fetched from chain
 */
async function fetchAllTournaments(): Promise<TournamentData[]> {
  // Load permanent cache from localStorage on first call
  loadPermCacheFromStorage();

  // Get total tournament count
  const nextId = await publicClient.readContract({
    address: ADDRESSES.tournamentV2,
    abi: tournamentV2Abi,
    functionName: "nextTournamentId",
  });
  const count = Number(nextId);
  if (count <= 1) return [];

  const tournaments: TournamentData[] = [];
  const toFetch: number[] = [];

  // Split: permanently cached vs needs fetching
  for (let i = 1; i < count; i++) {
    const cached = permCache.get(i);
    if (cached) {
      tournaments.push(cached);
    } else {
      toFetch.push(i);
    }
  }

  // Fetch uncached tournaments in parallel (2 RPC calls each)
  if (toFetch.length > 0) {
    const results = await Promise.all(toFetch.map((id) => fetchOneTournament(id)));

    for (const t of results) {
      if (!t) continue;
      tournaments.push(t);

      // Permanently cache complete/cancelled tournaments (they don't change)
      if (t.status === TournamentStatus.Complete || t.status === TournamentStatus.Cancelled) {
        permCache.set(t.id, t);
      }
    }

    // Save updated permanent cache
    savePermCacheToStorage();
  }

  // Sort by ID descending (newest first)
  tournaments.sort((a, b) => b.id - a.id);
  return tournaments;
}

/** Deduped fetch — one in-flight request at a time, with TTL cache */
function getTournaments(): Promise<TournamentData[]> {
  const now = Date.now();
  if (cachedTournaments && now - lastFetchTime < CACHE_TTL) {
    return Promise.resolve(cachedTournaments);
  }
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetchAllTournaments()
    .then((result) => {
      cachedTournaments = result;
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

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTournaments(): TournamentsResult {
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual refresh — invalidates TTL cache (but keeps permanent cache)
  const refresh = useCallback(() => {
    cachedTournaments = null;
    lastFetchTime = 0;
    setRefreshTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Instant render from cache: module-level > localStorage > permanent cache only
      if (!cachedTournaments) {
        const stored = loadFromStorage();
        if (stored && stored.length > 0 && !cancelled) {
          setTournaments(stored);
          setLoading(false);
        } else {
          // No full cache — show permanent cache while fetching
          loadPermCacheFromStorage();
          if (permCache.size > 0 && !cancelled) {
            const sorted = Array.from(permCache.values()).sort((a, b) => b.id - a.id);
            setTournaments(sorted);
            setLoading(false);
          }
        }
      }

      // Background fetch from chain
      try {
        const fresh = await getTournaments();
        if (!cancelled) {
          setTournaments(fresh);
          setLoading(false);
          saveToStorage(fresh);
        }
      } catch (err) {
        console.error("Failed to fetch tournaments:", err);
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Poll — invalidate TTL cache before each poll
    intervalRef.current = setInterval(() => {
      lastFetchTime = 0;
      load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshTrigger]);

  return { tournaments, loading, refresh };
}
