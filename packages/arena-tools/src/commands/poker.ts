// arena-tools poker-* — step-by-step Poker game commands
// poker-create: Create a new Poker game
// poker-commit: Commit a hand value (1-100)
// poker-action: Take a betting action (check, bet, raise, call, fold)
// poker-reveal: Reveal the committed hand
import { encodeFunctionData, parseEther } from "viem";
import { CONTRACTS } from "../config.js";
import { pokerGameAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitHash } from "../utils/commit-reveal.js";
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
    abi: pokerGameAbi,
    functionName: "createGame",
    args: [BigInt(matchId)],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.PokerGame as `0x${string}`,
    data,
  });

  // Find the game ID by scanning forward
  const client = getPublicClient();
  let gameId = -1;
  for (let i = 0; i < 10000; i++) {
    try {
      const game = await client.readContract({
        address: CONTRACTS.PokerGame as `0x${string}`,
        abi: pokerGameAbi,
        functionName: "getGame",
        args: [BigInt(i)],
      });
      if (Number((game as any).escrowMatchId) === parseInt(matchId)) {
        gameId = i;
      }
    } catch {
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
    abi: pokerGameAbi,
    functionName: "commitHand",
    args: [BigInt(gameId), hash],
  });

  const { hash: txHash } = await sendTx({
    to: CONTRACTS.PokerGame as `0x${string}`,
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
export async function pokerActionCommand(
  gameId: string,
  action: string,
  amount?: string
) {
  const actionLower = action.toLowerCase();
  const actionNum = ACTION_MAP[actionLower];
  if (actionNum === undefined) {
    fail(
      `Invalid action: ${action}. Must be check, bet, raise, call, or fold.`,
      "INVALID_ACTION"
    );
  }

  const data = encodeFunctionData({
    abi: pokerGameAbi,
    functionName: "takeAction",
    args: [BigInt(gameId), actionNum],
  });

  // Bet and raise require sending MON as msg.value
  const value =
    (actionLower === "bet" || actionLower === "raise") && amount
      ? parseEther(amount)
      : 0n;

  const { hash: txHash } = await sendTx({
    to: CONTRACTS.PokerGame as `0x${string}`,
    data,
    value,
  });

  ok({
    action: "poker-action",
    gameId: parseInt(gameId),
    actionType: actionLower,
    amount: amount || "0",
    txHash,
  });
}

/** Reveal the committed hand value */
export async function pokerRevealCommand(gameId: string) {
  const myAddress = getAddress();
  const saved = loadSalt(`poker-${gameId}-${myAddress}`);
  if (!saved) {
    fail(
      `No saved salt for poker game ${gameId}. Did you commit first?`,
      "NO_SALT"
    );
    return;
  }

  const handValue = parseInt(saved.value);

  const data = encodeFunctionData({
    abi: pokerGameAbi,
    functionName: "revealHand",
    args: [BigInt(gameId), handValue, saved.salt],
  });

  const { hash: txHash } = await sendTx({
    to: CONTRACTS.PokerGame as `0x${string}`,
    data,
  });

  ok({
    action: "poker-reveal",
    gameId: parseInt(gameId),
    handValue,
    txHash,
  });
}
