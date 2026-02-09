import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { publicClient, ADDRESSES } from "@/lib/contracts";
import { tournamentAbi } from "@/lib/abi/Tournament";
import { tournamentV2Abi } from "@/lib/abi/TournamentV2";

// V1 tournament status enum
export enum TournamentStatus {
  Registration = 0,
  Active = 1,
  Completed = 2,
  Cancelled = 3,
}

// V2 tournament format enum
export enum TournamentFormat {
  RoundRobin = 0,
  DoubleElimination = 1,
}

export interface TournamentData {
  id: number;
  version: 1 | 2;
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

export function useTournaments(): TournamentsResult {
  const [data, setData] = useState<TournamentsResult>({
    tournaments: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        // Get counts from both V1 and V2
        const [nextV1, nextV2] = await Promise.all([
          publicClient.readContract({
            address: ADDRESSES.tournament,
            abi: tournamentAbi,
            functionName: "nextTournamentId",
          }),
          publicClient.readContract({
            address: ADDRESSES.tournamentV2,
            abi: tournamentV2Abi,
            functionName: "nextTournamentId",
          }),
        ]);

        const countV1 = Number(nextV1);
        const countV2 = Number(nextV2);

        const promises: Promise<TournamentData>[] = [];

        // Fetch V1 tournaments
        for (let i = 1; i < countV1; i++) {
          promises.push(
            Promise.all([
              publicClient.readContract({
                address: ADDRESSES.tournament,
                abi: tournamentAbi,
                functionName: "getTournament",
                args: [BigInt(i)],
              }),
              publicClient.readContract({
                address: ADDRESSES.tournament,
                abi: tournamentAbi,
                functionName: "getParticipants",
                args: [BigInt(i)],
              }),
            ]).then(([info, participants]) => {
              const t = info as {
                entryFee: bigint;
                baseWager: bigint;
                maxPlayers: bigint;
                playerCount: bigint;
                prizePool: bigint;
                currentRound: bigint;
                totalRounds: bigint;
                status: number;
                creator: string;
                winner: string;
                runnerUp: string;
              };
              return {
                id: i,
                version: 1 as const,
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

        // Fetch V2 tournaments
        for (let i = 1; i < countV2; i++) {
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
                version: 2 as const,
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
