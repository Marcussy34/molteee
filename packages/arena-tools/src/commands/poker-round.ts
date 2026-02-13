// arena-tools poker-round — play one full round of Budget Poker in a single invocation.
// Handles all 4 phases internally: Commit → Betting1 → Betting2 → Showdown.
// The agent decides hand value + betting strategy upfront; this command executes mechanically.
//
// Usage:
//   npx arena-tools poker-round <game_id> <hand_value> [--bet check|bet|fold] [--if-bet call|fold|raise] [--amount <MON>]
//
// Defaults: --bet check, --if-bet call (passive play — checks through, calls opponent bets)
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { pokerGameV2Abi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, deleteSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail, event } from "../utils/output.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 300_000; // 5 minutes max wait per phase
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

// ─── Betting action helper ──────────────────────────────────────────────────
// Executes a single betting action (check/bet/raise/call/fold) and returns true.
// If it's not our turn, returns false (caller should poll).
async function executeBettingAction(
    game: any, gid: bigint, addr: `0x${string}`, myAddress: string,
    betAction: string, ifBetAction: string, amount: string | undefined,
    currentRound: number, bettingPhase: number,
): Promise<boolean> {
    const isMyTurn = game.currentTurn.toLowerCase() === myAddress.toLowerCase();
    if (!isMyTurn) return false;

    // Decide which action to take based on whether there's an active bet
    const hasActiveBet = game.currentBet > 0n;
    const chosenAction = hasActiveBet ? ifBetAction : betAction;
    const actionNum = ACTION_MAP[chosenAction];

    if (actionNum === undefined) {
        fail(`Invalid betting action: ${chosenAction}`, "INVALID_ACTION");
        return true; // Signal we handled it (even though it's an error)
    }

    // Calculate value to send with the transaction
    let value = 0n;
    if (chosenAction === "bet" || chosenAction === "raise") {
        if (!amount) {
            fail(`${chosenAction} requires --amount <MON>.`, "MISSING_AMOUNT");
            return true;
        }
        value = parseEther(amount);
    }
    else if (chosenAction === "call") {
        value = game.currentBet;
    }

    const { hash: txHash } = await retry(() => sendTx({
        to: addr,
        data: encodeFunctionData({ abi: pokerGameV2Abi, functionName: "takeAction", args: [gid, actionNum] }),
        value,
    }), `poker-${chosenAction}`);
    event({ event: "action", action: chosenAction, round: currentRound, bettingRound: bettingPhase, txHash });
    return true;
}

// ─── Main command ─────────────────────────────────────────────────────────
export async function pokerRoundCommand(gameId: string, handValue: string, opts: any) {
    const client = getPublicClient();
    const myAddress = getAddress();
    const gid = BigInt(gameId);
    const addr = CONTRACTS.PokerGame;

    // Parse options with defaults
    const betAction = (opts.bet || "check").toLowerCase();
    const ifBetAction = (opts.ifBet || "call").toLowerCase();
    const amount: string | undefined = opts.amount;

    // Validate betting actions upfront
    if (!ACTION_MAP[betAction]) {
        fail(`Invalid --bet action: ${betAction}. Must be check, bet, or fold.`, "INVALID_BET");
        return;
    }
    if (!ACTION_MAP[ifBetAction]) {
        fail(`Invalid --if-bet action: ${ifBetAction}. Must be call, fold, or raise.`, "INVALID_IF_BET");
        return;
    }

    // Parse hand value
    const handVal = parseInt(handValue, 10);
    if (isNaN(handVal) || handVal < 1 || handVal > 100) {
        fail(`Hand value must be 1-100. Got: ${handValue}`, "INVALID_HAND");
        return;
    }

    // Read initial game state
    let game = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "getGame") as any;

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
    const currentRound = Number(game.currentRound);
    const totalRounds = Number(game.totalRounds);
    const myBudget = isPlayer1 ? Number(game.p1Budget) : Number(game.p2Budget);

    // ── PHASE 1: COMMIT ─────────────────────────────────────────────────────
    if (Number(game.phase) === PHASE_COMMIT) {
        const myCommitted = isPlayer1 ? game.p1Committed : game.p2Committed;
        const saltKey = `pokerround-${gameId}-${currentRound}-${myAddress}`;

        if (!myCommitted) {
            // Client-side budget check (contract enforces on reveal, but warn early)
            const roundsAfter = totalRounds - currentRound - 1;
            const maxHand = myBudget - roundsAfter;
            if (handVal > maxHand) {
                fail(`Hand value ${handVal} exceeds budget. Budget: ${myBudget}, must reserve ${roundsAfter} for future rounds (max: ${maxHand}).`, "EXCEEDS_BUDGET");
                return;
            }

            const salt = generateSalt();
            const hash = commitHash(handVal, salt);
            // Save salt with round-specific key + generic fallback key
            saveSalt(saltKey, salt, JSON.stringify({ handValue: handVal }), "poker-round");
            saveSalt(`pokerstep-${gameId}-${currentRound}-${myAddress}`, salt, JSON.stringify({ handValue: handVal }), "poker-round");

            const { hash: txHash } = await retry(() => sendTx({ to: addr, data: encodeFunctionData({ abi: pokerGameV2Abi, functionName: "commitHand", args: [gid, hash] }) }), "commit");
            event({ event: "committed", round: currentRound, handValue: handVal, budget: myBudget, txHash });
        }
        else {
            event({ event: "already_committed", round: currentRound });
        }

        // Wait for opponent to commit (phase transitions past COMMIT)
        const commitStart = Date.now();
        while (true) {
            if (Date.now() - commitStart > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent to commit.", "OPPONENT_TIMEOUT");
                return;
            }
            game = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-commit") as any;
            if (game.settled) {
                ok({ gameId: Number(gid), gameComplete: true, p1Score: Number(game.p1Score), p2Score: Number(game.p2Score), message: "Game settled." });
                return;
            }
            if (Number(game.phase) !== PHASE_COMMIT) break;
            event({ event: "waiting", phase: "commit", round: currentRound, message: "Waiting for opponent to commit..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // ── PHASE 2: BETTING1 ───────────────────────────────────────────────────
    if (Number(game.phase) === POKER_BETTING1) {
        // Try to act, then poll until phase changes
        const acted = await executeBettingAction(game, gid, addr, myAddress, betAction, ifBetAction, amount, currentRound, POKER_BETTING1);
        if (!acted) {
            event({ event: "not_your_turn", phase: "betting1", round: currentRound, message: "Opponent's turn in Betting1..." });
        }

        // Poll until phase advances past Betting1 (or game settles/round changes)
        const bet1Start = Date.now();
        while (true) {
            if (Date.now() - bet1Start > MAX_WAIT_MS) {
                fail("Timeout waiting for Betting1 to complete.", "OPPONENT_TIMEOUT");
                return;
            }
            game = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-betting1") as any;
            if (game.settled) {
                ok({ gameId: Number(gid), gameComplete: true, p1Score: Number(game.p1Score), p2Score: Number(game.p2Score), message: "Game settled (fold or timeout)." });
                return;
            }
            // Round changed (fold advanced the round)
            if (Number(game.currentRound) !== currentRound) {
                return returnRoundResult(game, gid, currentRound, totalRounds, isPlayer1);
            }
            const newPhase = Number(game.phase);
            // Phase advanced past Betting1
            if (newPhase > POKER_BETTING1) break;
            // Still in Betting1 — check if it's our turn again (opponent acted, back to us)
            const isMyTurn = game.currentTurn.toLowerCase() === myAddress.toLowerCase();
            if (isMyTurn) {
                await executeBettingAction(game, gid, addr, myAddress, betAction, ifBetAction, amount, currentRound, POKER_BETTING1);
            }
            else {
                event({ event: "waiting", phase: "betting1", round: currentRound, message: "Waiting for opponent..." });
            }
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // ── PHASE 3: BETTING2 ───────────────────────────────────────────────────
    if (Number(game.phase) === POKER_BETTING2) {
        const acted = await executeBettingAction(game, gid, addr, myAddress, betAction, ifBetAction, amount, currentRound, POKER_BETTING2);
        if (!acted) {
            event({ event: "not_your_turn", phase: "betting2", round: currentRound, message: "Opponent's turn in Betting2..." });
        }

        // Poll until phase advances past Betting2
        const bet2Start = Date.now();
        while (true) {
            if (Date.now() - bet2Start > MAX_WAIT_MS) {
                fail("Timeout waiting for Betting2 to complete.", "OPPONENT_TIMEOUT");
                return;
            }
            game = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-betting2") as any;
            if (game.settled) {
                ok({ gameId: Number(gid), gameComplete: true, p1Score: Number(game.p1Score), p2Score: Number(game.p2Score), message: "Game settled (fold or timeout)." });
                return;
            }
            if (Number(game.currentRound) !== currentRound) {
                return returnRoundResult(game, gid, currentRound, totalRounds, isPlayer1);
            }
            const newPhase = Number(game.phase);
            if (newPhase > POKER_BETTING2) break;
            // Still in Betting2 — act if it's our turn
            const isMyTurn = game.currentTurn.toLowerCase() === myAddress.toLowerCase();
            if (isMyTurn) {
                await executeBettingAction(game, gid, addr, myAddress, betAction, ifBetAction, amount, currentRound, POKER_BETTING2);
            }
            else {
                event({ event: "waiting", phase: "betting2", round: currentRound, message: "Waiting for opponent..." });
            }
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // ── PHASE 4: SHOWDOWN ───────────────────────────────────────────────────
    if (Number(game.phase) === POKER_SHOWDOWN) {
        const myRevealed = isPlayer1 ? game.p1Revealed : game.p2Revealed;
        const saltKey = `pokerround-${gameId}-${currentRound}-${myAddress}`;
        const fallbackKey = `pokerstep-${gameId}-${currentRound}-${myAddress}`;

        if (!myRevealed) {
            // Try our salt key first, then fallback to poker-step key
            const entry = loadSalt(saltKey) || loadSalt(fallbackKey);
            if (!entry) {
                fail(`Salt not found for round ${currentRound}. Cannot reveal.`, "SALT_LOST");
                return;
            }
            const { handValue: storedHandValue } = JSON.parse(entry.value);

            // Reveal with graceful retry (same pattern as rps-round)
            let revealed = false;
            for (let revealAttempt = 0; revealAttempt < 3; revealAttempt++) {
                try {
                    const { hash: txHash } = await retry(() => sendTx({
                        to: addr,
                        data: encodeFunctionData({ abi: pokerGameV2Abi, functionName: "revealHand", args: [gid, storedHandValue, entry.salt] }),
                    }), "reveal");
                    // Only delete salt after successful reveal
                    deleteSalt(saltKey);
                    deleteSalt(fallbackKey);
                    event({ event: "revealed", round: currentRound, handValue: storedHandValue, txHash });
                    revealed = true;
                    break;
                }
                catch (err: any) {
                    // Re-read game state to decide if we should retry or bail
                    const gCheck = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "getGame-after-revert") as any;
                    if (gCheck.settled || Number(gCheck.currentRound) > currentRound) {
                        event({ event: "reveal_skipped", round: currentRound, reason: "state_advanced" });
                        revealed = true;
                        break;
                    }
                    if (Number(gCheck.phase) === POKER_SHOWDOWN && revealAttempt < 2) {
                        event({ event: "reveal_retry", round: currentRound, attempt: revealAttempt + 1, error: err instanceof Error ? err.message : String(err) });
                        await sleep(3_000);
                        continue;
                    }
                    fail(`Reveal failed after ${revealAttempt + 1} attempts: ${err instanceof Error ? err.message : String(err)}`, "REVEAL_FAILED");
                    return;
                }
            }
        }
        else {
            event({ event: "already_revealed", round: currentRound });
        }

        // Wait for opponent to reveal (round advances or game settles)
        const revealStart = Date.now();
        while (true) {
            if (Date.now() - revealStart > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent to reveal.", "OPPONENT_TIMEOUT");
                return;
            }
            game = await retry(() => client.readContract({ address: addr, abi: pokerGameV2Abi, functionName: "getGame", args: [gid] }), "poll-showdown") as any;

            // Game settled — final result
            if (game.settled) {
                const myScore = isPlayer1 ? Number(game.p1Score) : Number(game.p2Score);
                const oppScore = isPlayer1 ? Number(game.p2Score) : Number(game.p1Score);
                const result = myScore > oppScore ? "win" : myScore < oppScore ? "loss" : "draw";
                ok({
                    gameId: Number(gid),
                    round: currentRound,
                    totalRounds,
                    p1Score: Number(game.p1Score),
                    p2Score: Number(game.p2Score),
                    p1Budget: Number(game.p1Budget),
                    p2Budget: Number(game.p2Budget),
                    gameComplete: true,
                    gameResult: result,
                    message: `Game over! Score: ${myScore}-${oppScore}. Result: ${result}!`,
                });
                return;
            }

            // Round advanced — this round is done, game continues
            if (Number(game.currentRound) > currentRound) {
                return returnRoundResult(game, gid, currentRound, totalRounds, isPlayer1);
            }

            event({ event: "waiting", phase: "showdown", round: currentRound, message: "Waiting for opponent to reveal..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // If we get here, we're in an unexpected phase — just report state
    fail(`Unexpected phase: ${Number(game.phase)} (${PHASE_NAMES[Number(game.phase)] || "unknown"})`, "UNKNOWN_PHASE");
}

// ─── Helper: return result when round advances ─────────────────────────────
function returnRoundResult(game: any, gid: bigint, playedRound: number, totalRounds: number, isPlayer1: boolean) {
    const myScore = isPlayer1 ? Number(game.p1Score) : Number(game.p2Score);
    const oppScore = isPlayer1 ? Number(game.p2Score) : Number(game.p1Score);
    const myBudget = isPlayer1 ? Number(game.p1Budget) : Number(game.p2Budget);
    const oppBudget = isPlayer1 ? Number(game.p2Budget) : Number(game.p1Budget);
    ok({
        gameId: Number(gid),
        round: playedRound,
        totalRounds,
        yourScore: myScore,
        opponentScore: oppScore,
        yourBudget: myBudget,
        opponentBudget: oppBudget,
        p1Score: Number(game.p1Score),
        p2Score: Number(game.p2Score),
        p1Budget: Number(game.p1Budget),
        p2Budget: Number(game.p2Budget),
        gameComplete: false,
        nextRound: Number(game.currentRound),
        message: `Round ${playedRound} done. Score: ${myScore}-${oppScore}. Budgets: ${myBudget} vs ${oppBudget}. Next: round ${Number(game.currentRound)}.`,
    });
}
