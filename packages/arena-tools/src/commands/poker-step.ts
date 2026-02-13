// arena-tools poker-step — play one step of a Budget Poker game (V2).
// Reads the current phase and acts accordingly:
//   - Commit phase: commits hand value, waits for opponent
//   - Betting phase: takes action (check/bet/raise/call/fold), waits for opponent or phase change
//   - Showdown: reveals hand, waits for opponent or next round
//
// Budget Poker specifics:
//   - 3 rounds, 150-point hand budget
//   - Budget deducted on reveal only (fold = no deduction)
//   - After showdown, game may advance to next round or settle
//
// Usage:
//   npx arena-tools poker-step <game_id> <hand_value>              (commit phase)
//   npx arena-tools poker-step <game_id> check|bet|raise|call|fold [--amount N]  (betting)
//   npx arena-tools poker-step <game_id> reveal                    (showdown)
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { pokerGameV2Abi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, deleteSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail, event } from "../utils/output.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 300_000;
const MAX_RETRIES = 8;
const RETRY_BASE_MS = 1_500;

// Poker V2 phases (match Solidity)
const PHASE_COMMIT = 0;
const POKER_BETTING1 = 1;
const POKER_BETTING2 = 2;
const POKER_SHOWDOWN = 3;
const PHASE_NAMES: Record<number, string> = {
    0: "commit", 1: "betting1", 2: "betting2", 3: "showdown", 4: "complete",
};

// Poker actions (match Solidity enum)
const ACTION_MAP: Record<string, number> = {
    check: 1, bet: 2, raise: 3, call: 4, fold: 5,
};

// ─── Retry wrapper ──────────────────────────────────────────────────────────
function isTransient(err: any): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNRESET") || msg.includes("fetch failed") || msg.includes("socket hang up");
}

async function retry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        }
        catch (err: any) {
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

// ─── Main command ─────────────────────────────────────────────────────────
export async function pokerStepCommand(gameId: string, decision: string, opts: any) {
    const client = getPublicClient();
    const myAddress = getAddress();
    const gid = BigInt(gameId);
    const addr = CONTRACTS.PokerGame;

    // Read game state
    const game = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "getGame") as any;

    if (game.settled) {
        ok({
            gameId: Number(gid),
            gameComplete: true,
            p1Score: Number(game.p1Score),
            p2Score: Number(game.p2Score),
            message: "Game is already settled.",
        });
        return;
    }

    const isPlayer1 = game.player1.toLowerCase() === myAddress.toLowerCase();
    const phase = Number(game.phase);
    const phaseName = PHASE_NAMES[phase] || `unknown(${phase})`;
    const currentRound = Number(game.currentRound);
    const myBudget = isPlayer1 ? Number(game.p1Budget) : Number(game.p2Budget);
    const oppBudget = isPlayer1 ? Number(game.p2Budget) : Number(game.p1Budget);

    // ── COMMIT PHASE ─────────────────────────────────────────────────────
    if (phase === PHASE_COMMIT) {
        const myCommitted = isPlayer1 ? game.p1Committed : game.p2Committed;
        if (!myCommitted) {
            // Parse hand value
            const handValue = parseInt(decision, 10);
            if (isNaN(handValue) || handValue < 1 || handValue > 100) {
                fail(`During commit phase, provide a hand value 1-100. Got: ${decision}`, "INVALID_HAND");
                return;
            }

            // Client-side budget check (contract enforces on reveal, but warn early)
            const totalRounds = Number(game.totalRounds);
            const roundsAfter = totalRounds - currentRound - 1;
            const maxHand = myBudget - roundsAfter;
            if (handValue > maxHand) {
                fail(`Hand value ${handValue} exceeds budget. You have ${myBudget} points, need to reserve ${roundsAfter} for future rounds (max: ${maxHand}).`, "EXCEEDS_BUDGET");
                return;
            }

            const salt = generateSalt();
            const hash = commitHash(handValue, salt);
            // Salt key includes round number to support multi-round
            const saltKey = `pokerstep-${gameId}-${currentRound}-${myAddress}`;
            saveSalt(saltKey, salt, JSON.stringify({ handValue }), "poker-step");

            const { hash: txHash } = await retry(() => sendTx({ to: addr, data: encodeFunctionData({ abi: pokerGameV2Abi, functionName: "commitHand", args: [gid, hash] }) }), "commit");
            event({ event: "committed", round: currentRound, handValue, budget: myBudget, txHash });
        }
        else {
            event({ event: "already_committed", round: currentRound });
        }

        // Wait for opponent to commit (phase transitions to betting1)
        const start = Date.now();
        while (true) {
            if (Date.now() - start > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent to commit.", "OPPONENT_TIMEOUT");
                return;
            }
            const g = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-commit") as any;
            if (g.settled) {
                ok({ gameId: Number(gid), gameComplete: true, p1Score: Number(g.p1Score), p2Score: Number(g.p2Score), message: "Game settled." });
                return;
            }
            if (Number(g.phase) !== PHASE_COMMIT) {
                const isMyTurn = g.currentTurn.toLowerCase() === myAddress.toLowerCase();
                ok({
                    gameId: Number(gid),
                    round: Number(g.currentRound),
                    totalRounds: Number(g.totalRounds),
                    p1Score: Number(g.p1Score),
                    p2Score: Number(g.p2Score),
                    p1Budget: Number(g.p1Budget),
                    p2Budget: Number(g.p2Budget),
                    phase: PHASE_NAMES[Number(g.phase)],
                    isYourTurn: isMyTurn,
                    currentBet: formatEther(g.currentBet),
                    gameComplete: false,
                    message: `Round ${Number(g.currentRound) + 1}/3 — Betting started. ${isMyTurn ? "Your turn." : "Opponent's turn."}`,
                });
                return;
            }
            event({ event: "waiting", phase: "commit", round: currentRound, message: "Waiting for opponent to commit..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // ── BETTING PHASE ────────────────────────────────────────────────────
    if (phase === POKER_BETTING1 || phase === POKER_BETTING2) {
        const isMyTurn = game.currentTurn.toLowerCase() === myAddress.toLowerCase();
        if (isMyTurn) {
            const actionNum = ACTION_MAP[decision.toLowerCase()];
            if (actionNum === undefined) {
                fail(`During betting, provide an action: check, bet, raise, call, or fold. Got: ${decision}`, "INVALID_ACTION");
                return;
            }
            // For bet/raise, need an amount
            let value = 0n;
            if (decision.toLowerCase() === "bet" || decision.toLowerCase() === "raise") {
                if (!opts.amount) {
                    fail(`${decision} requires --amount <MON>.`, "MISSING_AMOUNT");
                    return;
                }
                value = parseEther(opts.amount);
            }
            else if (decision.toLowerCase() === "call") {
                value = game.currentBet;
            }

            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: pokerGameV2Abi, functionName: "takeAction", args: [gid, actionNum] }),
                value,
            }), `poker-${decision}`);
            event({ event: "action", action: decision.toLowerCase(), round: currentRound, bettingRound: phase, txHash });
        }
        else {
            event({ event: "not_your_turn", round: currentRound, message: "Waiting for opponent..." });
        }

        // Wait for state change (opponent's turn, next betting round, showdown, or fold settlement)
        const start = Date.now();
        const prevPhase = phase;
        while (true) {
            if (Date.now() - start > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent.", "OPPONENT_TIMEOUT");
                return;
            }
            const g = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-betting") as any;
            if (g.settled) {
                ok({
                    gameId: Number(gid),
                    gameComplete: true,
                    p1Score: Number(g.p1Score),
                    p2Score: Number(g.p2Score),
                    message: "Game settled (fold or timeout).",
                });
                return;
            }
            const newPhase = Number(g.phase);
            const newRound = Number(g.currentRound);
            const nowMyTurn = g.currentTurn.toLowerCase() === myAddress.toLowerCase();

            // Fold can advance rounds — check if round changed
            if (newRound !== currentRound) {
                ok({
                    gameId: Number(gid),
                    round: newRound,
                    totalRounds: Number(g.totalRounds),
                    p1Score: Number(g.p1Score),
                    p2Score: Number(g.p2Score),
                    p1Budget: Number(g.p1Budget),
                    p2Budget: Number(g.p2Budget),
                    phase: PHASE_NAMES[newPhase],
                    gameComplete: false,
                    message: `Round ${newRound + 1}/3 started. Score: ${Number(g.p1Score)}-${Number(g.p2Score)}.`,
                });
                return;
            }

            // Phase changed or it's our turn again
            if (newPhase !== prevPhase || nowMyTurn) {
                ok({
                    gameId: Number(gid),
                    round: currentRound,
                    totalRounds: Number(g.totalRounds),
                    p1Score: Number(g.p1Score),
                    p2Score: Number(g.p2Score),
                    p1Budget: Number(g.p1Budget),
                    p2Budget: Number(g.p2Budget),
                    phase: PHASE_NAMES[newPhase],
                    isYourTurn: nowMyTurn,
                    currentBet: formatEther(g.currentBet),
                    gameComplete: false,
                    message: newPhase === POKER_SHOWDOWN
                        ? "Showdown! Run poker-step with 'reveal' to reveal your hand."
                        : `${PHASE_NAMES[newPhase]} — ${nowMyTurn ? "Your turn." : "Opponent's turn."}`,
                });
                return;
            }
            event({ event: "waiting", phase: phaseName, round: currentRound, message: "Waiting for opponent..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // ── SHOWDOWN PHASE ───────────────────────────────────────────────────
    if (phase === POKER_SHOWDOWN) {
        const myRevealed = isPlayer1 ? game.p1Revealed : game.p2Revealed;
        if (!myRevealed) {
            // Salt key includes round number
            const saltKey = `pokerstep-${gameId}-${currentRound}-${myAddress}`;
            const entry = loadSalt(saltKey);
            if (!entry) {
                fail("Salt not found for poker reveal.", "SALT_LOST");
                return;
            }
            const { handValue } = JSON.parse(entry.value);
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: pokerGameV2Abi, functionName: "revealHand", args: [gid, handValue, entry.salt] }),
            }), "reveal");
            // Only delete salt after successful reveal
            deleteSalt(saltKey);
            event({ event: "revealed", round: currentRound, handValue, budget: myBudget - handValue, txHash });
        }
        else {
            event({ event: "already_revealed", round: currentRound });
        }

        // Wait for game to settle or advance to next round
        const start = Date.now();
        while (true) {
            if (Date.now() - start > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent to reveal.", "OPPONENT_TIMEOUT");
                return;
            }
            const g = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-showdown") as any;
            if (g.settled) {
                const myScore = isPlayer1 ? Number(g.p1Score) : Number(g.p2Score);
                const oppScore = isPlayer1 ? Number(g.p2Score) : Number(g.p1Score);
                const result = myScore > oppScore ? "win" : myScore < oppScore ? "loss" : "draw";
                ok({
                    gameId: Number(gid),
                    p1Score: Number(g.p1Score),
                    p2Score: Number(g.p2Score),
                    p1Budget: Number(g.p1Budget),
                    p2Budget: Number(g.p2Budget),
                    gameComplete: true,
                    gameResult: result,
                    message: `Game over! Score: ${Number(g.p1Score)}-${Number(g.p2Score)}. Result: ${result}!`,
                });
                return;
            }
            // Check if round advanced (means this round resolved, game continues)
            const newRound = Number(g.currentRound);
            if (newRound !== currentRound) {
                ok({
                    gameId: Number(gid),
                    round: newRound,
                    totalRounds: Number(g.totalRounds),
                    p1Score: Number(g.p1Score),
                    p2Score: Number(g.p2Score),
                    p1Budget: Number(g.p1Budget),
                    p2Budget: Number(g.p2Budget),
                    phase: PHASE_NAMES[Number(g.phase)],
                    gameComplete: false,
                    message: `Round ${currentRound + 1} resolved. Score: ${Number(g.p1Score)}-${Number(g.p2Score)}. Round ${newRound + 1}/3 starting.`,
                });
                return;
            }
            event({ event: "waiting", phase: "showdown", round: currentRound, message: "Waiting for opponent to reveal..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // Unknown phase
    fail(`Unexpected phase: ${phase}`, "UNKNOWN_PHASE");
}
