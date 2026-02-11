// arena-tools find-game — find the game ID for a given match
// Scans the appropriate game contract to find a game linked to a match ID.
// This is a read-only command (no PRIVATE_KEY needed).
import { CONTRACTS, GAME_CONTRACTS, type GameTypeName } from "../config.js";
import { getPublicClient } from "../client.js";
import {
  escrowAbi,
  rpsGameAbi,
  pokerGameAbi,
  auctionGameAbi,
} from "../contracts.js";
import { ok, fail } from "../utils/output.js";

// Map contract address (lowercased) → game type name
const CONTRACT_TO_TYPE: Record<string, GameTypeName> = Object.fromEntries(
  Object.entries(GAME_CONTRACTS).map(([name, addr]) => [
    addr.toLowerCase(),
    name as GameTypeName,
  ])
);

// Map game type → ABI
const TYPE_TO_ABI: Record<GameTypeName, readonly any[]> = {
  rps: rpsGameAbi,
  poker: pokerGameAbi,
  auction: auctionGameAbi,
};

/**
 * Find the game ID for a match by scanning the game contract.
 * Uses the match's gameContract to determine which game type to scan.
 */
export async function findGameCommand(matchId: string) {
  const client = getPublicClient();
  const mid = BigInt(matchId);

  // 1. Read the match to get the game contract address
  const match = await client.readContract({
    address: CONTRACTS.Escrow as `0x${string}`,
    abi: escrowAbi,
    functionName: "getMatch",
    args: [mid],
  });

  // 2. Determine game type from contract address
  const gameAddr = (match as any).gameContract.toLowerCase();
  const gameType = CONTRACT_TO_TYPE[gameAddr];
  if (!gameType) {
    // Match exists but no game contract set yet — game hasn't been created
    fail(
      `No game created yet for match ${matchId}. The challenger needs to create the game first.`,
      "NO_GAME_YET"
    );
    return;
  }

  const contractAddr = GAME_CONTRACTS[gameType] as `0x${string}`;
  const abi = TYPE_TO_ABI[gameType];

  // 3. Scan forward from game ID 0 — check each game for matching matchId.
  //    Stop when we hit a revert (no more games exist).
  for (let i = 0; i < 10000; i++) {
    try {
      const game = (await client.readContract({
        address: contractAddr,
        abi,
        functionName: "getGame",
        args: [BigInt(i)],
      })) as any;

      if (Number(game.escrowMatchId) === Number(matchId)) {
        ok({
          action: "find-game",
          matchId: Number(matchId),
          gameType,
          gameId: i,
          phase: Number(game.phase),
          settled: game.settled,
        });
        return;
      }
    } catch {
      // Revert = no game at this ID, we've passed the last game
      break;
    }
  }

  // No game found
  fail(
    `No game found for match ${matchId}. The challenger may not have created the game yet. Try again in a few seconds.`,
    "GAME_NOT_FOUND"
  );
}
