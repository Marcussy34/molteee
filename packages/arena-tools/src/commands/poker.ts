// arena-tools poker-* — step-by-step Budget Poker game commands (V2)
// poker-create: Create a new Budget Poker game (3 rounds, 150-point budget)
// poker-commit: Commit a hand value (1-100, constrained by budget)
// poker-action: Take a betting action (check, bet, raise, call, fold)
// poker-reveal: Reveal the committed hand (budget deducted on reveal)
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { pokerGameV2Abi } from "../contracts.js";
import { getAddress, getPublicClient } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, deleteSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail } from "../utils/output.js";

const ACTION_MAP: Record<string, number> = {
    none: 0,
    check: 1,
    bet: 2,
    raise: 3,
    call: 4,
    fold: 5,
};

/** Create a new Poker game for a match */
export async function pokerCreateCommand(matchId: string) {
    const data = encodeFunctionData({
        abi: pokerGameV2Abi,
        functionName: "createGame",
        args: [BigInt(matchId)],
    });

    const { hash, logs } = await sendTx({
        to: CONTRACTS.PokerGameV2,
        data,
    });

    // Parse the game ID from the GameCreated event in tx logs
    let gameId = -1;
    for (const log of logs) {
        if (log.address.toLowerCase() === CONTRACTS.PokerGameV2.toLowerCase() && log.topics.length > 1) {
            gameId = Number(BigInt(log.topics[1]));
            break;
        }
    }

    ok({
        action: "poker-create",
        matchId: parseInt(matchId),
        gameId,
        txHash: hash,
    });
}

/** Commit a hand value (1-100) */
export async function pokerCommitCommand(gameId: string, handValue: string) {
    const value = parseInt(handValue);
    if (value < 1 || value > 100) {
        fail("Hand value must be between 1 and 100.", "INVALID_HAND_VALUE");
    }

    const salt = generateSalt();
    const hash = commitHash(value, salt);

    // Include wallet address in key to avoid collision between players
    const myAddress = getAddress();
    saveSalt(`poker-${gameId}-${myAddress}`, salt, handValue, "poker");

    const data = encodeFunctionData({
        abi: pokerGameV2Abi,
        functionName: "commitHand",
        args: [BigInt(gameId), hash],
    });

    const { hash: txHash } = await sendTx({
        to: CONTRACTS.PokerGameV2,
        data,
    });

    ok({
        action: "poker-commit",
        gameId: parseInt(gameId),
        handValue: value,
        commitHash: hash,
        txHash,
    });
}

/** Take a betting action (check, bet, raise, call, fold) */
export async function pokerActionCommand(gameId: string, action: string, amount?: string) {
    const actionLower = action.toLowerCase();
    const actionNum = ACTION_MAP[actionLower];
    if (actionNum === undefined) {
        fail(`Invalid action: ${action}. Must be check, bet, raise, call, or fold.`, "INVALID_ACTION");
    }

    const data = encodeFunctionData({
        abi: pokerGameV2Abi,
        functionName: "takeAction",
        args: [BigInt(gameId), actionNum],
    });

    // Bet/raise send explicit amount; call auto-reads currentBet from contract
    let value = 0n;
    if ((actionLower === "bet" || actionLower === "raise") && amount) {
        value = parseEther(amount);
    } else if (actionLower === "call") {
        // Read currentBet from contract so the user doesn't need to pass it
        const client = getPublicClient();
        const game = (await client.readContract({
            address: CONTRACTS.PokerGameV2,
            abi: pokerGameV2Abi,
            functionName: "getGame",
            args: [BigInt(gameId)],
        })) as any;
        value = game.currentBet ?? game[4] ?? 0n; // currentBet field
    }

    const { hash: txHash } = await sendTx({
        to: CONTRACTS.PokerGameV2,
        data,
        value,
    });

    ok({
        action: "poker-action",
        gameId: parseInt(gameId),
        actionType: actionLower,
        amount: value > 0n ? formatEther(value) : "0",
        txHash,
    });
}

/** Reveal the committed hand value */
export async function pokerRevealCommand(gameId: string) {
    const myAddress = getAddress();
    const saved = loadSalt(`poker-${gameId}-${myAddress}`);
    if (!saved) {
        fail(`No saved salt for poker game ${gameId}. Did you commit first?`, "NO_SALT");
        return;
    }

    const handValue = parseInt(saved.value);
    const data = encodeFunctionData({
        abi: pokerGameV2Abi,
        functionName: "revealHand",
        args: [BigInt(gameId), handValue, saved.salt],
    });

    const { hash: txHash } = await sendTx({
        to: CONTRACTS.PokerGameV2,
        data,
    });

    // Only delete salt after successful reveal TX
    deleteSalt(`poker-${gameId}-${myAddress}`);

    ok({
        action: "poker-reveal",
        gameId: parseInt(gameId),
        handValue,
        txHash,
    });
}
