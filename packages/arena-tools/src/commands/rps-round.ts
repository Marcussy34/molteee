// arena-tools rps-round — play one round of RPS with LLM-chosen move.
// Commits your move, waits for opponent to commit, reveals, waits for opponent
// to reveal, then returns the round result. The LLM decides the next move.
//
// Usage: npx arena-tools rps-round <game_id> <move>

import { encodeFunctionData, type Hex } from "viem";
import { CONTRACTS } from "../config.js";
import { rpsGameAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail, event } from "../utils/output.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2_000; // Reduced from 6s — WS transport avoids rate limits
const MAX_WAIT_MS = 300_000; // 5 minutes max wait per phase
const MAX_RETRIES = 8;
const RETRY_BASE_MS = 1_500;

// Move mapping (Solidity enum: 0=None, 1=Rock, 2=Paper, 3=Scissors)
const MOVE_MAP: Record<string, number> = { rock: 1, paper: 2, scissors: 3 };
const MOVE_NAMES: Record<number, string> = { 1: "Rock", 2: "Paper", 3: "Scissors" };

// Phase enums
const PHASE_COMMIT = 0;
const PHASE_REVEAL = 1;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ─── Retry wrapper ──────────────────────────────────────────────────────────

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") || msg.includes("fetch failed") || msg.includes("socket hang up");
}

async function retry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try { return await fn(); } catch (err: unknown) {
      if (isTransient(err) && attempt < MAX_RETRIES - 1) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 2000);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Exhausted ${MAX_RETRIES} retries for: ${label}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Determine round winner from moves ────────────────────────────────────

function roundWinner(p1Move: number, p2Move: number): "p1" | "p2" | "draw" {
  if (p1Move === p2Move) return "draw";
  // Rock(1) beats Scissors(3), Scissors(3) beats Paper(2), Paper(2) beats Rock(1)
  if ((p1Move === 1 && p2Move === 3) || (p1Move === 3 && p2Move === 2) || (p1Move === 2 && p2Move === 1)) return "p1";
  return "p2";
}

// ─── Main command ─────────────────────────────────────────────────────────

export async function rpsRoundCommand(gameId: string, move: string) {
  const client = getPublicClient();
  const myAddress = getAddress();
  const gid = BigInt(gameId);
  const addr = CONTRACTS.RPSGame as `0x${string}`;

  // Validate move
  const moveNum = MOVE_MAP[move.toLowerCase()];
  if (!moveNum) {
    fail(`Invalid move: ${move}. Must be rock, paper, or scissors.`, "INVALID_MOVE");
    return;
  }

  // Read game state
  const game: any = await retry(
    () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getGame", args: [gid] }),
    "getGame"
  );

  if (game.settled) {
    ok({
      gameId: Number(gid),
      gameComplete: true,
      p1Score: Number(game.p1Score),
      p2Score: Number(game.p2Score),
      message: "Game is already complete.",
    });
    return;
  }

  const isPlayer1 = (game.player1 as string).toLowerCase() === myAddress.toLowerCase();
  const round = Number(game.currentRound);
  const totalRounds = Number(game.totalRounds);

  // ── Step 1: Commit ──────────────────────────────────────────────────────

  const roundData: any = await retry(
    () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getRound", args: [gid, BigInt(round)] }),
    "getRound"
  );

  const myCommit = isPlayer1 ? roundData.p1Commit : roundData.p2Commit;
  const saltKey = `rpsround-${gameId}-${round}-${myAddress}`;

  if (Number(game.phase) === PHASE_COMMIT && myCommit === ZERO_BYTES32) {
    // Commit our move
    const salt = generateSalt();
    const hash = commitHash(moveNum, salt);

    const { hash: txHash } = await retry(
      () => sendTx({ to: addr, data: encodeFunctionData({ abi: rpsGameAbi, functionName: "commit", args: [gid, hash] }) }),
      "commit"
    );

    // Save salt for reveal
    saveSalt(saltKey, salt, JSON.stringify({ moveNum }), "rps-round");
    event({ event: "committed", round, move: MOVE_NAMES[moveNum], txHash });
  } else if (Number(game.phase) === PHASE_COMMIT) {
    event({ event: "already_committed", round });
  }

  // ── Step 2: Wait for opponent to commit (phase → Reveal) ──────────────

  const commitStart = Date.now();
  while (true) {
    if (Date.now() - commitStart > MAX_WAIT_MS) {
      fail("Timeout waiting for opponent to commit.", "OPPONENT_TIMEOUT");
      return;
    }

    const g: any = await retry(
      () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getGame", args: [gid] }),
      "poll-commit"
    );

    if (g.settled) {
      ok({ gameId: Number(gid), gameComplete: true, p1Score: Number(g.p1Score), p2Score: Number(g.p2Score), message: "Game settled." });
      return;
    }

    if (Number(g.phase) === PHASE_REVEAL) break;

    event({ event: "waiting", phase: "commit", message: "Waiting for opponent to commit..." });
    await sleep(POLL_INTERVAL_MS);
  }

  // ── Step 3: Reveal ────────────────────────────────────────────────────

  // Re-read round data to check if we already revealed
  const roundData2: any = await retry(
    () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getRound", args: [gid, BigInt(round)] }),
    "getRound-reveal"
  );

  const myRevealed = isPlayer1 ? roundData2.p1Revealed : roundData2.p2Revealed;

  if (!myRevealed) {
    // Load salt from disk
    const entry = loadSalt(saltKey);
    let salt: Hex;
    let storedMoveNum: number;

    if (entry) {
      salt = entry.salt;
      storedMoveNum = JSON.parse(entry.value).moveNum;
    } else {
      fail(`Salt not found for round ${round}. Cannot reveal.`, "SALT_LOST");
      return;
    }

    const { hash: txHash } = await retry(
      () => sendTx({ to: addr, data: encodeFunctionData({ abi: rpsGameAbi, functionName: "reveal", args: [gid, storedMoveNum, salt] }) }),
      "reveal"
    );
    event({ event: "revealed", round, move: MOVE_NAMES[storedMoveNum], txHash });
  } else {
    event({ event: "already_revealed", round });
  }

  // ── Step 4: Wait for opponent to reveal (round advances or game settles) ─

  const revealStart = Date.now();
  while (true) {
    if (Date.now() - revealStart > MAX_WAIT_MS) {
      fail("Timeout waiting for opponent to reveal.", "OPPONENT_TIMEOUT");
      return;
    }

    const g: any = await retry(
      () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getGame", args: [gid] }),
      "poll-reveal"
    );

    // Game settled — final result
    if (g.settled) {
      // Read final round data for move info
      const finalRound: any = await retry(
        () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getRound", args: [gid, BigInt(round)] }),
        "getRound-final"
      );

      const p1Move = Number(finalRound.p1Move);
      const p2Move = Number(finalRound.p2Move);
      const myMove = isPlayer1 ? p1Move : p2Move;
      const oppMove = isPlayer1 ? p2Move : p1Move;
      const winner = roundWinner(p1Move, p2Move);
      const myResult = winner === "draw" ? "draw" : (isPlayer1 ? winner === "p1" : winner === "p2") ? "win" : "loss";

      const p1Score = Number(g.p1Score);
      const p2Score = Number(g.p2Score);
      const myScore = isPlayer1 ? p1Score : p2Score;
      const oppScore = isPlayer1 ? p2Score : p1Score;
      const gameResult = myScore > oppScore ? "win" : myScore < oppScore ? "loss" : "draw";

      ok({
        round,
        totalRounds,
        yourMove: MOVE_NAMES[myMove],
        opponentMove: MOVE_NAMES[oppMove],
        roundResult: myResult,
        yourScore: myScore,
        opponentScore: oppScore,
        gameComplete: true,
        gameResult,
        message: `Game over! You ${gameResult} ${myScore}-${oppScore}.`,
      });
      return;
    }

    // Round advanced — this round is done
    if (Number(g.currentRound) > round) {
      const finalRound: any = await retry(
        () => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getRound", args: [gid, BigInt(round)] }),
        "getRound-result"
      );

      const p1Move = Number(finalRound.p1Move);
      const p2Move = Number(finalRound.p2Move);
      const myMove = isPlayer1 ? p1Move : p2Move;
      const oppMove = isPlayer1 ? p2Move : p1Move;
      const winner = roundWinner(p1Move, p2Move);
      const myResult = winner === "draw" ? "draw" : (isPlayer1 ? winner === "p1" : winner === "p2") ? "win" : "loss";

      const myScore = isPlayer1 ? Number(g.p1Score) : Number(g.p2Score);
      const oppScore = isPlayer1 ? Number(g.p2Score) : Number(g.p1Score);

      ok({
        round,
        totalRounds,
        yourMove: MOVE_NAMES[myMove],
        opponentMove: MOVE_NAMES[oppMove],
        roundResult: myResult,
        yourScore: myScore,
        opponentScore: oppScore,
        gameComplete: false,
        nextRound: Number(g.currentRound),
        message: `Round ${round} ${myResult}! Score: ${myScore}-${oppScore}. Choose your next move.`,
      });
      return;
    }

    event({ event: "waiting", phase: "reveal", message: "Waiting for opponent to reveal..." });
    await sleep(POLL_INTERVAL_MS);
  }
}
