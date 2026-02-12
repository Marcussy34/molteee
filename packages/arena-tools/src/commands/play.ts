// arena-tools play — challenge an opponent AND play the full game in one blocking call.
// This is the challenger-side equivalent of `respond` (which is for the acceptor).
//
// Usage: npx arena-tools play <opponent> <wager> <game_type> [--rounds 3] [--timeout 600]
//
// Flow: create challenge -> delegate to respondCommand (which waits for acceptance,
// creates game, plays all rounds, and reports result).
import { encodeFunctionData, parseEther, getAddress as checksumAddress } from "viem";
import { CONTRACTS, GAME_CONTRACTS, GAME_TYPES } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { sendTx } from "../utils/tx.js";
import { event, fail } from "../utils/output.js";
import { respondCommand } from "./respond.js";

export async function playCommand(opponent: string, wager: string, gameType: string, opts: any) {
    const gt = gameType.toLowerCase();
    if (!(gt in GAME_TYPES)) {
        fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
    }
    const gameContract = GAME_CONTRACTS[gt];
    const wagerWei = parseEther(wager);

    // Step 1: Create the challenge
    event({ event: "challenging", opponent, wager, gameType: gt });
    const data = encodeFunctionData({
        abi: escrowAbi,
        functionName: "createMatch",
        args: [checksumAddress(opponent), gameContract],
    });
    const { hash, logs } = await sendTx({
        to: CONTRACTS.Escrow,
        data,
        value: wagerWei,
    });

    // Parse matchId from MatchCreated event in tx logs (topics[1]).
    // Race-safe — reads directly from our own tx receipt, not from global state.
    let matchId = -1;
    for (const log of logs) {
        if (log.address.toLowerCase() === CONTRACTS.Escrow.toLowerCase() && log.topics.length > 1) {
            matchId = Number(BigInt(log.topics[1]!));
            break;
        }
    }

    event({ event: "challenge_created", matchId, opponent, wager, gameType: gt, txHash: hash });

    // Step 2: Delegate to respond — it handles waiting for acceptance, game creation, and play
    await respondCommand(String(matchId), opts);
}
