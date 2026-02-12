// arena-tools play — challenge an opponent AND play the full game in one blocking call.
// This is the challenger-side equivalent of `respond` (which is for the acceptor).
//
// Usage: npx arena-tools play <opponent> <wager> <game_type> [--rounds 3] [--timeout 600]
//
// Flow: create challenge → delegate to respondCommand (which waits for acceptance,
// creates game, plays all rounds, and reports result).
import { encodeFunctionData, parseEther, getAddress as checksumAddress } from "viem";
import { CONTRACTS, GAME_CONTRACTS, GAME_TYPES } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { event, fail } from "../utils/output.js";
import { respondCommand } from "./respond.js";
export async function playCommand(opponent, wager, gameType, opts) {
    const gt = gameType.toLowerCase();
    if (!(gt in GAME_TYPES)) {
        fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
    }
    const gameContract = GAME_CONTRACTS[gt];
    const wagerWei = parseEther(wager);
    const myAddress = getAddress();
    // Step 1: Create the challenge
    event({ event: "challenging", opponent, wager, gameType: gt });
    const data = encodeFunctionData({
        abi: escrowAbi,
        functionName: "createMatch",
        args: [checksumAddress(opponent), gameContract],
    });
    const { hash } = await sendTx({
        to: CONTRACTS.Escrow,
        data,
        value: wagerWei,
    });
    // Get the match ID from nextMatchId
    const client = getPublicClient();
    const nextId = (await client.readContract({
        address: CONTRACTS.Escrow,
        abi: escrowAbi,
        functionName: "nextMatchId",
    }));
    const matchId = Number(nextId) - 1;
    event({ event: "challenge_created", matchId, opponent, wager, gameType: gt, txHash: hash });
    // Step 2: Delegate to respond — it handles waiting for acceptance, game creation, and play
    await respondCommand(String(matchId), opts);
}
//# sourceMappingURL=play.js.map