/**
 * useTournament — Fetches full tournament detail (matches, standings, brackets).
 *
 * Caching strategy (mirrors useMarkets / useAllMatches):
 * - Module-level permanent cache for complete/cancelled tournaments (immutable)
 * - localStorage permanent cache: survives page refreshes for settled tournaments
 * - localStorage last-known cache per tournament: instant render on cold load
 * - Deduped fetch via fetchingRef: prevents concurrent requests
 * - Phased fetching: metadata → match counts → all matches + player data
 * - Poll every 30s for active/registration tournaments; no poll for terminal ones
 */

import { useState, useEffect, useRef } from "react";
import { publicClient, ADDRESSES, GameType } from "@/lib/contracts";
import { tournamentV2Abi } from "@/lib/abi/TournamentV2";
import { TournamentStatus, TournamentFormat, type TournamentData } from "./useTournaments";
import { formatEther } from "viem";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single match (works for both RR and DE) */
export interface MatchData {
  matchIndex: number;
  player1: string;
  player2: string;
  winner: string;
  reported: boolean;
  escrowMatchId: number;
  /** Derived from matchIndex % 3 */
  gameType: GameType;
  /** DE-specific: which bracket (0=Winners, 1=Losers, 2=Grand Final) */
  bracket?: number;
  /** DE-specific: round within the bracket */
  round?: number;
  /** DE-specific: match index within the round */
  bracketMatchIndex?: number;
}

/** Round-robin player standings row */
export interface StandingRow {
  address: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

/** DE bracket data organized by bracket → round → matches */
export interface BracketData {
  /** bracket 0 = Winners, 1 = Losers, 2 = Grand Final */
  [bracket: number]: {
    [round: number]: MatchData[];
  };
}

/** Full tournament detail returned by the hook */
export interface TournamentDetail extends TournamentData {
  matches: MatchData[];
  totalMatches: number;
  matchesReported: number;
  /** Only for Round-Robin */
  standings?: StandingRow[];
  /** Only for Double-Elimination */
  bracketData?: BracketData;
  /** Only for DE — losses per player */
  playerLosses?: Record<string, number>;
}

interface UseTournamentResult {
  tournament: TournamentDetail | null;
  loading: boolean;
  error: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const PERM_CACHE_KEY = "tournament-detail-settled-v1";
const DETAIL_CACHE_PREFIX = "tournament-detail-v1-"; // per-tournament last-known
const POLL_MS = 30_000;

// ─── Module-level permanent cache ───────────────────────────────────────────

// In-memory cache for complete/cancelled tournaments (they never change)
const permCache = new Map<number, TournamentDetail>();
let permCacheLoaded = false;

// ─── localStorage helpers ───────────────────────────────────────────────────

/** Load permanent cache (settled tournament details) from localStorage */
function loadPermCacheFromStorage(): void {
  if (typeof window === "undefined" || permCacheLoaded) return;
  permCacheLoaded = true;
  try {
    const raw = localStorage.getItem(PERM_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as TournamentDetail[];
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

/** Load a single tournament's last-known data from localStorage */
function loadDetailFromStorage(id: number): TournamentDetail | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DETAIL_CACHE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as TournamentDetail;
  } catch {
    return null;
  }
}

/** Save a single tournament's detail to localStorage */
function saveDetailToStorage(detail: TournamentDetail): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DETAIL_CACHE_PREFIX + detail.id, JSON.stringify(detail));
  } catch {
    // Non-critical
  }
}

// ─── Core fetch logic ───────────────────────────────────────────────────────

/** Fetch full tournament detail from chain (all phases) */
async function fetchTournamentDetail(tournamentId: number): Promise<TournamentDetail> {
  // Phase 1: tournament metadata + participants (parallel)
  const [info, participants] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.tournamentV2,
      abi: tournamentV2Abi,
      functionName: "getTournament",
      args: [BigInt(tournamentId)],
    }),
    publicClient.readContract({
      address: ADDRESSES.tournamentV2,
      abi: tournamentV2Abi,
      functionName: "getParticipants",
      args: [BigInt(tournamentId)],
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

  const format = Number(t.format);
  const status = Number(t.status);
  const participantList = participants as string[];

  // Base tournament data
  const base: TournamentData = {
    id: tournamentId,
    format,
    entryFee: formatEther(t.entryFee),
    baseWager: formatEther(t.baseWager),
    maxPlayers: Number(t.maxPlayers),
    playerCount: Number(t.playerCount),
    prizePool: formatEther(t.prizePool),
    status,
    creator: t.creator,
    winner: t.winner,
    participants: participantList,
  };

  // If still in Registration, no matches yet
  if (status === TournamentStatus.Registration) {
    return { ...base, matches: [], totalMatches: 0, matchesReported: 0 };
  }

  // Phase 2: fetch match count + reported count
  let totalMatches = 0;
  let matchesReported = 0;

  if (format === TournamentFormat.RoundRobin) {
    const [total, reported] = await Promise.all([
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "rrTotalMatches",
        args: [BigInt(tournamentId)],
      }),
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "rrMatchesReported",
        args: [BigInt(tournamentId)],
      }),
    ]);
    totalMatches = Number(total);
    matchesReported = Number(reported);
  } else {
    const [total, reported] = await Promise.all([
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "deTotalMatches",
        args: [BigInt(tournamentId)],
      }),
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "deMatchesReported",
        args: [BigInt(tournamentId)],
      }),
    ]);
    totalMatches = Number(total);
    matchesReported = Number(reported);
  }

  // Phase 3: fetch all matches + player data in parallel
  let matches: MatchData[] = [];
  let standings: StandingRow[] | undefined;
  let bracketData: BracketData | undefined;
  let playerLosses: Record<string, number> | undefined;

  if (format === TournamentFormat.RoundRobin) {
    // Fetch all RR matches + all player points in parallel
    const matchPromises = Array.from({ length: totalMatches }, (_, i) =>
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "getRRMatch",
        args: [BigInt(tournamentId), BigInt(i)],
      })
    );

    const pointsPromises = participantList.map((addr) =>
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "getPlayerPoints",
        args: [BigInt(tournamentId), addr as `0x${string}`],
      })
    );

    const [matchResults, pointsResults] = await Promise.all([
      Promise.all(matchPromises),
      Promise.all(pointsPromises),
    ]);

    // Parse matches
    matches = matchResults.map((m, i) => {
      const match = m as {
        player1: string; player2: string; winner: string;
        escrowMatchId: bigint; reported: boolean;
      };
      return {
        matchIndex: i,
        player1: match.player1,
        player2: match.player2,
        winner: match.winner,
        reported: match.reported,
        escrowMatchId: Number(match.escrowMatchId),
        gameType: (i % 3) as GameType,
      };
    });

    // Build standings from on-chain points + derive W/L/D from matches
    const winsMap: Record<string, number> = {};
    const lossesMap: Record<string, number> = {};
    const drawsMap: Record<string, number> = {};

    for (const addr of participantList) {
      winsMap[addr.toLowerCase()] = 0;
      lossesMap[addr.toLowerCase()] = 0;
      drawsMap[addr.toLowerCase()] = 0;
    }

    for (const m of matches) {
      if (!m.reported) continue;
      const p1 = m.player1.toLowerCase();
      const p2 = m.player2.toLowerCase();
      const w = m.winner.toLowerCase();

      if (w === ZERO_ADDR.toLowerCase()) {
        drawsMap[p1] = (drawsMap[p1] || 0) + 1;
        drawsMap[p2] = (drawsMap[p2] || 0) + 1;
      } else if (w === p1) {
        winsMap[p1] = (winsMap[p1] || 0) + 1;
        lossesMap[p2] = (lossesMap[p2] || 0) + 1;
      } else if (w === p2) {
        winsMap[p2] = (winsMap[p2] || 0) + 1;
        lossesMap[p1] = (lossesMap[p1] || 0) + 1;
      }
    }

    standings = participantList.map((addr, i) => ({
      address: addr,
      points: Number(pointsResults[i]),
      wins: winsMap[addr.toLowerCase()] || 0,
      losses: lossesMap[addr.toLowerCase()] || 0,
      draws: drawsMap[addr.toLowerCase()] || 0,
    }));
    standings.sort((a, b) => b.points - a.points);

  } else {
    // Double Elimination — iterate bracket/round/match combos
    bracketData = {};
    const deMatchPromises: { bracket: number; round: number; matchIdx: number; promise: Promise<unknown> }[] = [];

    const numPlayers = participantList.length;
    const maxWinnersRounds = Math.ceil(Math.log2(numPlayers));
    const maxLosersRounds = Math.max(1, 2 * (maxWinnersRounds - 1));

    const bracketConfigs = [
      { bracket: 0, maxRounds: maxWinnersRounds, maxMatchesPerRound: Math.ceil(numPlayers / 2) },
      { bracket: 1, maxRounds: maxLosersRounds, maxMatchesPerRound: Math.ceil(numPlayers / 2) },
      { bracket: 2, maxRounds: 1, maxMatchesPerRound: 1 },
    ];

    for (const cfg of bracketConfigs) {
      for (let round = 0; round < cfg.maxRounds; round++) {
        const matchesInRound = cfg.bracket === 2
          ? 1
          : Math.max(1, Math.ceil(numPlayers / Math.pow(2, round + 1)));

        for (let mIdx = 0; mIdx < matchesInRound; mIdx++) {
          deMatchPromises.push({
            bracket: cfg.bracket,
            round,
            matchIdx: mIdx,
            promise: publicClient.readContract({
              address: ADDRESSES.tournamentV2,
              abi: tournamentV2Abi,
              functionName: "getDEMatch",
              args: [BigInt(tournamentId), BigInt(cfg.bracket), BigInt(round), BigInt(mIdx)],
            }).catch(() => null),
          });
        }
      }
    }

    const lossesPromises = participantList.map((addr) =>
      publicClient.readContract({
        address: ADDRESSES.tournamentV2,
        abi: tournamentV2Abi,
        functionName: "getPlayerLosses",
        args: [BigInt(tournamentId), addr as `0x${string}`],
      })
    );

    const [deResults, lossResults] = await Promise.all([
      Promise.all(deMatchPromises.map((d) => d.promise)),
      Promise.all(lossesPromises),
    ]);

    playerLosses = {};
    participantList.forEach((addr, i) => {
      playerLosses![addr.toLowerCase()] = Number(lossResults[i]);
    });

    let globalMatchIdx = 0;
    deResults.forEach((result, i) => {
      if (!result) return;

      const m = result as {
        player1: string; player2: string; winner: string;
        escrowMatchId: bigint; reported: boolean;
      };

      if (m.player1 === ZERO_ADDR && m.player2 === ZERO_ADDR) return;

      const { bracket, round, matchIdx } = deMatchPromises[i];

      if (!bracketData![bracket]) bracketData![bracket] = {};
      if (!bracketData![bracket][round]) bracketData![bracket][round] = [];

      const matchData: MatchData = {
        matchIndex: globalMatchIdx++,
        player1: m.player1,
        player2: m.player2,
        winner: m.winner,
        reported: m.reported,
        escrowMatchId: Number(m.escrowMatchId),
        gameType: (globalMatchIdx % 3) as GameType,
        bracket,
        round,
        bracketMatchIndex: matchIdx,
      };

      bracketData![bracket][round].push(matchData);
      matches.push(matchData);
    });
  }

  return {
    ...base,
    matches,
    totalMatches,
    matchesReported,
    standings,
    bracketData,
    playerLosses,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fetches full tournament detail including all matches, standings/bracket data.
 * Polls every 30s for active/registration tournaments; caches complete/cancelled
 * permanently in both memory and localStorage.
 */
export function useTournament(id: number | undefined): UseTournamentResult {
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  // Track latest status for poll gating (avoids stale closure over `tournament`)
  const statusRef = useRef<number | null>(null);

  useEffect(() => {
    if (id === undefined || id < 1) {
      setLoading(false);
      setError("Invalid tournament ID");
      return;
    }

    const tournamentId = id;

    // Load permanent cache from localStorage on first call
    loadPermCacheFromStorage();

    // Check in-memory permanent cache first
    const permCached = permCache.get(tournamentId);
    if (permCached) {
      setTournament(permCached);
      statusRef.current = permCached.status;
      setLoading(false);
      return; // No polling needed — tournament is settled
    }

    // Show last-known data from localStorage instantly while fetching
    const storedDetail = loadDetailFromStorage(tournamentId);
    if (storedDetail) {
      setTournament(storedDetail);
      statusRef.current = storedDetail.status;
      setLoading(false);

      // If stored data shows settled, promote to permanent cache and stop
      if (storedDetail.status === TournamentStatus.Complete || storedDetail.status === TournamentStatus.Cancelled) {
        permCache.set(tournamentId, storedDetail);
        savePermCacheToStorage();
        return;
      }
    }

    let cancelled = false;

    async function doFetch() {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const detail = await fetchTournamentDetail(tournamentId);

        if (!cancelled) {
          setTournament(detail);
          statusRef.current = detail.status;
          setLoading(false);
          setError(null);

          // Save to localStorage for instant cold-load
          saveDetailToStorage(detail);

          // Promote to permanent cache if settled
          if (detail.status === TournamentStatus.Complete || detail.status === TournamentStatus.Cancelled) {
            permCache.set(tournamentId, detail);
            savePermCacheToStorage();
          }
        }
      } catch (err) {
        console.error("Failed to fetch tournament detail:", err);
        if (!cancelled) {
          setError("Failed to load tournament");
          setLoading(false);
        }
      } finally {
        fetchingRef.current = false;
      }
    }

    doFetch();

    // Poll every 30s — only if tournament is not in a terminal state
    const interval = setInterval(() => {
      if (statusRef.current === TournamentStatus.Complete || statusRef.current === TournamentStatus.Cancelled) {
        return;
      }
      doFetch();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  return { tournament, loading, error };
}
