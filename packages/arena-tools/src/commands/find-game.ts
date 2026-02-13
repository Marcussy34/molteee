// arena-tools find-game — find the game ID for a given match
// Scans the appropriate game contract to find a game linked to a match ID.
// This is a read-only command (no PRIVATE_KEY needed).
import { CONTRACTS, GAME_CONTRACTS } from "../config.js";
import { getPublicClient } from "../client.js";
import {
    escrowAbi,
    rpsGameAbi,
    pokerGameV2Abi,
    auctionGameAbi,
} from "../contracts.js";
import { ok, fail } from "../utils/output.js";

// Map contract address (lowercased) -> game type name
const CONTRACT_TO_TYPE: Record<string, string> = Object.fromEntries(
    Object.entries(GAME_CONTRACTS).map(([name, addr]) => [
        addr.toLowerCase(),
        name,
    ])
);

// Map game type -> ABI
const TYPE_TO_ABI: Record<string, any> = {
    rps: rpsGameAbi,
    poker: pokerGameV2Abi,
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
    const match = (await client.readContract({
        address: CONTRACTS.Escrow,
        abi: escrowAbi,
        functionName: "getMatch",
        args: [mid],
    })) as any;

    // 2. Determine game type from contract address
    const gameAddr = match.gameContract.toLowerCase();
    const gameType = CONTRACT_TO_TYPE[gameAddr];
    if (!gameType) {
        // Match exists but no game contract set yet — game hasn't been created
        fail(
            `No game created yet for match ${matchId}. The challenger needs to create the game first.`,
            "NO_GAME_YET"
        );
        return;
    }

    const contractAddr = GAME_CONTRACTS[gameType];
    const abi = TYPE_TO_ABI[gameType];

    // 3. Get total game count, then scan BACKWARDS from latest.
    //    New matches create games with the highest IDs, so scanning backwards
    //    finds the target in 1-2 RPC calls instead of N (where N = total games).
    let nextId: number;
    try {
        const raw = await client.readContract({
            address: contractAddr,
            abi,
            functionName: "nextGameId",
        });
        nextId = Number(raw);
    } catch {
        fail("Failed to read nextGameId from game contract", "CONTRACT_ERROR");
        return;
    }

    for (let i = nextId - 1; i >= 0; i--) {
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
        }
        catch {
            // Revert = no game at this ID, skip
            continue;
        }
    }

    // No game found
    fail(
        `No game found for match ${matchId}. The challenger may not have created the game yet. Try again in a few seconds.`,
        "GAME_NOT_FOUND"
    );
}
