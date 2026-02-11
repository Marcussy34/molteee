// arena-tools pending — list incoming challenges (Created matches where address is player2)
// Scans all match IDs via getMatch(), filters to Created status with matching player2.
// Works with any RPC (no eth_getLogs block range limits).
import { formatEther, getAddress as checksumAddress } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS, GAME_CONTRACTS } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { ok } from "../utils/output.js";

// Reverse map: game contract address → game type name
const GAME_TYPE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(GAME_CONTRACTS).map(([name, addr]) => [
    addr.toLowerCase(),
    name,
  ])
);

export async function pendingCommand(address: string) {
  const client = getPublicClient();
  const addr = checksumAddress(address as `0x${string}`);

  // Get total match count
  const nextMatchId = await client.readContract({
    address: CONTRACTS.Escrow as `0x${string}`,
    abi: escrowAbi,
    functionName: "nextMatchId",
  });

  const total = Number(nextMatchId);
  if (total === 0) {
    ok({ address: addr, challenges: [] });
  }

  // Scan all matches, find Created (status=0) where player2 = addr
  const challenges: Array<{
    matchId: number;
    challenger: string;
    wager: string;
    gameContract: string;
    gameType: string;
    createdAt: number;
  }> = [];

  for (let i = 0; i < total; i++) {
    const match = await client.readContract({
      address: CONTRACTS.Escrow as `0x${string}`,
      abi: escrowAbi,
      functionName: "getMatch",
      args: [BigInt(i)],
    });

    // status 0 = Created, and player2 must match queried address
    if (
      match.status === 0 &&
      (match.player2 as string).toLowerCase() === addr.toLowerCase()
    ) {
      const gc = (match.gameContract as string).toLowerCase();
      challenges.push({
        matchId: i,
        challenger: match.player1 as string,
        wager: formatEther(match.wager as bigint),
        gameContract: match.gameContract as string,
        gameType: GAME_TYPE_MAP[gc] || "unknown",
        createdAt: Number(match.createdAt),
      });
    }
  }

  ok({ address: addr, challenges });
}
