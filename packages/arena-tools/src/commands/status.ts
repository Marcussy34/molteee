// arena-tools status — wallet balance, registration, ELO
import { formatEther, getAddress as checksumAddress } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS, GAME_TYPES } from "../config.js";
import { agentRegistryAbi } from "../contracts.js";
import { ok, fail } from "../utils/output.js";

export async function statusCommand(address: string) {
  const client = getPublicClient();
  // Normalize to checksummed address (handles mixed-case input)
  const addr = checksumAddress(address as `0x${string}`);

  // Fetch balance and agent info in parallel
  const [balance, agentInfo, rpsElo, pokerElo, auctionElo] = await Promise.all([
    client.getBalance({ address: addr }),
    client.readContract({
      address: CONTRACTS.AgentRegistry as `0x${string}`,
      abi: agentRegistryAbi,
      functionName: "getAgent",
      args: [addr],
    }),
    client.readContract({
      address: CONTRACTS.AgentRegistry as `0x${string}`,
      abi: agentRegistryAbi,
      functionName: "elo",
      args: [addr, GAME_TYPES.rps],
    }),
    client.readContract({
      address: CONTRACTS.AgentRegistry as `0x${string}`,
      abi: agentRegistryAbi,
      functionName: "elo",
      args: [addr, GAME_TYPES.poker],
    }),
    client.readContract({
      address: CONTRACTS.AgentRegistry as `0x${string}`,
      abi: agentRegistryAbi,
      functionName: "elo",
      args: [addr, GAME_TYPES.auction],
    }),
  ]);

  // Map game type numbers to names
  const gameTypeNames = ["rps", "poker", "auction"] as const;
  const registeredGames = (agentInfo.gameTypes as readonly number[]).map(
    (t) => gameTypeNames[t] || `unknown(${t})`
  );

  ok({
    address: addr,
    balance: formatEther(balance as bigint),
    balanceWei: (balance as bigint).toString(),
    registered: agentInfo.exists,
    isOpen: agentInfo.isOpen,
    gameTypes: registeredGames,
    minWager: formatEther(agentInfo.minWager as bigint),
    maxWager: formatEther(agentInfo.maxWager as bigint),
    elo: {
      rps: Number(rpsElo),
      poker: Number(pokerElo),
      auction: Number(auctionElo),
    },
  });
}
