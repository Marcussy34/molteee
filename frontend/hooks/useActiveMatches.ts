import { useState, useEffect, useRef, useCallback } from "react";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { escrowAbi } from "@/lib/abi/Escrow";
import { rpsGameAbi } from "@/lib/abi/RPSGame";
import { pokerGameV2Abi } from "@/lib/abi/PokerGameV2";
import { auctionGameAbi } from "@/lib/abi/AuctionGame";

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
  winner?: string;         // populated for settled matches
  gamePhase?: string;      // e.g. "COMMITTING MOVES", "BETTING ROUND 1"
  gamePhaseRaw?: number;   // raw phase enum value
  isPlaying?: boolean;     // true = game is actively in progress on-chain
}

// ─── Game type detection from contract address ────────────────────────────────

// Map game contract addresses to game types (lowercase for comparison)
const GAME_CONTRACT_MAP: Record<string, "rps" | "poker" | "auction"> = {
  [ADDRESSES.rpsGame.toLowerCase()]: "rps",
  [ADDRESSES.pokerGame.toLowerCase()]: "poker",
  [ADDRESSES.auctionGame.toLowerCase()]: "auction",
};

export function detectGameType(gameContract: string): "rps" | "poker" | "auction" | "unknown" {
  return GAME_CONTRACT_MAP[gameContract.toLowerCase()] || "unknown";
}

export function parseStatus(status: number): MatchStatus {
  switch (status) {
    case 0: return "pending";
    case 1: return "active";
    case 2: return "settled";
    case 3: return "cancelled";
    default: return "pending";
  }
}

// ─── Game ABI / address helpers (reuse pattern from useLiveGameState) ─────────

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

// ─── Phase label maps ─────────────────────────────────────────────────────────

// RPS: 0=Commit, 1=Reveal, 2=Complete (contract enum starts at Commit, no Idle)
const RPS_PHASES: Record<number, string> = {
  0: "COMMITTING MOVES",
  1: "REVEALING",
  2: "COMPLETE",
};

// PokerGameV2: 0=Commit, 1=BettingRound1, 2=BettingRound2, 3=Showdown, 4=Complete
const POKER_PHASES: Record<number, string> = {
  0: "COMMITTING HANDS",
  1: "BETTING ROUND 1",
  2: "BETTING ROUND 2",
  3: "SHOWDOWN",
  4: "SETTLED",
};

// AuctionGame: 0=Commit, 1=Reveal, 2=Complete
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

// Returns true when the game is finished (complete or settled)
function isGameComplete(gameType: string, phase: number, settled: boolean): boolean {
  if (settled) return true;
  switch (gameType) {
    case "rps": return phase === 2;     // Complete (0=Commit, 1=Reveal, 2=Complete)
    case "poker": return phase === 4;   // Complete (0=Commit, 1=Bet1, 2=Bet2, 3=Showdown, 4=Complete)
    case "auction": return phase === 2; // Complete (0=Commit, 1=Reveal, 2=Complete)
    default: return false;
  }
}

// ─── localStorage persistence ────────────────────────────────────────────────
// Persists match data across page navigations and refreshes so the UI renders
// immediately with stale data while fresh data loads in the background.

// Bumped to v3: completed games now move to settled, not live
const STORAGE_KEY = "arena-matches-v3";

// bigint can't be JSON.stringified, so we convert wager to a hex string
interface SerializedMatch extends Omit<OnChainMatch, "wager"> {
  wager: string; // hex string for bigint serialization
}

interface StoragePayload {
  live: SerializedMatch[];
  pending: SerializedMatch[];
  settled: SerializedMatch[];
  timestamp: number;
}

function serializeMatch(m: OnChainMatch): SerializedMatch {
  return { ...m, wager: m.wager.toString() };
}

function deserializeMatch(m: SerializedMatch): OnChainMatch {
  return { ...m, wager: BigInt(m.wager) };
}

// Save current caches to localStorage
function persistToStorage(live: OnChainMatch[], pending: OnChainMatch[], settled: OnChainMatch[]) {
  try {
    const payload: StoragePayload = {
      live: live.map(serializeMatch),
      pending: pending.map(serializeMatch),
      settled: settled.map(serializeMatch),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be full or unavailable — non-critical
  }
}

// Load cached data from localStorage (returns null if nothing cached)
function loadFromStorage(): { live: OnChainMatch[]; pending: OnChainMatch[]; settled: OnChainMatch[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload: StoragePayload = JSON.parse(raw);
    return {
      live: payload.live.map(deserializeMatch),
      pending: payload.pending.map(deserializeMatch),
      settled: payload.settled.map(deserializeMatch),
    };
  } catch {
    return null;
  }
}

// ─── Permanent settled match cache ──────────────────────────────────────────
// Settled matches (escrow status = "settled") are immutable — cache them forever
// so we never re-fetch from chain. Survives page refreshes.
const SETTLED_PERM_KEY = "arena-settled-perm";
const SETTLED_PERM_MAX = 200;

// In-memory mirror of the permanent localStorage cache
let permanentSettledCache = new Map<number, OnChainMatch>(); // matchId → match
let permanentCacheLoaded = false;

function loadPermanentSettled(): Map<number, OnChainMatch> {
  try {
    const raw = localStorage.getItem(SETTLED_PERM_KEY);
    if (!raw) return new Map();
    const entries: SerializedMatch[] = JSON.parse(raw);
    const map = new Map<number, OnChainMatch>();
    for (const s of entries) {
      map.set(s.matchId, deserializeMatch(s));
    }
    return map;
  } catch {
    return new Map();
  }
}

function savePermanentSettled() {
  try {
    const entries = Array.from(permanentSettledCache.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, SETTLED_PERM_MAX);
    localStorage.setItem(SETTLED_PERM_KEY, JSON.stringify(entries.map(serializeMatch)));
  } catch {
    // localStorage may be full — non-critical
  }
}

function addToPermanentCache(match: OnChainMatch) {
  permanentSettledCache.set(match.matchId, match);
  // Batch-save: only write to localStorage if we added something new
  savePermanentSettled();
}

function ensurePermanentCacheLoaded() {
  if (!permanentCacheLoaded) {
    permanentSettledCache = loadPermanentSettled();
    permanentCacheLoaded = true;
  }
}

// ─── Module-level caches ─────────────────────────────────────────────────────
// Start empty — localStorage hydration happens in useEffect to avoid SSR mismatch

let cachedLive: OnChainMatch[] = [];
let cachedPending: OnChainMatch[] = [];
let cachedSettled: OnChainMatch[] = [];
let lastFetchTime = 0;
let hydratedFromStorage = false; // tracks if we've loaded localStorage yet

// Game discovery caches (persistent across polls — never need to re-discover)
const gameIdByMatch = new Map<number, number>();      // matchId → gameId
const settledGameMatches = new Set<number>();          // matchIds with complete games (skip re-poll)

const CACHE_TTL_MS = 3_000;          // Don't re-fetch escrow data if <3s old
const ESCROW_POLL_MS = 6_000;        // Tier 1: escrow scan every 6s
const LIVENESS_POLL_MS = 2_000;      // Tier 2: game liveness check every 2s
const SCAN_WINDOW = 30;              // How many recent matches to scan
const PENDING_MAX_AGE_S = 3600;      // Hide pending challenges older than 1 hour

// ─── Game ID discovery ───────────────────────────────────────────────────────
// Scans backward from nextGameId to find the game belonging to a match.

async function discoverGameId(
  matchId: number,
  gameType: string,
): Promise<number | null> {
  // Check cache first
  if (gameIdByMatch.has(matchId)) {
    return gameIdByMatch.get(matchId)!;
  }

  const address = getGameAddress(gameType);
  const abi = getGameAbi(gameType);

  try {
    const nextId = await publicClient.readContract({
      address,
      abi,
      functionName: "nextGameId",
    }) as bigint;

    const total = Number(nextId);
    const scanLimit = Math.min(total, 20);

    // Scan backward — most recent games are more likely to match
    for (let i = total - 1; i >= total - scanLimit && i >= 0; i--) {
      try {
        const game = await publicClient.readContract({
          address,
          abi,
          functionName: "getGame",
          args: [BigInt(i)],
        }) as any;

        if (Number(game.escrowMatchId) === matchId) {
          gameIdByMatch.set(matchId, i);
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

export function useActiveMatches(filter: GameFilter = "all") {
  const [liveMatches, setLiveMatches] = useState<OnChainMatch[]>(cachedLive);
  const [pendingChallenges, setPendingChallenges] = useState<OnChainMatch[]>(cachedPending);
  const [recentSettled, setRecentSettled] = useState<OnChainMatch[]>(cachedSettled);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const livenessRef = useRef(false);

  // All discovered matches (before liveness split) — shared between tiers
  const allMatchesRef = useRef<OnChainMatch[]>([]);

  // ─── Hydrate from localStorage on mount (client-only, avoids SSR mismatch) ──
  useEffect(() => {
    if (hydratedFromStorage) return;
    hydratedFromStorage = true;

    // Load permanent settled cache first
    ensurePermanentCacheLoaded();

    const stored = loadFromStorage();
    if (stored && (stored.live.length + stored.pending.length + stored.settled.length) > 0) {
      cachedLive = stored.live;
      cachedPending = stored.pending;
      cachedSettled = stored.settled;
      setLiveMatches(stored.live);
      setPendingChallenges(stored.pending);
      setRecentSettled(stored.settled);
      setLoading(false);
    } else if (permanentSettledCache.size > 0) {
      // Even with no ephemeral cache, show permanently cached settled matches
      const settled = Array.from(permanentSettledCache.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 15);
      cachedSettled = settled;
      setRecentSettled(settled);
      setLoading(false);
    }
  }, []);

  // ─── Tier 1: Escrow scan (every 15s) ─────────────────────────────────────
  // Discovers new/changed matches from the Escrow contract
  const fetchMatches = useCallback(async () => {
    if (fetchingRef.current) return;

    // Skip if cache is fresh
    const now = Date.now();
    if (now - lastFetchTime < CACHE_TTL_MS && (cachedLive.length + cachedSettled.length + cachedPending.length) > 0) {
      setLiveMatches(cachedLive);
      setPendingChallenges(cachedPending);
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
        cachedPending = [];
        cachedSettled = [];
        lastFetchTime = Date.now();
        setLiveMatches([]);
        setPendingChallenges([]);
        setRecentSettled([]);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // Load permanent cache so we can skip RPC calls for settled matches
      ensurePermanentCacheLoaded();

      // Scan the last SCAN_WINDOW matches
      const startId = Math.max(0, total - SCAN_WINDOW);
      const matchPromises: Promise<OnChainMatch | null>[] = [];

      for (let id = startId; id < total; id++) {
        matchPromises.push(
          (async () => {
            // Skip RPC if match is permanently cached (settled = immutable)
            const cached = permanentSettledCache.get(id);
            if (cached) return cached;

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

              // Get winner for settled matches, then cache permanently
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
                // Permanently cache — this match will never need RPC again
                addToPermanentCache(match);
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

      // Store all matches for the liveness checker to use
      allMatchesRef.current = matches;

      // Split into categories — liveness will refine "active" matches later
      // Filter out stale pending challenges (older than PENDING_MAX_AGE_S)
      const nowSecs = Math.floor(Date.now() / 1000);
      const pending = matches
        .filter((m) => m.status === "pending" && (nowSecs - m.createdAt) < PENDING_MAX_AGE_S)
        .sort((a, b) => b.createdAt - a.createdAt);

      // Settled from scan + older entries from permanent cache (beyond scan window)
      const scanSettledIds = new Set(matches.filter((m) => m.status === "settled").map((m) => m.matchId));
      const olderSettled = Array.from(permanentSettledCache.values())
        .filter((m) => !scanSettledIds.has(m.matchId));
      const settled = [
        ...matches.filter((m) => m.status === "settled"),
        ...olderSettled,
      ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 15);

      // For active matches, preserve existing isPlaying from previous liveness check
      const active = matches.filter((m) => m.status === "active");
      const prevLiveById = new Map(cachedLive.map((m) => [m.matchId, m]));
      for (const m of active) {
        const prev = prevLiveById.get(m.matchId);
        if (prev) {
          m.isPlaying = prev.isPlaying;
          m.gamePhase = prev.gamePhase;
          m.gamePhaseRaw = prev.gamePhaseRaw;
        }
      }

      // Live = ONLY active matches confirmed as playing by liveness check
      // Unchecked (undefined) and completed (false) do NOT appear in live
      const live = active
        .filter((m) => m.isPlaying === true)
        .sort((a, b) => b.createdAt - a.createdAt);

      // Not-live = completed games OR not-yet-checked matches
      const notLive = active
        .filter((m) => m.isPlaying !== true)
        .sort((a, b) => b.createdAt - a.createdAt);

      // Merge not-live active matches into settled list
      const allSettled = [...notLive, ...settled].sort((a, b) => b.createdAt - a.createdAt).slice(0, 15);

      // Update caches + persist to localStorage for instant load on next visit
      cachedLive = live;
      cachedPending = pending;
      cachedSettled = allSettled;
      lastFetchTime = Date.now();
      persistToStorage(live, pending, settled);

      setLiveMatches(live);
      setPendingChallenges(pending);
      setRecentSettled(allSettled);
    } catch (err) {
      console.error("[useActiveMatches] fetch error:", err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // ─── Tier 2: Game liveness check (every 5s) ──────────────────────────────
  // For each "active" escrow match, check if a game is actually in progress
  const checkLiveness = useCallback(async () => {
    if (livenessRef.current) return;
    livenessRef.current = true;

    try {
      const allMatches = allMatchesRef.current;
      const activeMatches = allMatches.filter((m) => m.status === "active" && m.gameType !== "unknown");

      if (activeMatches.length === 0) {
        livenessRef.current = false;
        return;
      }

      let changed = false;

      for (const match of activeMatches) {
        // Skip matches we already know are settled/complete — 0 RPC calls
        if (settledGameMatches.has(match.matchId)) {
          if (match.isPlaying !== false) {
            match.isPlaying = false;
            match.gamePhase = "COMPLETE";
            changed = true;
          }
          continue;
        }

        try {
          // Find gameId (from cache or discover on chain)
          const gameId = await discoverGameId(match.matchId, match.gameType);

          if (gameId === null) {
            // No game created yet — not truly live
            if (match.isPlaying !== false) {
              match.isPlaying = false;
              match.gamePhase = undefined;
              changed = true;
            }
            continue;
          }

          // Read game state — 1 RPC call per active match
          const address = getGameAddress(match.gameType);
          const abi = getGameAbi(match.gameType);
          const game = await publicClient.readContract({
            address,
            abi,
            functionName: "getGame",
            args: [BigInt(gameId)],
          }) as any;

          const phase = Number(game.phase);
          const settled = Boolean(game.settled);
          const phaseDeadline = Number(game.phaseDeadline);
          const complete = isGameComplete(match.gameType, phase, settled);
          const nowSecs = Math.floor(Date.now() / 1000);

          // Check if the game is stale:
          // phaseDeadline passed = players abandoned, nobody moved in time
          // NOTE: phase 0 is Commit (not Idle) — all contracts start at Commit
          const isStale = phaseDeadline > 0 && phaseDeadline < nowSecs;

          if (complete || isStale) {
            // Game is done or abandoned — cache permanently so we never re-poll
            settledGameMatches.add(match.matchId);
            if (match.isPlaying !== false) {
              match.isPlaying = false;
              match.gamePhase = complete ? "COMPLETE" : "EXPIRED";
              match.gamePhaseRaw = phase;
              changed = true;
            }
          } else {
            // Game is actively in progress
            const phaseLabel = getPhaseLabel(match.gameType, phase);
            if (match.isPlaying !== true || match.gamePhaseRaw !== phase) {
              match.isPlaying = true;
              match.gamePhase = phaseLabel;
              match.gamePhaseRaw = phase;
              changed = true;
            }
          }
        } catch (err) {
          console.error(`[checkLiveness] match ${match.matchId}:`, err);
          // On error, don't change isPlaying — keep last known state
        }
      }

      // Rebuild live/pending/settled arrays if anything changed
      if (changed) {
        const rebuildNow = Math.floor(Date.now() / 1000);

        // Live = ONLY active matches confirmed as playing
        const live = allMatches
          .filter((m) => m.status === "active" && m.isPlaying === true)
          .sort((a, b) => b.createdAt - a.createdAt);

        // Not-live = active matches that are completed, stale, or unchecked
        const notLive = allMatches
          .filter((m) => m.status === "active" && m.isPlaying !== true)
          .sort((a, b) => b.createdAt - a.createdAt);

        const pending = allMatches
          .filter((m) => m.status === "pending" && (rebuildNow - m.createdAt) < PENDING_MAX_AGE_S)
          .sort((a, b) => b.createdAt - a.createdAt);

        const escrowSettled = allMatches
          .filter((m) => m.status === "settled")
          .sort((a, b) => b.createdAt - a.createdAt);

        // Merge not-live into settled — completed/unchecked games show in RECENT RESULTS
        const settled = [...notLive, ...escrowSettled].sort((a, b) => b.createdAt - a.createdAt).slice(0, 15);

        cachedLive = live;
        cachedPending = pending;
        cachedSettled = settled;
        persistToStorage(live, pending, settled);

        setLiveMatches(live);
        setPendingChallenges(pending);
        setRecentSettled(settled);
      }
    } catch (err) {
      console.error("[checkLiveness] error:", err);
    } finally {
      livenessRef.current = false;
    }
  }, []);

  // ─── Polling setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Initial fetch
    fetchMatches();

    // Tier 1: Escrow scan every 15s
    const escrowInterval = setInterval(fetchMatches, ESCROW_POLL_MS);

    // Tier 2: Game liveness check every 5s (starts after initial escrow data arrives)
    const livenessInterval = setInterval(checkLiveness, LIVENESS_POLL_MS);

    return () => {
      clearInterval(escrowInterval);
      clearInterval(livenessInterval);
    };
  }, [fetchMatches, checkLiveness]);

  // Run liveness check whenever escrow data updates (to quickly classify new matches)
  useEffect(() => {
    if (allMatchesRef.current.length > 0) {
      checkLiveness();
    }
  }, [liveMatches, checkLiveness]);

  // ─── Apply game type filter ─────────────────────────────────────────────────
  const filteredLive = filter === "all"
    ? liveMatches
    : liveMatches.filter((m) => m.gameType === filter);

  const filteredPending = filter === "all"
    ? pendingChallenges
    : pendingChallenges.filter((m) => m.gameType === filter);

  const filteredSettled = filter === "all"
    ? recentSettled
    : recentSettled.filter((m) => m.gameType === filter);

  return {
    liveMatches: filteredLive,
    pendingChallenges: filteredPending,
    recentSettled: filteredSettled,
    loading,
  };
}
