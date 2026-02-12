// arena-tools poker-step — play one step of a Poker game with LLM-chosen action.
// Reads the current phase and acts accordingly:
//   - Commit phase: commits hand value, waits for opponent
//   - Betting phase: takes action (check/bet/raise/call/fold), waits for opponent or phase change
//   - Showdown: reveals hand, waits for opponent, returns result
//
// Usage:
//   npx arena-tools poker-step <game_id> <hand_value>              (commit phase)
//   npx arena-tools poker-step <game_id> check|bet|raise|call|fold [--amount N]  (betting)
//   npx arena-tools poker-step <game_id> reveal                    (showdown)
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { pokerGameAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, deleteSalt, commitHash } from "../utils/commit-reveal.js";
import { ok, fail, event } from "../utils/output.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2_000; // Reduced from 6s — WS transport avoids rate limits
const MAX_WAIT_MS = 300_000;
const MAX_RETRIES = 8;
const RETRY_BASE_MS = 1_500;

// Poker phases (match Solidity)
const PHASE_COMMIT = 0;
const POKER_BETTING1 = 1;
const POKER_BETTING2 = 2;
const POKER_SHOWDOWN = 3;
const PHASE_NAMES: Record<number, string> = {
    0: "commit", 1: "betting1", 2: "betting2", 3: "showdown",
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
    const game = await retry(() => client.readContract({ address: addr, abi: pokerGameAbi, functionName: "getGame", args: [gid] }), "getGame") as any;

    if (game.settled) {
        ok({
            gameId: Number(gid),
            gameComplete: true,
            message: "Game is already settled.",
        });
        return;
    }

    const isPlayer1 = game.player1.toLowerCase() === myAddress.toLowerCase();
    const phase = Number(game.phase);
    const phaseName = PHASE_NAMES[phase] || `unknown(${phase})`;

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

            const salt = generateSalt();
            const hash = commitHash(handValue, salt);
            const saltKey = `pokerstep-${gameId}-${myAddress}`;
            saveSalt(saltKey, salt, JSON.stringify({ handValue }), "poker-step");

            const { hash: txHash } = await retry(() => sendTx({ to: addr, data: encodeFunctionData({ abi: pokerGameAbi, functionName: "commitHand", args: [gid, hash] }) }), "commit");
            event({ event: "committed", handValue, txHash });
        }
        else {
            event({ event: "already_committed" });
        }

        // Wait for opponent to commit (phase transitions to betting1)
        const start = Date.now();
        while (true) {
            if (Date.now() - start > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent to commit.", "OPPONENT_TIMEOUT");
                return;
            }
            const g = await retry(() => client.readContract({ address: addr, abi: pokerGameAbi, functionName: "getGame", args: [gid] }), "poll-commit") as any;
            if (g.settled) {
                ok({ gameId: Number(gid), gameComplete: true, message: "Game settled." });
                return;
            }
            if (Number(g.phase) !== PHASE_COMMIT) {
                const isMyTurn = g.currentTurn.toLowerCase() === myAddress.toLowerCase();
                ok({
                    gameId: Number(gid),
                    phase: PHASE_NAMES[Number(g.phase)],
                    isYourTurn: isMyTurn,
                    pot: formatEther(g.pot),
                    currentBet: formatEther(g.currentBet),
                    gameComplete: false,
                    message: `Both committed. Betting round 1 started. ${isMyTurn ? "Your turn — choose check, bet, raise, call, or fold." : "Opponent's turn."}`,
                });
                return;
            }
            event({ event: "waiting", phase: "commit", message: "Waiting for opponent to commit..." });
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
                data: encodeFunctionData({ abi: pokerGameAbi, functionName: "takeAction", args: [gid, actionNum] }),
                value,
            }), `poker-${decision}`);
            event({ event: "action", action: decision.toLowerCase(), bettingRound: phase, txHash });
        }
        else {
            event({ event: "not_your_turn", message: "Waiting for opponent..." });
        }

        // Wait for state change (opponent's turn, next betting round, or showdown)
        const start = Date.now();
        const prevPhase = phase;
        while (true) {
            if (Date.now() - start > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent.", "OPPONENT_TIMEOUT");
                return;
            }
            const g = await retry(() => client.readContract({ address: addr, abi: pokerGameAbi, functionName: "getGame", args: [gid] }), "poll-betting") as any;
            if (g.settled) {
                ok({ gameId: Number(gid), gameComplete: true, message: "Game settled (opponent folded?)." });
                return;
            }
            const newPhase = Number(g.phase);
            const nowMyTurn = g.currentTurn.toLowerCase() === myAddress.toLowerCase();

            // Phase changed or it's our turn again
            if (newPhase !== prevPhase || nowMyTurn) {
                ok({
                    gameId: Number(gid),
                    phase: PHASE_NAMES[newPhase],
                    isYourTurn: nowMyTurn,
                    pot: formatEther(g.pot),
                    currentBet: formatEther(g.currentBet),
                    gameComplete: false,
                    message: newPhase === POKER_SHOWDOWN
                        ? "Showdown! Run poker-step with 'reveal' to reveal your hand."
                        : `${PHASE_NAMES[newPhase]} — ${nowMyTurn ? "Your turn." : "Opponent's turn."}`,
                });
                return;
            }
            event({ event: "waiting", phase: phaseName, message: "Waiting for opponent..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // ── SHOWDOWN PHASE ───────────────────────────────────────────────────
    if (phase === POKER_SHOWDOWN) {
        const myRevealed = isPlayer1 ? game.p1Revealed : game.p2Revealed;
        if (!myRevealed) {
            const saltKey = `pokerstep-${gameId}-${myAddress}`;
            const entry = loadSalt(saltKey);
            if (!entry) {
                fail("Salt not found for poker reveal.", "SALT_LOST");
                return;
            }
            const { handValue } = JSON.parse(entry.value);
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: pokerGameAbi, functionName: "revealHand", args: [gid, handValue, entry.salt] }),
            }), "reveal");
            // Only delete salt after successful reveal TX
            deleteSalt(saltKey);
            event({ event: "revealed", handValue, txHash });
        }
        else {
            event({ event: "already_revealed" });
        }

        // Wait for game to settle
        const start = Date.now();
        while (true) {
            if (Date.now() - start > MAX_WAIT_MS) {
                fail("Timeout waiting for opponent to reveal.", "OPPONENT_TIMEOUT");
                return;
            }
            const g = await retry(() => client.readContract({ address: addr, abi: pokerGameAbi, functionName: "getGame", args: [gid] }), "poll-showdown") as any;
            if (g.settled) {
                const myHand = isPlayer1 ? Number(g.p1HandValue) : Number(g.p2HandValue);
                const oppHand = isPlayer1 ? Number(g.p2HandValue) : Number(g.p1HandValue);
                const result = myHand > oppHand ? "win" : myHand < oppHand ? "loss" : "draw";
                ok({
                    gameId: Number(gid),
                    yourHandValue: myHand,
                    opponentHandValue: oppHand,
                    pot: formatEther(g.pot),
                    gameComplete: true,
                    gameResult: result,
                    message: `Game over! Your hand: ${myHand}, Opponent: ${oppHand}. Result: ${result}!`,
                });
                return;
            }
            event({ event: "waiting", phase: "showdown", message: "Waiting for opponent to reveal..." });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    // Unknown phase
    fail(`Unexpected phase: ${phase}`, "UNKNOWN_PHASE");
}
