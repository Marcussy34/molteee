import { useState, useEffect, useRef, useCallback } from "react";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { escrowAbi } from "@/lib/abi/Escrow";
import { rpsGameAbi } from "@/lib/abi/RPSGame";
import { pokerGameV2Abi } from "@/lib/abi/PokerGameV2";
import { auctionGameAbi } from "@/lib/abi/AuctionGame";
import { discoverGameId, getGameAbi, getGameAddress } from "@/lib/gameDiscovery";

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

// ─── Game ABI / address helpers ──────────────────────────────────────────────
// Imported from @/lib/gameDiscovery (shared with useLiveGameState)

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

// Bumped to v4: clear stale cache after pokerGame address changed from V1 to V2
const STORAGE_KEY = "arena-matches-v4";

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
// Bumped to v2: invalidate after contract address changes (V1→V2)
const SETTLED_PERM_KEY = "arena-settled-perm-v2";
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
      // Validate: skip entries whose gameContract no longer maps to a known type
      // (e.g., old PokerV1 matches cached before the address changed to V2)
      const currentType = detectGameType(s.gameContract);
      if (currentType === "unknown") continue;
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

// Game discovery cache — now shared via @/lib/gameDiscovery (discoverGameId)
const settledGameMatches = new Set<number>();          // matchIds with complete games (skip re-poll)

// ─── Persist settled game match IDs in localStorage ──────────────────────────
// Prevents the grace period from restarting on page refresh — once a game is
// detected as complete/expired, we remember it across page loads.
// Bumped to v2: invalidate after contract address changes
const SETTLED_GAMES_KEY = "arena-stale-matches-v2";
const SETTLED_GAMES_MAX = 200;

function loadSettledGameMatches(): void {
  try {
    const raw = localStorage.getItem(SETTLED_GAMES_KEY);
    if (!raw) return;
    const ids: number[] = JSON.parse(raw);
    for (const id of ids) settledGameMatches.add(id);
  } catch {
    // localStorage may be unavailable — non-critical
  }
}

function saveSettledGameMatches(): void {
  try {
    const ids = Array.from(settledGameMatches).slice(-SETTLED_GAMES_MAX);
    localStorage.setItem(SETTLED_GAMES_KEY, JSON.stringify(ids));
  } catch {
    // localStorage may be full — non-critical
  }
}

let settledGameMatchesLoaded = false;

function ensureSettledGameMatchesLoaded(): void {
  if (!settledGameMatchesLoaded) {
    loadSettledGameMatches();
    settledGameMatchesLoaded = true;
  }
}

// ─── Settlement grace period ──────────────────────────────────────────────────
// When a game completes/settles, keep it in LIVE MATCHES for a grace period so
// the battle director can play the full cinematic (clash → round_result → victory).
// Without this, the match instantly moves to RECENT RESULTS and the 3D scene unmounts.
const SETTLEMENT_GRACE_MS = 15_000; // 15 seconds — enough for clash(1.8s)+result(3.2s)+victory(5s)
const settlementGraceMap = new Map<number, number>(); // matchId → Date.now() when settlement first detected

const CACHE_TTL_MS = 3_000;          // Don't re-fetch escrow data if <3s old
const ESCROW_POLL_MS = 6_000;        // Tier 1: escrow scan every 6s
const LIVENESS_POLL_MS = 2_000;      // Tier 2: game liveness check every 2s
const MULTICALL_BATCH = 50;          // Batch size for multicall requests
const PENDING_MAX_AGE_S = 3600;      // Hide pending challenges older than 1 hour

// ─── Game ID discovery ───────────────────────────────────────────────────────
// Uses shared discoverGameId() from @/lib/gameDiscovery — event log lookup
// with backward-scan fallback. See that module for implementation details.

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

    // Load permanent settled cache + settled game match IDs
    ensurePermanentCacheLoaded();
    ensureSettledGameMatchesLoaded();

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

      // ── Scan ALL matches via multicall (efficient batch fetching) ──────────
      // Split IDs into cached (settled, from permanent cache) and uncached.
      // Multicall batches getMatch calls — 50 per RPC request instead of 1.
      const cachedMatches: OnChainMatch[] = [];
      const uncachedIds: number[] = [];

      for (let id = 0; id < total; id++) {
        const cached = permanentSettledCache.get(id);
        if (cached) {
          cachedMatches.push(cached);
        } else {
          uncachedIds.push(id);
        }
      }

      // Batch-fetch uncached matches via multicall
      const fetchedMatches: OnChainMatch[] = [];
      for (let i = 0; i < uncachedIds.length; i += MULTICALL_BATCH) {
        const batch = uncachedIds.slice(i, i + MULTICALL_BATCH);
        const contracts = batch.map((id) => ({
          address: ADDRESSES.escrow,
          abi: escrowAbi,
          functionName: "getMatch" as const,
          args: [BigInt(id)],
        }));

        try {
          const results = await publicClient.multicall({
            contracts: contracts as any,
            allowFailure: true,
          });

          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            if (r.status === "success" && r.result) {
              const data = r.result as any;
              const matchId = batch[j];
              const status = parseStatus(Number(data.status));
              fetchedMatches.push({
                matchId,
                player1: data.player1,
                player2: data.player2,
                wager: data.wager,
                gameContract: data.gameContract,
                status,
                createdAt: Number(data.createdAt),
                gameType: detectGameType(data.gameContract),
              });
            }
          }
        } catch (mcErr) {
          // Multicall failed — fall back to sequential for this batch
          console.warn("[fetchMatches] multicall failed, using sequential:", mcErr);
          for (const id of batch) {
            try {
              const data = await publicClient.readContract({
                address: ADDRESSES.escrow,
                abi: escrowAbi,
                functionName: "getMatch",
                args: [BigInt(id)],
              }) as any;
              fetchedMatches.push({
                matchId: id,
                player1: data.player1,
                player2: data.player2,
                wager: data.wager,
                gameContract: data.gameContract,
                status: parseStatus(Number(data.status)),
                createdAt: Number(data.createdAt),
                gameType: detectGameType(data.gameContract),
              });
            } catch {
              // Skip failed IDs
            }
          }
        }
      }

      // Batch-fetch winners for newly discovered settled matches
      const newlySettled = fetchedMatches.filter((m) => m.status === "settled");
      for (let i = 0; i < newlySettled.length; i += MULTICALL_BATCH) {
        const batch = newlySettled.slice(i, i + MULTICALL_BATCH);
        const contracts = batch.map((m) => ({
          address: ADDRESSES.escrow,
          abi: escrowAbi,
          functionName: "winners" as const,
          args: [BigInt(m.matchId)],
        }));

        try {
          const results = await publicClient.multicall({
            contracts: contracts as any,
            allowFailure: true,
          });
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            if (r.status === "success" && r.result) {
              const winner = r.result as string;
              if (winner && winner !== "0x0000000000000000000000000000000000000000") {
                batch[j].winner = winner;
              }
            }
          }
        } catch {
          // Winner lookup is best-effort
        }

        // Permanently cache settled matches — they never change
        for (const m of batch) {
          addToPermanentCache(m);
        }
      }

      // Combine cached + fetched, filter out unknown game types (old contracts)
      const matches = [...cachedMatches, ...fetchedMatches]
        .filter((m) => m.gameType !== "unknown");

      // Store all matches for the liveness checker to use
      allMatchesRef.current = matches;

      // Split into categories — liveness will refine "active" matches later
      // Filter out stale pending challenges (older than PENDING_MAX_AGE_S)
      const nowSecs = Math.floor(Date.now() / 1000);
      const pending = matches
        .filter((m) => m.status === "pending" && (nowSecs - m.createdAt) < PENDING_MAX_AGE_S)
        .sort((a, b) => b.createdAt - a.createdAt);

      // Settled from scan + older entries from permanent cache (beyond scan window)
      // Exclude matches still in settlement grace period (they stay in LIVE)
      const scanSettledIds = new Set(matches.filter((m) => m.status === "settled").map((m) => m.matchId));
      const olderSettled = Array.from(permanentSettledCache.values())
        .filter((m) => !scanSettledIds.has(m.matchId));

      // Matches in grace period should stay in LIVE, not settled
      const graceMatchIds = new Set<number>();
      for (const [mid, graceStart] of settlementGraceMap) {
        if (Date.now() - graceStart < SETTLEMENT_GRACE_MS) {
          graceMatchIds.add(mid);
        }
      }

      const settled = [
        ...matches.filter((m) => m.status === "settled" && !graceMatchIds.has(m.matchId)),
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

      // Settled matches still in grace period → inject into live array with isPlaying=true
      // so the battle director can finish its cinematic sequence
      const graceMatches = matches
        .filter((m) => m.status === "settled" && graceMatchIds.has(m.matchId))
        .map((m) => ({ ...m, isPlaying: true as boolean | undefined, gamePhase: "COMPLETE" }));

      // Live = active matches confirmed as playing + grace-period settled matches
      const live = [
        ...active.filter((m) => m.isPlaying === true),
        ...graceMatches,
      ].sort((a, b) => b.createdAt - a.createdAt);

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
        // But respect the grace period: keep isPlaying=true during cinematic window
        if (settledGameMatches.has(match.matchId)) {
          // If already marked EXPIRED, keep it that way — no grace needed
          if (match.gamePhase === "EXPIRED") {
            if (match.isPlaying !== false) {
              match.isPlaying = false;
              changed = true;
            }
            continue;
          }

          const graceStart = settlementGraceMap.get(match.matchId);
          const inGrace = graceStart && (Date.now() - graceStart < SETTLEMENT_GRACE_MS);

          if (inGrace) {
            // Grace period active — keep in live so cinematic can finish
            if (match.isPlaying !== true) {
              match.isPlaying = true;
              match.gamePhase = "COMPLETE";
              changed = true;
            }
          } else {
            // Grace expired — move to recent results
            settlementGraceMap.delete(match.matchId);
            if (match.isPlaying !== false) {
              match.isPlaying = false;
              match.gamePhase = match.gamePhase || "COMPLETE";
              changed = true;
            }
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
            // Mark as settled and persist to localStorage so page refresh
            // doesn't restart the grace period
            settledGameMatches.add(match.matchId);
            saveSettledGameMatches();

            if (isStale && !complete) {
              // Expired/abandoned match — no cinematic needed, skip grace period
              // Move immediately to RECENT RESULTS with "EXPIRED" label
              if (match.isPlaying !== false || match.gamePhase !== "EXPIRED") {
                match.isPlaying = false;
                match.gamePhase = "EXPIRED";
                match.gamePhaseRaw = phase;
                changed = true;
              }
            } else {
              // Truly completed game — apply grace period for cinematic playback
              // Start grace timer on first detection (don't restart if already ticking)
              if (!settlementGraceMap.has(match.matchId)) {
                settlementGraceMap.set(match.matchId, Date.now());
              }

              const graceStart = settlementGraceMap.get(match.matchId)!;
              const inGrace = Date.now() - graceStart < SETTLEMENT_GRACE_MS;

              if (inGrace) {
                // Grace period: keep in live matches so the director can animate
                if (match.isPlaying !== true || match.gamePhaseRaw !== phase) {
                  match.isPlaying = true;
                  match.gamePhase = "COMPLETE";
                  match.gamePhaseRaw = phase;
                  changed = true;
                }
              } else {
                // Grace expired — move to recent results
                settlementGraceMap.delete(match.matchId);
                if (match.isPlaying !== false) {
                  match.isPlaying = false;
                  match.gamePhase = "COMPLETE";
                  match.gamePhaseRaw = phase;
                  changed = true;
                }
              }
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
