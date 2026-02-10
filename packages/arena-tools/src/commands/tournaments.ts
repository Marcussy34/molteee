// arena-tools tournaments — list tournaments and tournament-status
import { formatEther } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS } from "../config.js";
import { tournamentV2Abi } from "../contracts.js";
import { ok } from "../utils/output.js";

const FORMAT_NAMES = ["RoundRobin", "DoubleElimination"] as const;
const STATUS_NAMES = [
  "Registration",
  "Active",
  "Complete",
  "Cancelled",
] as const;

export async function tournamentsCommand() {
  const client = getPublicClient();

  const nextId = (await client.readContract({
    address: CONTRACTS.TournamentV2 as `0x${string}`,
    abi: tournamentV2Abi,
    functionName: "nextTournamentId",
  })) as bigint;

  // Fetch all tournaments
  const tournaments = [];
  for (let i = 0n; i < nextId; i++) {
    const t = await client.readContract({
      address: CONTRACTS.TournamentV2 as `0x${string}`,
      abi: tournamentV2Abi,
      functionName: "getTournament",
      args: [i],
    });
    tournaments.push({
      id: Number(i),
      format: FORMAT_NAMES[t.format as number] || `Unknown(${t.format})`,
      entryFee: formatEther(t.entryFee as bigint),
      baseWager: formatEther(t.baseWager as bigint),
      maxPlayers: Number(t.maxPlayers),
      playerCount: Number(t.playerCount),
      prizePool: formatEther(t.prizePool as bigint),
      status: STATUS_NAMES[t.status as number] || `Unknown(${t.status})`,
      statusCode: Number(t.status),
      creator: t.creator,
      winner: t.winner,
    });
  }

  ok({ count: tournaments.length, tournaments });
}

export async function tournamentStatusCommand(tournamentId: string) {
  const client = getPublicClient();
  const id = BigInt(tournamentId);

  const [tournament, participants] = await Promise.all([
    client.readContract({
      address: CONTRACTS.TournamentV2 as `0x${string}`,
      abi: tournamentV2Abi,
      functionName: "getTournament",
      args: [id],
    }),
    client.readContract({
      address: CONTRACTS.TournamentV2 as `0x${string}`,
      abi: tournamentV2Abi,
      functionName: "getParticipants",
      args: [id],
    }),
  ]);

  ok({
    id: Number(id),
    format: FORMAT_NAMES[tournament.format as number] || `Unknown(${tournament.format})`,
    entryFee: formatEther(tournament.entryFee as bigint),
    baseWager: formatEther(tournament.baseWager as bigint),
    maxPlayers: Number(tournament.maxPlayers),
    playerCount: Number(tournament.playerCount),
    prizePool: formatEther(tournament.prizePool as bigint),
    status: STATUS_NAMES[tournament.status as number] || `Unknown(${tournament.status})`,
    creator: tournament.creator,
    winner: tournament.winner,
    participants: participants as readonly string[],
  });
}
