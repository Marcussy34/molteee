/**
 * useAllMatches — Loads ALL Escrow matches with incremental localStorage caching.
 *
 * Unlike useActiveMatches (which scans the last 30 matches for the arena page),
 * this hook fetches every match ever created for the Match History page.
 *
 * Includes on-chain proof data:
 * - txHash: MatchCreated transaction hash (found via timestamp-based block estimation)
 * - player1Elo / player2Elo: Current ELO from AgentRegistry
 *
 * Caching strategy:
 * 1. On mount, load cached data from localStorage → render instantly
 * 2. Fetch current nextMatchId from Escrow
 * 3. Only fetch NEW matches (above cached nextMatchId) + re-check non-settled ones
 * 4. Settled matches with winners + txHash are cached permanently
 * 5. ELO + tx hashes fetched once per component mount
 * 6. Poll every 30s for new matches only
 *
 * IMPORTANT: Fetch is split into sequential phases to avoid viem's 10s default
 * timeout killing requests queued behind the rate limiter.
 *
 * TX hash strategy:
 * Alchemy free tier limits getLogs to 10 blocks — useless for scanning.
 * Instead, we use the Monad public RPC (100-block limit) with a targeted approach:
 * 1. Get latest block (number + timestamp) as a reference point
 * 2. For each match, estimate the block from its createdAt timestamp
 * 3. Scan a 100-block window around that estimate for the MatchCreated event
 * 4. Cache found tx hashes permanently in localStorage
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { publicClient, ADDRESSES, monadTestnet } from "@/lib/contracts";
import { escrowAbi } from "@/lib/abi/Escrow";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";
import type { OnChainMatch } from "./useActiveMatches";
import { parseStatus, detectGameType } from "./useActiveMatches";

// ─── Extended match type with proof data ────────────────────────────────────

export interface MatchWithProof extends OnChainMatch {
  txHash?: string;      // MatchCreated transaction hash — links to block explorer
  player1Elo?: number;  // Current ELO rating for player 1 (per game type)
  player2Elo?: number;  // Current ELO rating for player 2 (per game type)
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "all-matches-v4"; // bumped — invalidates stale DRAW cache + adds txHash
const POLL_MS = 30_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Monad testnet block time: ~0.4s per block = 2.5 blocks/second
const BLOCKS_PER_SECOND = 2.5;

// Separate viem client for the Monad public RPC (supports 100-block getLogs ranges).
// The main publicClient uses Alchemy (10-block getLogs limit on free tier).
// This client is NOT rate-limited by the global Alchemy rate limiter since it's
// a different endpoint. We process calls sequentially with small delays instead.
const logsClient = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz", { retryCount: 1 }),
});

// MatchCreated event definition for getLogs
const MATCH_CREATED_EVENT = {
  type: "event" as const,
  name: "MatchCreated" as const,
  inputs: [
    { name: "matchId", type: "uint256" as const, indexed: true },
    { name: "player1", type: "address" as const, indexed: true },
    { name: "player2", type: "address" as const, indexed: true },
    { name: "wager", type: "uint256" as const, indexed: false },
    { name: "gameContract", type: "address" as const, indexed: false },
  ],
} as const;

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

/** Estimate the block number for a given unix timestamp using a reference block */
function estimateBlock(
  targetTimestamp: number,
  refBlockNumber: bigint,
  refBlockTimestamp: number
): bigint {
  const secondsDiff = refBlockTimestamp - targetTimestamp;
  const blocksDiff = Math.floor(secondsDiff * BLOCKS_PER_SECOND);
  const estimated = refBlockNumber - BigInt(blocksDiff);
  return estimated > BigInt(0) ? estimated : BigInt(0);
}

/** Small async delay to avoid hammering RPCs */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── localStorage serialization ─────────────────────────────────────────────
// bigint can't be JSON.stringified, so we convert wager to a string.
// txHash (string) and ELO (number) serialize fine as-is.

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

  // Track whether proof data has been fetched this mount
  const hasFetchedProofRef = useRef(false);

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

    // Fetch ELO in parallel (separate batch — within timeout window)
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

  // ─── Fetch tx hashes using timestamp-based block estimation ───────────────
  const fetchTxHashes = useCallback(async (matchList: MatchWithProof[]) => {
    // Only look up matches that are missing tx hashes
    const missing = matchList.filter((m) => !m.txHash && m.createdAt > 0);
    if (missing.length === 0) return;

    try {
      // Get latest block as a reference point for timestamp → block estimation
      const latestBlock = await logsClient.getBlock({ blockTag: "latest" });
      const refBlockNumber = latestBlock.number;
      const refBlockTimestamp = Number(latestBlock.timestamp);

      // Process each match SEQUENTIALLY with a small delay to be nice to the public RPC.
      // Uses two-step refinement: raw estimate → fetch actual timestamp → refine → scan.
      // Raw extrapolation from the latest block drifts by 1000+ blocks over long distances,
      // but after refinement the error is typically <10 blocks — well within the ±50 window.
      for (const match of missing) {
        try {
          // Step 1: Raw estimate from latest block (can be 1000+ blocks off)
          const rawEstimate = estimateBlock(match.createdAt, refBlockNumber, refBlockTimestamp);

          // Step 2: Get actual timestamp at the estimated block to measure the error
          const estBlockData = await logsClient.getBlock({ blockNumber: rawEstimate });
          const actualTs = Number(estBlockData.timestamp);

          // Step 3: Refine using the actual timestamp (residual is typically <10 blocks)
          const residualSeconds = match.createdAt - actualTs;
          const refinedBlock = rawEstimate + BigInt(Math.round(residualSeconds * BLOCKS_PER_SECOND));

          // Step 4: Scan 100-block window around the refined estimate
          const fromBlock = refinedBlock - BigInt(49);
          const toBlock = refinedBlock + BigInt(49);

          const logs = await logsClient.getLogs({
            address: ADDRESSES.escrow,
            event: MATCH_CREATED_EVENT,
            fromBlock: fromBlock > BigInt(0) ? fromBlock : BigInt(0),
            toBlock,
          });

          // Find the log matching our specific matchId
          for (const log of logs) {
            if (log.args.matchId !== undefined && Number(log.args.matchId) === match.matchId) {
              match.txHash = log.transactionHash;
              break;
            }
          }
        } catch {
          // getLogs or getBlock failed for this match — skip, we'll try again next visit
        }

        // Small delay between calls to avoid hammering the public RPC
        await delay(150);
      }
    } catch (err) {
      console.warn("[useAllMatches] tx hash fetch failed:", err);
    }
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

      // Determine which match IDs need fetching
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

        for (const { matchId, winner } of winnerResults) {
          const m = cache.get(matchId);
          if (m && winner && winner !== ZERO_ADDRESS) {
            m.winner = winner;
          }
        }
      }

      cachedNextMatchIdRef.current = nextMatchId;

      // ── Phase 3: Fetch ELO ratings (once per mount) ────────────────────────
      if (!hasFetchedProofRef.current) {
        const allMatchList = Array.from(cache.values());
        await fetchEloRatings(allMatchList);
      }

      // ── Phase 4: Fetch tx hashes (once per mount) ──────────────────────────
      // Uses Monad public RPC with timestamp-based block estimation
      if (!hasFetchedProofRef.current) {
        hasFetchedProofRef.current = true;
        const allMatchList = Array.from(cache.values());
        await fetchTxHashes(allMatchList);
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
  }, [fetchEloRatings, fetchTxHashes, enrichWithElo]);

  // ─── Polling setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { matches, loading };
}
