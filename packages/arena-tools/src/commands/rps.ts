// arena-tools rps-* — step-by-step RPS game commands
// rps-create: Create a new RPS game for a match
// rps-commit: Commit a move (rock/paper/scissors)
// rps-reveal: Reveal the committed move
import { encodeFunctionData } from "viem";
import { CONTRACTS } from "../config.js";
import { rpsGameAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail } from "../utils/output.js";

const MOVE_MAP: Record<string, number> = {
  rock: 1,
  paper: 2,
  scissors: 3,
};

/** Create a new RPS game for a match */
export async function rpsCreateCommand(matchId: string, rounds: string = "1") {
  const roundsNum = parseInt(rounds);
  if (roundsNum <= 0 || roundsNum % 2 === 0) {
    fail("Rounds must be a positive odd number (1, 3, 5, ...)", "INVALID_ROUNDS");
  }

  const data = encodeFunctionData({
    abi: rpsGameAbi,
    functionName: "createGame",
    args: [BigInt(matchId), BigInt(roundsNum)],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.RPSGame as `0x${string}`,
    data,
  });

  // Find the game ID by scanning backwards from the most recent game.
  // The newly created game should be the latest one with this matchId.
  const client = getPublicClient();
  let gameId = -1;
  // Find the upper bound by binary-ish search (probe until we get a revert)
  let upper = 0;
  for (let probe = 100; ; probe += 100) {
    try {
      await client.readContract({
        address: CONTRACTS.RPSGame as `0x${string}`,
        abi: rpsGameAbi,
        functionName: "getGame",
        args: [BigInt(probe)],
      });
      upper = probe;
    } catch {
      upper = probe;
      break;
    }
  }
  // Scan backwards from upper to find the latest game for this match
  for (let i = upper; i >= 0; i--) {
    try {
      const game = await client.readContract({
        address: CONTRACTS.RPSGame as `0x${string}`,
        abi: rpsGameAbi,
        functionName: "getGame",
        args: [BigInt(i)],
      });
      if (Number(game.escrowMatchId) === parseInt(matchId)) {
        gameId = i;
        break;
      }
    } catch {
      continue;
    }
  }

  ok({
    action: "rps-create",
    matchId: parseInt(matchId),
    gameId,
    rounds: roundsNum,
    txHash: hash,
  });
}

/** Commit a move (salt is generated and stored automatically) */
export async function rpsCommitCommand(gameId: string, move: string) {
  const moveLower = move.toLowerCase();
  const moveNum = MOVE_MAP[moveLower];
  if (!moveNum) {
    fail(`Invalid move: ${move}. Must be rock, paper, or scissors.`, "INVALID_MOVE");
  }

  // Generate salt and compute commit hash
  const salt = generateSalt();
  const hash = commitHash(moveNum, salt);

  // Save salt for later reveal (include wallet address to avoid collision)
  const myAddress = getAddress();
  saveSalt(`rps-${gameId}-${myAddress}`, salt, moveLower, "rps");

  const data = encodeFunctionData({
    abi: rpsGameAbi,
    functionName: "commit",
    args: [BigInt(gameId), hash],
  });

  const { hash: txHash } = await sendTx({
    to: CONTRACTS.RPSGame as `0x${string}`,
    data,
  });

  ok({
    action: "rps-commit",
    gameId: parseInt(gameId),
    move: moveLower,
    commitHash: hash,
    txHash,
    note: "Salt saved locally. Run rps-reveal when opponent has committed.",
  });
}

/** Reveal the committed move (loads the saved salt automatically) */
export async function rpsRevealCommand(gameId: string) {
  const myAddress = getAddress();
  const saved = loadSalt(`rps-${gameId}-${myAddress}`);
  if (!saved) {
    fail(
      `No saved salt for game ${gameId}. Did you commit with rps-commit first?`,
      "NO_SALT"
    );
    return; // TypeScript needs this even though fail() is never
  }

  const moveNum = MOVE_MAP[saved.value];

  const data = encodeFunctionData({
    abi: rpsGameAbi,
    functionName: "reveal",
    args: [BigInt(gameId), moveNum, saved.salt],
  });

  const { hash: txHash } = await sendTx({
    to: CONTRACTS.RPSGame as `0x${string}`,
    data,
  });

  ok({
    action: "rps-reveal",
    gameId: parseInt(gameId),
    move: saved.value,
    txHash,
  });
}
