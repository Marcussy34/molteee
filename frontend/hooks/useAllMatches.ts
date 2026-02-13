/**
 * useAllMatches — Loads ALL Escrow matches with incremental localStorage caching.
 *
 * Unlike useActiveMatches (which scans the last 30 matches for the arena page),
 * this hook fetches every match ever created for the Match History page.
 *
 * Includes on-chain proof data:
 * - player1Elo / player2Elo: Current ELO from AgentRegistry
 *
 * Caching strategy:
 * 1. On mount, load cached data from localStorage → render instantly
 * 2. Fetch current nextMatchId from Escrow
 * 3. Only fetch NEW matches (above cached nextMatchId) + re-check non-settled ones
 * 4. Settled matches with winners are cached permanently (never re-fetched)
 * 5. ELO fetched once per component mount
 * 6. Poll every 30s for new matches only
 *
 * IMPORTANT: Fetch is split into sequential phases to avoid viem's 10s default
 * timeout killing requests queued behind the rate limiter. Phase 1 fetches all
 * getMatch data, Phase 2 fetches winners, Phase 3 fetches ELO.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { escrowAbi } from "@/lib/abi/Escrow";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";
import type { OnChainMatch } from "./useActiveMatches";
import { parseStatus, detectGameType } from "./useActiveMatches";

// ─── Extended match type with proof data ────────────────────────────────────

export interface MatchWithProof extends OnChainMatch {
  player1Elo?: number;  // Current ELO rating for player 1 (per game type)
  player2Elo?: number;  // Current ELO rating for player 2 (per game type)
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "all-matches-v3"; // bumped to invalidate stale DRAW cache
const POLL_MS = 30_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert game type string to uint8 enum for AgentRegistry.elo() */
function gameTypeToUint8(gt: string): number {
  switch (gt) {
    case "rps": return 0;
    case "poker": return 1;
    case "auction": return 2;
    default: return 0;
  }
}

// ─── localStorage serialization ─────────────────────────────────────────────
// bigint can't be JSON.stringified, so we convert wager to a string.

interface SerializedMatch extends Omit<MatchWithProof, "wager"> {
  wager: string;
}

interface CachePayload {
  matches: SerializedMatch[];
  nextMatchId: number;
  timestamp: number;
}

function serialize(m: MatchWithProof): SerializedMatch {
  return { ...m, wager: m.wager.toString() };
}

function deserialize(m: SerializedMatch): MatchWithProof {
  return { ...m, wager: BigInt(m.wager) };
}

function loadCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(matches: MatchWithProof[], nextMatchId: number) {
  try {
    const payload: CachePayload = {
      matches: matches.map(serialize),
      nextMatchId,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be full or unavailable — non-critical
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface AllMatchesResult {
  matches: MatchWithProof[];
  loading: boolean;
}

export function useAllMatches(): AllMatchesResult {
  const [matches, setMatches] = useState<MatchWithProof[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  // In-memory cache: matchId → MatchWithProof (survives across polls)
  const cacheMapRef = useRef<Map<number, MatchWithProof>>(new Map());
  const cachedNextMatchIdRef = useRef(0);

  // Track whether ELO has been fetched this mount
  const hasFetchedEloRef = useRef(false);

  // ─── Hydrate from localStorage on mount (client-only, avoids SSR mismatch) ──
  useEffect(() => {
    const stored = loadCache();
    if (stored && stored.matches.length > 0) {
      const hydrated = stored.matches.map(deserialize);
      for (const m of hydrated) {
        cacheMapRef.current.set(m.matchId, m);
      }
      cachedNextMatchIdRef.current = stored.nextMatchId;
      // Show cached data immediately (sorted newest first)
      setMatches(hydrated.sort((a, b) => b.matchId - a.matchId));
      setLoading(false);
    }
  }, []);

  // ─── Fetch ELO ratings for all unique players ────────────────────────────
  const eloMapRef = useRef<Map<string, number>>(new Map());

  const fetchEloRatings = useCallback(async (matchList: MatchWithProof[]) => {
    // Collect unique (address, gameType) pairs
    const pairs = new Set<string>();
    for (const m of matchList) {
      if (m.gameType === "unknown") continue;
      const gt = gameTypeToUint8(m.gameType);
      pairs.add(`${m.player1.toLowerCase()}-${gt}`);
      if (m.player2 && m.player2 !== ZERO_ADDRESS) {
        pairs.add(`${m.player2.toLowerCase()}-${gt}`);
      }
    }

    // Only fetch pairs we haven't fetched yet
    const toFetch = Array.from(pairs).filter((k) => !eloMapRef.current.has(k));
    if (toFetch.length === 0) return;

    // Fetch ELO for each unique player-gameType pair in parallel
    const promises = toFetch.map(async (key) => {
      const dashIdx = key.lastIndexOf("-");
      const addr = key.slice(0, dashIdx);
      const gt = parseInt(key.slice(dashIdx + 1));
      try {
        const elo = (await publicClient.readContract({
          address: ADDRESSES.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "elo",
          args: [addr as `0x${string}`, gt],
        })) as bigint;
        eloMapRef.current.set(key, Number(elo));
      } catch {
        // ELO lookup is best-effort — player may not be registered
      }
    });

    await Promise.all(promises);
  }, []);

  // ─── Enrich matches with ELO data ────────────────────────────────────────
  const enrichWithElo = useCallback((matchList: MatchWithProof[]) => {
    for (const m of matchList) {
      if (m.gameType !== "unknown") {
        const gt = gameTypeToUint8(m.gameType);
        const p1Elo = eloMapRef.current.get(`${m.player1.toLowerCase()}-${gt}`);
        const p2Elo = eloMapRef.current.get(`${m.player2.toLowerCase()}-${gt}`);
        if (p1Elo !== undefined) m.player1Elo = p1Elo;
        if (p2Elo !== undefined) m.player2Elo = p2Elo;
      }
    }
  }, []);

  // ─── Main fetch function ────────────────────────────────────────────────────
  // Split into sequential phases to avoid viem timeout killing queued requests.
  // The rate limiter serializes ALL RPC calls at 200ms intervals. With 35 matches
  // in one Promise.all, the last call starts at 35×200ms = 7s. If winners calls
  // are in the same batch, they start at 55×200ms = 11s, exceeding viem's 10s
  // default timeout → silent abort. Fix: run getMatch and winners as separate batches.
  const fetchMatches = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Get total match count from Escrow
      const nextMatchId = Number(
        (await publicClient.readContract({
          address: ADDRESSES.escrow,
          abi: escrowAbi,
          functionName: "nextMatchId",
        })) as bigint
      );

      if (nextMatchId === 0) {
        setMatches([]);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      const cache = cacheMapRef.current;
      const prevNextMatchId = cachedNextMatchIdRef.current;

      // Determine which match IDs need fetching:
      // 1. New matches since last fetch (prevNextMatchId .. nextMatchId-1)
      // 2. Non-settled cached matches (may have changed status)
      const idsToFetch = new Set<number>();

      for (let id = prevNextMatchId; id < nextMatchId; id++) {
        if (!cache.has(id)) idsToFetch.add(id);
      }

      for (const [id, m] of cache) {
        if (m.status !== "settled" && m.status !== "cancelled") {
          idsToFetch.add(id);
        }
      }

      // ── Phase 1: Fetch match data (getMatch only) ──────────────────────────
      // Each call gets its own timeout window, keeps batch within 10s limit
      const matchResults = await Promise.all(
        Array.from(idsToFetch).map(async (id) => {
          try {
            const data = (await publicClient.readContract({
              address: ADDRESSES.escrow,
              abi: escrowAbi,
              functionName: "getMatch",
              args: [BigInt(id)],
            })) as any;

            const status = parseStatus(Number(data.status));
            const match: MatchWithProof = {
              matchId: id,
              player1: data.player1,
              player2: data.player2,
              wager: data.wager,
              gameContract: data.gameContract,
              status,
              createdAt: Number(data.createdAt),
              gameType: detectGameType(data.gameContract),
            };

            return match;
          } catch {
            return null;
          }
        })
      );

      // Update cache with Phase 1 results
      for (const m of matchResults) {
        if (m) cache.set(m.matchId, m);
      }

      // ── Phase 2: Fetch winners for settled matches (separate batch) ────────
      // Runs AFTER Phase 1 completes so these calls don't queue behind 35 getMatch calls.
      // With ~20 settled matches, the last call starts at 20×200ms = 4s — well within timeout.
      const settledWithoutWinner = Array.from(cache.values()).filter(
        (m) => m.status === "settled" && !m.winner
      );

      if (settledWithoutWinner.length > 0) {
        const winnerResults = await Promise.all(
          settledWithoutWinner.map(async (match) => {
            try {
              const winner = (await publicClient.readContract({
                address: ADDRESSES.escrow,
                abi: escrowAbi,
                functionName: "winners",
                args: [BigInt(match.matchId)],
              })) as string;
              return { matchId: match.matchId, winner };
            } catch {
              return { matchId: match.matchId, winner: null };
            }
          })
        );

        // Apply winners to cached matches
        for (const { matchId, winner } of winnerResults) {
          const m = cache.get(matchId);
          if (m && winner && winner !== ZERO_ADDRESS) {
            m.winner = winner;
          }
        }
      }

      // Update the high-water mark
      cachedNextMatchIdRef.current = nextMatchId;

      // ── Phase 3: Fetch ELO ratings (once per mount) ────────────────────────
      if (!hasFetchedEloRef.current) {
        hasFetchedEloRef.current = true;
        const allMatchList = Array.from(cache.values());
        await fetchEloRatings(allMatchList);
      }

      // Enrich all matches with ELO data
      const allMatches = Array.from(cache.values());
      enrichWithElo(allMatches);
      allMatches.sort((a, b) => b.matchId - a.matchId);

      // Persist to localStorage for instant load on next visit
      saveCache(allMatches, nextMatchId);

      setMatches(allMatches);
    } catch (err) {
      console.error("[useAllMatches] fetch error:", err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchEloRatings, enrichWithElo]);

  // ─── Polling setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { matches, loading };
}
