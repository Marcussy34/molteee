/**
 * useMarkets — Fetches prediction market data from PredictionMarket contract.
 *
 * Markets are auto-created per match (marketId = matchId) and auto-resolved
 * when the match settles. Uses constant-product AMM (x*y=k) pricing.
 *
 * Caching strategy (mirrors useLeaderboard / useAllMatches):
 * - Module-level cache with 30s TTL: no RPC if data is fresh
 * - localStorage: show last known data on cold load, fetch in background
 * - Permanent cache for resolved/expired markets (immutable on-chain)
 * - Deduped fetch: only one in-flight request at a time
 * - Poll every 15s for near-real-time price updates
 *
 * Performance optimisation:
 * - Resolved markets (market.resolved=true) skip the escrow call entirely
 *   since we already know their status. Only unresolved markets need the
 *   extra escrow getMatch() to detect expired/cancelled.
 * - Permanently cached markets (resolved + expired) are never re-fetched.
 * - On cold load with no cache, old localStorage keys are migrated.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { predictionMarketAbi } from "@/lib/abi/PredictionMarket";
import { escrowAbi } from "@/lib/abi/Escrow";
import { getAgentName } from "@/lib/agentNames";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Market status derived from on-chain match state */
export type MarketStatus = "live" | "expired" | "resolved";

export interface MarketData {
  id: number;
  matchId: number;
  player1: string;
  player2: string;
  player1Name: string;
  player2Name: string;
  reserveYES: string;      // formatted ETH string
  reserveNO: string;       // formatted ETH string
  seedLiquidity: string;   // formatted ETH string
  totalLiquidity: string;  // reserveYES + reserveNO formatted
  resolved: boolean;
  winner: string;
  winnerName: string;
  yesPrice: number;        // 0-100 percentage
  noPrice: number;         // 0-100 percentage
  /** Derived status: live (match in progress), expired (timed out / cancelled), resolved */
  status: MarketStatus;
}

export type MarketFilter = "all" | "live" | "expired" | "resolved";

export interface MarketsResult {
  markets: MarketData[];
  loading: boolean;
  refresh: () => void;
  stats: {
    total: number;
    live: number;
    expired: number;
    resolved: number;
    totalLiquidity: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "prediction-markets-v3";
const PERM_CACHE_KEY = "prediction-markets-settled-v2";
const CACHE_TTL = 30_000;    // 30s module-level TTL
const POLL_MS = 15_000;      // 15s poll interval
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Escrow match statuses (Solidity enum)
const MATCH_CREATED = 0;
const MATCH_ACTIVE = 1;
const MATCH_SETTLED = 2;
const MATCH_CANCELLED = 3;

// Timeouts matching the matches page
const PENDING_TIMEOUT_S = 3600;   // 1h (Escrow.ACCEPT_TIMEOUT)
const ACTIVE_TIMEOUT_S  = 7200;   // 2h (generous for game deadlines)

// ─── Module-level cache ─────────────────────────────────────────────────────

let cachedMarkets: MarketData[] | null = null;
let fetchPromise: Promise<MarketData[]> | null = null;
let lastFetchTime = 0;

// Permanent cache: resolved + expired markets never change on-chain
let permCache: Map<number, MarketData> = new Map();
let permCacheLoaded = false;

// ─── localStorage helpers ───────────────────────────────────────────────────

/**
 * Load permanent cache from localStorage.
 * Also migrates old cache keys (v1/v2) on first load so we don't re-fetch
 * 40+ resolved markets from scratch.
 */
function loadPermCacheFromStorage(): void {
  if (typeof window === "undefined" || permCacheLoaded) return;
  permCacheLoaded = true;

  try {
    // Try current key first
    const raw = localStorage.getItem(PERM_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MarketData[];
      for (const m of parsed) {
        if (m.status === "resolved" || m.status === "expired") {
          permCache.set(m.id, m);
        }
      }
      if (permCache.size > 0) return; // loaded successfully
    }

    // ─── Migrate from old cache keys ────────────────────────────────────
    // Old v1 permanent cache (resolved markets without `status` field)
    const oldResolved = localStorage.getItem("prediction-markets-resolved-v1");
    if (oldResolved) {
      const parsed = JSON.parse(oldResolved) as unknown[];
      for (const m of parsed) {
        const market = m as unknown as MarketData;
        if (market.resolved) {
          market.status = "resolved";
          permCache.set(market.id, market);
        }
      }
      // Clean up old key
      localStorage.removeItem("prediction-markets-resolved-v1");
    }

    // Old v2 all-markets cache (markets without `status` field)
    const oldAll = localStorage.getItem("prediction-markets-v2");
    if (oldAll) {
      const parsed = JSON.parse(oldAll) as { markets?: unknown[] };
      if (parsed.markets) {
        for (const m of parsed.markets) {
          const market = m as unknown as MarketData;
          // Add resolved markets we haven't seen yet
          if (market.resolved && !permCache.has(market.id)) {
            market.status = "resolved";
            permCache.set(market.id, market);
          }
        }
      }
      // Clean up old key
      localStorage.removeItem("prediction-markets-v2");
    }

    // Save migrated data to new key
    if (permCache.size > 0) savePermCacheToStorage();
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

/** Load all markets from localStorage for instant cold-load render */
function loadFromStorage(): MarketData[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { markets: MarketData[] };
    if (!parsed.markets?.length) return null;
    // Validate v3 format (has status field)
    if (!("status" in parsed.markets[0])) return null;
    return parsed.markets;
  } catch {
    return null;
  }
}

/** Save all markets to localStorage */
function saveToStorage(markets: MarketData[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ markets, timestamp: Date.now() }));
  } catch {
    // Non-critical
  }
}

// ─── Core fetch logic ───────────────────────────────────────────────────────

/** Determine market status from escrow match state (only for unresolved markets) */
function deriveStatusFromEscrow(matchStatus: number, createdAt: number): MarketStatus {
  if (matchStatus === MATCH_CANCELLED) return "expired";
  if (matchStatus === MATCH_SETTLED) return "resolved";

  const now = Math.floor(Date.now() / 1000);
  const age = now - createdAt;
  if (matchStatus === MATCH_CREATED && age > PENDING_TIMEOUT_S) return "expired";
  if (matchStatus === MATCH_ACTIVE && age > ACTIVE_TIMEOUT_S) return "expired";

  return "live";
}

/**
 * Fetch market + price only (2 RPC calls). Used for all markets.
 * Status is set to "resolved" if market.resolved=true, otherwise "live" as placeholder.
 */
async function fetchMarketBase(id: number): Promise<MarketData | null> {
  try {
    const [market, price] = await Promise.all([
      publicClient.readContract({
        address: ADDRESSES.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "getMarket",
        args: [BigInt(id)],
      }),
      publicClient.readContract({
        address: ADDRESSES.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "getPrice",
        args: [BigInt(id)],
      }),
    ]);

    const m = market as {
      matchId: bigint; reserveYES: bigint; reserveNO: bigint;
      seedLiquidity: bigint; player1: string; player2: string;
      resolved: boolean; winner: string;
    };
    const p = price as readonly [bigint, bigint];

    const reserveYES = formatEther(m.reserveYES);
    const reserveNO = formatEther(m.reserveNO);
    const totalLiq = parseFloat(reserveYES) + parseFloat(reserveNO);

    return {
      id,
      matchId: Number(m.matchId),
      player1: m.player1,
      player2: m.player2,
      player1Name: getAgentName(m.player1),
      player2Name: getAgentName(m.player2),
      reserveYES,
      reserveNO,
      seedLiquidity: formatEther(m.seedLiquidity),
      totalLiquidity: totalLiq.toFixed(4),
      resolved: m.resolved,
      winner: m.winner,
      winnerName: m.winner !== ZERO_ADDRESS ? getAgentName(m.winner) : "",
      yesPrice: Number(p[0]) / 1e16,
      noPrice: Number(p[1]) / 1e16,
      // Resolved on-chain → status is certain. Otherwise placeholder until escrow check.
      status: m.resolved ? "resolved" : "live",
    };
  } catch {
    return null;
  }
}

/** Fetch escrow match data for a single market (1 extra RPC call) */
async function enrichWithEscrowStatus(market: MarketData): Promise<MarketData> {
  try {
    const escrowMatch = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: escrowAbi,
      functionName: "getMatch",
      args: [BigInt(market.matchId)],
    });
    const em = escrowMatch as { status: number; createdAt: bigint };
    return { ...market, status: deriveStatusFromEscrow(em.status, Number(em.createdAt)) };
  } catch {
    // If escrow call fails, keep as "live" (conservative)
    return market;
  }
}

/**
 * Fetch all markets from chain.
 *
 * Two-phase approach to minimise RPC calls:
 *   Phase 1: Fetch market+price for all uncached IDs (2 calls each)
 *   Phase 2: For unresolved markets only, fetch escrow status (1 call each)
 *
 * Resolved markets (41/45) skip escrow entirely → saves ~8s on first load.
 */
async function fetchAllMarkets(): Promise<MarketData[]> {
  // Load permanent cache (resolved + expired) from localStorage
  loadPermCacheFromStorage();

  // Get total number of markets
  const nextId = await publicClient.readContract({
    address: ADDRESSES.predictionMarket,
    abi: predictionMarketAbi,
    functionName: "nextMarketId",
  });
  const count = Number(nextId);
  if (count <= 1) return [];

  const markets: MarketData[] = [];
  const toFetch: number[] = [];

  // Split: permanently cached vs needs fetching
  for (let i = 1; i < count; i++) {
    const cached = permCache.get(i);
    if (cached) {
      markets.push(cached);
    } else {
      toFetch.push(i);
    }
  }

  // Phase 1: Fetch market + price for uncached IDs (2 RPC calls each)
  if (toFetch.length > 0) {
    const baseResults = await Promise.all(toFetch.map((id) => fetchMarketBase(id)));
    const fetched: MarketData[] = [];
    for (const m of baseResults) {
      if (m) fetched.push(m);
    }

    // Phase 2: For unresolved markets, fetch escrow to check expired/cancelled
    // Resolved markets already have correct status from Phase 1
    const unresolvedIdx: number[] = [];
    for (let i = 0; i < fetched.length; i++) {
      if (!fetched[i].resolved) unresolvedIdx.push(i);
    }

    if (unresolvedIdx.length > 0) {
      const enriched = await Promise.all(
        unresolvedIdx.map((idx) => enrichWithEscrowStatus(fetched[idx]))
      );
      for (let j = 0; j < unresolvedIdx.length; j++) {
        fetched[unresolvedIdx[j]] = enriched[j];
      }
    }

    // Add to results + permanently cache resolved/expired
    for (const m of fetched) {
      markets.push(m);
      if (m.status === "resolved" || m.status === "expired") {
        permCache.set(m.id, m);
      }
    }
  }

  // Save updated permanent cache
  savePermCacheToStorage();

  // Sort newest first
  markets.sort((a, b) => b.id - a.id);
  return markets;
}

/** Deduped fetch — one in-flight request at a time, with TTL cache */
function getMarkets(): Promise<MarketData[]> {
  const now = Date.now();
  if (cachedMarkets && now - lastFetchTime < CACHE_TTL) {
    return Promise.resolve(cachedMarkets);
  }
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetchAllMarkets()
    .then((result) => {
      cachedMarkets = result;
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

export function useMarkets(filter: MarketFilter = "all"): MarketsResult {
  const [allMarkets, setAllMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Client-side filter (no re-fetch on filter change)
  const markets = useMemo(() => {
    if (filter === "live") return allMarkets.filter((m) => m.status === "live");
    if (filter === "expired") return allMarkets.filter((m) => m.status === "expired");
    if (filter === "resolved") return allMarkets.filter((m) => m.status === "resolved");
    return allMarkets;
  }, [allMarkets, filter]);

  // Compute aggregate stats
  const stats = useMemo(() => {
    const live = allMarkets.filter((m) => m.status === "live").length;
    const expired = allMarkets.filter((m) => m.status === "expired").length;
    const resolved = allMarkets.filter((m) => m.status === "resolved").length;
    const totalLiquidity = allMarkets.reduce(
      (sum, m) => sum + parseFloat(m.totalLiquidity || "0"),
      0
    );
    return { total: allMarkets.length, live, expired, resolved, totalLiquidity };
  }, [allMarkets]);

  // Manual refresh — invalidates all caches (but keeps permanent cache)
  const refresh = useCallback(() => {
    cachedMarkets = null;
    lastFetchTime = 0;
    setRefreshTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // ─── Instant render from cache ──────────────────────────────────────
      // Priority: module-level cache > localStorage > permanent cache only
      // Show whatever we have immediately so the page isn't blank.
      if (!cachedMarkets) {
        const stored = loadFromStorage();
        if (stored && stored.length > 0 && !cancelled) {
          setAllMarkets(stored);
          setLoading(false);
        } else {
          // No full cache — show permanent cache (resolved+expired) while fetching
          loadPermCacheFromStorage();
          if (permCache.size > 0 && !cancelled) {
            const sorted = Array.from(permCache.values()).sort((a, b) => b.id - a.id);
            setAllMarkets(sorted);
            setLoading(false);
          }
        }
      }

      // ─── Background fetch ───────────────────────────────────────────────
      try {
        const fresh = await getMarkets();
        if (!cancelled) {
          setAllMarkets(fresh);
          setLoading(false);
          saveToStorage(fresh);
        }
      } catch (err) {
        console.error("Failed to fetch markets:", err);
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

  return { markets, loading, refresh, stats };
}
