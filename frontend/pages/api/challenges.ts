// GET /api/challenges?address=0x... — Returns pending challenges for an address.
// Scans all match IDs via getMatch(), filters to Created status with matching player2.
// Works with any RPC (no eth_getLogs block range limits).
import type { NextApiRequest, NextApiResponse } from "next";
import { getAddress, formatEther } from "viem";
import { publicClient, ADDRESSES } from "../../lib/contracts";
import { escrowAbi } from "../../lib/abi/Escrow";

// Map game contract address → human-readable game type name
const GAME_TYPE_MAP: Record<string, string> = {
  [ADDRESSES.rpsGame.toLowerCase()]: "rps",
  [ADDRESSES.pokerGame.toLowerCase()]: "poker",
  [ADDRESSES.auctionGame.toLowerCase()]: "auction",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // Validate address param
  const rawAddress = req.query.address;
  if (!rawAddress || typeof rawAddress !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "Missing required query param: address" });
  }

  let address: `0x${string}`;
  try {
    address = getAddress(rawAddress) as `0x${string}`;
  } catch {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid address format" });
  }

  try {
    // Get total match count from Escrow
    const nextMatchId = await publicClient.readContract({
      address: ADDRESSES.escrow as `0x${string}`,
      abi: escrowAbi,
      functionName: "nextMatchId",
    });

    const total = Number(nextMatchId);
    if (total === 0) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, s-maxage=30, max-age=15");
      return res.status(200).json({ ok: true, challenges: [] });
    }

    // Scan all matches, find Created (status=0) where player2 = address
    const challenges: Array<{
      matchId: number;
      challenger: unknown;
      wager: string;
      gameContract: unknown;
      gameType: string;
      createdAt: number;
    }> = [];

    for (let i = 0; i < total; i++) {
      const match = await publicClient.readContract({
        address: ADDRESSES.escrow as `0x${string}`,
        abi: escrowAbi,
        functionName: "getMatch",
        args: [BigInt(i)],
      });

      // status 0 = Created, player2 must match queried address
      if (
        match.status === 0 &&
        (match.player2 as string).toLowerCase() === address.toLowerCase()
      ) {
        const gc = (match.gameContract as string).toLowerCase();
        challenges.push({
          matchId: i,
          challenger: match.player1,
          wager: formatEther(match.wager as bigint),
          gameContract: match.gameContract,
          gameType: GAME_TYPE_MAP[gc] || "unknown",
          createdAt: Number(match.createdAt),
        });
      }
    }

    // CORS + short cache (challenges are time-sensitive)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, s-maxage=30, max-age=15");
    return res.status(200).json({ ok: true, challenges });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
