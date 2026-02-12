// arena-tools poker-* — step-by-step Poker game commands
// poker-create: Create a new Poker game
// poker-commit: Commit a hand value (1-100)
// poker-action: Take a betting action (check, bet, raise, call, fold)
// poker-reveal: Reveal the committed hand
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { pokerGameAbi } from "../contracts.js";
import { getAddress, getPublicClient } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail } from "../utils/output.js";
const ACTION_MAP = {
    none: 0,
    check: 1,
    bet: 2,
    raise: 3,
    call: 4,
    fold: 5,
};
/** Create a new Poker game for a match */
export async function pokerCreateCommand(matchId) {
    const data = encodeFunctionData({
        abi: pokerGameAbi,
        functionName: "createGame",
        args: [BigInt(matchId)],
    });
    const { hash, logs } = await sendTx({
        to: CONTRACTS.PokerGame,
        data,
    });
    // Parse the game ID from the GameCreated event in tx logs
    let gameId = -1;
    for (const log of logs) {
        if (log.address.toLowerCase() === CONTRACTS.PokerGame.toLowerCase() && log.topics.length > 1) {
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
export async function pokerCommitCommand(gameId, handValue) {
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
        abi: pokerGameAbi,
        functionName: "commitHand",
        args: [BigInt(gameId), hash],
    });
    const { hash: txHash } = await sendTx({
        to: CONTRACTS.PokerGame,
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
export async function pokerActionCommand(gameId, action, amount) {
    const actionLower = action.toLowerCase();
    const actionNum = ACTION_MAP[actionLower];
    if (actionNum === undefined) {
        fail(`Invalid action: ${action}. Must be check, bet, raise, call, or fold.`, "INVALID_ACTION");
    }
    const data = encodeFunctionData({
        abi: pokerGameAbi,
        functionName: "takeAction",
        args: [BigInt(gameId), actionNum],
    });
    // Bet/raise send explicit amount; call auto-reads currentBet from contract
    let value = 0n;
    if ((actionLower === "bet" || actionLower === "raise") && amount) {
        value = parseEther(amount);
    }
    else if (actionLower === "call") {
        // Read currentBet from contract so the user doesn't need to pass it
        const client = getPublicClient();
        const game = (await client.readContract({
            address: CONTRACTS.PokerGame,
            abi: pokerGameAbi,
            functionName: "getGame",
            args: [BigInt(gameId)],
        }));
        value = game.currentBet ?? game[4] ?? 0n; // currentBet field
    }
    const { hash: txHash } = await sendTx({
        to: CONTRACTS.PokerGame,
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
export async function pokerRevealCommand(gameId) {
    const myAddress = getAddress();
    const saved = loadSalt(`poker-${gameId}-${myAddress}`);
    if (!saved) {
        fail(`No saved salt for poker game ${gameId}. Did you commit first?`, "NO_SALT");
        return;
    }
    const handValue = parseInt(saved.value);
    const data = encodeFunctionData({
        abi: pokerGameAbi,
        functionName: "revealHand",
        args: [BigInt(gameId), handValue, saved.salt],
    });
    const { hash: txHash } = await sendTx({
        to: CONTRACTS.PokerGame,
        data,
    });
    ok({
        action: "poker-reveal",
        gameId: parseInt(gameId),
        handValue,
        txHash,
    });
}
//# sourceMappingURL=poker.js.map