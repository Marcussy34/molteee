// arena-tools history — match history for an address
import { formatEther, getAddress as checksumAddress } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS } from "../config.js";
import { agentRegistryAbi } from "../contracts.js";
import { ok } from "../utils/output.js";

export async function historyCommand(address: string) {
  const client = getPublicClient();
  // Normalize to checksummed address
  const addr = checksumAddress(address as `0x${string}`);

  const matches = (await client.readContract({
    address: CONTRACTS.AgentRegistry as `0x${string}`,
    abi: agentRegistryAbi,
    functionName: "getMatchHistory",
    args: [addr],
  })) as readonly {
    opponent: string;
    gameType: number;
    won: boolean;
    wager: bigint;
    timestamp: bigint;
  }[];

  const gameTypeNames = ["rps", "poker", "auction"] as const;

  ok({
    address: addr,
    totalMatches: matches.length,
    wins: matches.filter((m) => m.won).length,
    losses: matches.filter((m) => !m.won).length,
    matches: matches.map((m) => ({
      opponent: m.opponent,
      gameType: gameTypeNames[m.gameType] || `unknown(${m.gameType})`,
      won: m.won,
      wager: formatEther(m.wager),
      timestamp: Number(m.timestamp),
      date: new Date(Number(m.timestamp) * 1000).toISOString(),
    })),
  });
}
