// arena-tools challenge — create an escrow match against an opponent
import { encodeFunctionData, parseEther, getAddress as checksumAddress } from "viem";
import { CONTRACTS, GAME_CONTRACTS, GAME_TYPES } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";

export async function challengeCommand(opponent: string, wager: string, gameType: string) {
    const gt = gameType.toLowerCase();
    if (!(gt in GAME_TYPES)) {
        fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
    }
    const gameContract = GAME_CONTRACTS[gt];
    const wagerWei = parseEther(wager);
    const address = getAddress();

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

    // Parse matchId from the MatchCreated event in tx logs (topics[1]).
    // This is race-safe — reads directly from our own tx receipt, not from global state.
    let matchId = -1;
    for (const log of logs) {
        if (log.address.toLowerCase() === CONTRACTS.Escrow.toLowerCase() && log.topics.length > 1) {
            // First indexed param in MatchCreated event is the matchId
            matchId = Number(BigInt(log.topics[1]!));
            break;
        }
    }

    ok({
        action: "challenge",
        matchId,
        challenger: address,
        opponent,
        gameType: gt,
        wager,
        txHash: hash,
    });
}
