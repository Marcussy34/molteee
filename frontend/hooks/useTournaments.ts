import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { tournamentV2Abi } from "@/lib/abi/TournamentV2";

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

interface TournamentsResult {
  tournaments: TournamentData[];
  loading: boolean;
}

// Fetches from TournamentV2 only (matches arena-tools: tournaments, tournament-status, create-tournament, join-tournament)
export function useTournaments(): TournamentsResult {
  const [data, setData] = useState<TournamentsResult>({
    tournaments: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const nextId = await publicClient.readContract({
          address: ADDRESSES.tournamentV2,
          abi: tournamentV2Abi,
          functionName: "nextTournamentId",
        });
        const count = Number(nextId);

        const promises: Promise<TournamentData>[] = [];
        for (let i = 1; i < count; i++) {
          promises.push(
            Promise.all([
              publicClient.readContract({
                address: ADDRESSES.tournamentV2,
                abi: tournamentV2Abi,
                functionName: "getTournament",
                args: [BigInt(i)],
              }),
              publicClient.readContract({
                address: ADDRESSES.tournamentV2,
                abi: tournamentV2Abi,
                functionName: "getParticipants",
                args: [BigInt(i)],
              }),
            ]).then(([info, participants]) => {
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
                id: i,
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
            })
          );
        }

        const tournaments = await Promise.all(promises);
        if (cancelled) return;

        setData({ tournaments, loading: false });
      } catch (err) {
        console.error("Failed to fetch tournaments:", err);
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
