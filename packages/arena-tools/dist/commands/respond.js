// arena-tools respond — accept a match and play the entire game in one blocking call.
// Streams JSONL events for each step so LLM agents can follow progress.
//
// Architecture: State-machine loop. Every iteration reads on-chain state, decides
// the ONE action to take, executes it, then loops. Never assumes state transitions —
// always re-reads. All RPC calls retry on transient errors (429, timeout).
//
// Usage: npx arena-tools respond <match_id> [--rounds 3] [--timeout 600]
import { encodeFunctionData, formatEther } from "viem";
import { CONTRACTS, GAME_CONTRACTS } from "../config.js";
import { escrowAbi, rpsGameAbi, pokerGameAbi, auctionGameAbi, } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitHash, commitBidHash } from "../utils/commit-reveal.js";
import { event, ok, fail } from "../utils/output.js";
// ─── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2_000; // Reduced from 8s — WS transport avoids rate limits
const GAME_CREATION_WAIT_MS = 20_000; // Wait for opponent to create game before we do
const MAX_RETRIES = 8; // Retry count for transient RPC errors
const RETRY_BASE_MS = 1_500; // Base backoff for retries (doubles each attempt + jitter)
// RPS move values (match Solidity enum: 0=None, 1=Rock, 2=Paper, 3=Scissors)
const RPS_MOVES = [1, 2, 3];
const RPS_MOVE_NAMES = { 1: "Rock", 2: "Paper", 3: "Scissors" };
// Poker action values
const POKER_CHECK = 1;
const POKER_CALL = 4;
// Phase enums (match Solidity)
const PHASE_COMMIT = 0;
const PHASE_REVEAL = 1;
// Poker-specific phases
const POKER_BETTING1 = 1;
const POKER_BETTING2 = 2;
const POKER_SHOWDOWN = 3;
// Match status
const MATCH_CREATED = 0;
const MATCH_ACTIVE = 1;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
// ─── Retry wrapper — the core resilience layer ──────────────────────────────
// Every RPC call goes through this. Retries on 429, timeout, and network errors.
function isTransient(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return (msg.includes("429") ||
        msg.includes("Too Many Requests") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNRESET") ||
        msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("socket hang up"));
}
async function retry(fn, label = "") {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            if (isTransient(err) && attempt < MAX_RETRIES - 1) {
                // Exponential backoff + random jitter to desync competing agents
                const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 2000);
                event({ event: "retry", attempt: attempt + 1, backoffMs: backoff, label });
                await sleep(backoff);
                continue;
            }
            throw err;
        }
    }
    throw new Error(`Exhausted ${MAX_RETRIES} retries for: ${label}`);
}
// ─── Helpers ────────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function checkTimeout(startTime, timeoutMs) {
    if (Date.now() - startTime > timeoutMs) {
        fail("Overall timeout exceeded — aborting.", "TIMEOUT");
    }
}
function gameTypeFromAddress(addr) {
    const lower = addr.toLowerCase();
    for (const [name, contractAddr] of Object.entries(GAME_CONTRACTS)) {
        if (contractAddr.toLowerCase() === lower)
            return name;
    }
    return null;
}
function gameContractAddr(gameType) {
    return ({ rps: CONTRACTS.RPSGame, poker: CONTRACTS.PokerGame, auction: CONTRACTS.AuctionGame })[gameType];
}
// ─── Main respond command ───────────────────────────────────────────────────
export async function respondCommand(matchId, opts) {
    const client = getPublicClient();
    const myAddress = getAddress();
    const id = BigInt(matchId);
    const rounds = parseInt(opts.rounds || "3");
    const timeoutMs = parseInt(opts.timeout || "600") * 1000;
    const startTime = Date.now();
    // ── Phase A: Ensure match is Active ─────────────────────────────────────
    const match = await retry(() => client.readContract({ address: CONTRACTS.Escrow, abi: escrowAbi, functionName: "getMatch", args: [id] }), "getMatch");
    const status = Number(match.status);
    if (status !== MATCH_CREATED && status !== MATCH_ACTIVE) {
        fail(`Match ${matchId} status is ${status} (need 0=Created or 1=Active).`, "INVALID_STATUS");
    }
    const gameType = gameTypeFromAddress(match.gameContract);
    if (!gameType) {
        fail(`Unknown game contract ${match.gameContract}.`, "UNKNOWN_GAME");
        return;
    }
    const wagerWei = match.wager;
    const isPlayer1 = match.player1.toLowerCase() === myAddress.toLowerCase();
    // Accept if needed, or wait for acceptance if we're the challenger
    if (status === MATCH_CREATED) {
        if (match.player2.toLowerCase() === myAddress.toLowerCase()) {
            // We're player2 — accept the match
            const { hash: txHash } = await retry(() => sendTx({
                to: CONTRACTS.Escrow,
                data: encodeFunctionData({ abi: escrowAbi, functionName: "acceptMatch", args: [id] }),
                value: wagerWei,
            }), "acceptMatch");
            event({ event: "accepted", matchId: Number(id), wager: formatEther(wagerWei), txHash });
        }
        else if (isPlayer1) {
            // We're player1 (challenger) — wait for opponent to accept
            event({ event: "waiting", message: "Waiting for opponent to accept match..." });
            while (true) {
                checkTimeout(startTime, timeoutMs);
                await sleep(POLL_INTERVAL_MS);
                const updated = await retry(() => client.readContract({ address: CONTRACTS.Escrow, abi: escrowAbi, functionName: "getMatch", args: [id] }), "poll-match-status");
                if (Number(updated.status) === MATCH_ACTIVE) {
                    event({ event: "opponent_accepted", matchId: Number(id) });
                    break;
                }
            }
        }
        else {
            fail(`Match ${matchId} is not for ${myAddress}.`, "WRONG_PLAYER");
        }
    }
    else {
        event({ event: "already_active", matchId: Number(id), wager: formatEther(wagerWei) });
    }
    // ── Phase B: Find or create game ────────────────────────────────────────
    const contractAddr = gameContractAddr(gameType);
    let gameId = await findGame(client, contractAddr, gameType, id);
    if (gameId === null) {
        event({ event: "waiting", message: "Waiting for opponent to create game..." });
        const waitEnd = Date.now() + GAME_CREATION_WAIT_MS;
        while (Date.now() < waitEnd && gameId === null) {
            checkTimeout(startTime, timeoutMs);
            await sleep(POLL_INTERVAL_MS);
            gameId = await findGame(client, contractAddr, gameType, id);
        }
    }
    if (gameId === null) {
        gameId = await createGame(client, gameType, id, rounds, contractAddr);
        event({ event: "game_created", gameId: Number(gameId), gameType, rounds: gameType === "rps" ? rounds : 1 });
    }
    else {
        event({ event: "game_found", gameId: Number(gameId), gameType });
    }
    // ── Phase C: Play the game (state machine loop) ─────────────────────────
    if (gameType === "rps") {
        await rpsLoop(client, gameId, contractAddr, isPlayer1, startTime, timeoutMs);
    }
    else if (gameType === "poker") {
        await pokerLoop(client, gameId, contractAddr, isPlayer1, wagerWei, startTime, timeoutMs);
    }
    else {
        await auctionLoop(client, gameId, contractAddr, isPlayer1, wagerWei, startTime, timeoutMs);
    }
    // ── Phase D: Report result ──────────────────────────────────────────────
    const finalMatch = await retry(() => client.readContract({ address: CONTRACTS.Escrow, abi: escrowAbi, functionName: "getMatch", args: [id] }), "getMatch-final");
    let winner = "0x0000000000000000000000000000000000000000";
    try {
        winner = (await retry(() => client.readContract({ address: CONTRACTS.Escrow, abi: escrowAbi, functionName: "winners", args: [id] }), "getWinner"));
    }
    catch { /* not set yet */ }
    const isWinner = winner.toLowerCase() === myAddress.toLowerCase();
    event({ event: "match_complete", matchId: Number(id), winner, result: isWinner ? "win" : "loss" });
    ok({
        action: "respond",
        matchId: Number(id),
        gameType,
        gameId: Number(gameId),
        result: isWinner ? "win" : "loss",
        winner,
        wager: formatEther(wagerWei),
    });
}
// ═════════════════════════════════════════════════════════════════════════════
// RPS STATE MACHINE
// Each iteration: read state → decide action → execute → sleep → repeat
// ═════════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpsLoop(client, gameId, addr, isPlayer1, startTime, timeoutMs) {
    while (true) {
        checkTimeout(startTime, timeoutMs);
        // 1. Read game state
        const game = await retry(() => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getGame", args: [gameId] }), "rps-getGame");
        // 2. Check if done
        if (game.settled) {
            event({ event: "game_settled", gameId: Number(gameId), p1Score: Number(game.p1Score), p2Score: Number(game.p2Score) });
            return;
        }
        const round = Number(game.currentRound);
        const phase = Number(game.phase);
        // 3. Read round data
        const roundData = await retry(() => client.readContract({ address: addr, abi: rpsGameAbi, functionName: "getRound", args: [gameId, BigInt(round)] }), "rps-getRound");
        const myCommit = isPlayer1 ? roundData.p1Commit : roundData.p2Commit;
        const myRevealed = isPlayer1 ? roundData.p1Revealed : roundData.p2Revealed;
        // 4. Decide action based on state
        if (phase === PHASE_COMMIT && myCommit === ZERO_BYTES32) {
            // ACTION: We need to commit a move
            const moveNum = randomChoice(RPS_MOVES);
            const salt = generateSalt();
            const hash = commitHash(moveNum, salt);
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: rpsGameAbi, functionName: "commit", args: [gameId, hash] }),
            }), "rps-commit");
            // Save salt (memory + disk)
            storeSalt(`rps-${gameId}-${round}`, { salt, moveNum });
            event({ event: "committed", round, move: RPS_MOVE_NAMES[moveNum], txHash });
        }
        else if (phase === PHASE_COMMIT) {
            // We committed, waiting for opponent
            event({ event: "status", round, phase: "commit", message: "Waiting for opponent to commit..." });
        }
        else if (phase === PHASE_REVEAL && !myRevealed) {
            // ACTION: We need to reveal
            const stored = loadStoredSalt(`rps-${gameId}-${round}`);
            if (!stored) {
                fail(`Lost salt for round ${round}. Cannot reveal. Game is unrecoverable.`, "SALT_LOST");
                return;
            }
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: rpsGameAbi, functionName: "reveal", args: [gameId, stored.moveNum, stored.salt] }),
            }), "rps-reveal");
            event({ event: "revealed", round, move: RPS_MOVE_NAMES[stored.moveNum], txHash });
        }
        else if (phase === PHASE_REVEAL) {
            // We revealed, waiting for opponent
            event({ event: "status", round, phase: "reveal", message: "Waiting for opponent to reveal..." });
        }
        else {
            // Unknown state — log it
            event({ event: "status", round, phase, message: "Waiting for state change..." });
        }
        // 5. Sleep before next read
        await sleep(POLL_INTERVAL_MS);
    }
}
// ═════════════════════════════════════════════════════════════════════════════
// POKER STATE MACHINE
// ═════════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pokerLoop(client, gameId, addr, isPlayer1, wagerWei, startTime, timeoutMs) {
    while (true) {
        checkTimeout(startTime, timeoutMs);
        const game = await retry(() => client.readContract({ address: addr, abi: pokerGameAbi, functionName: "getGame", args: [gameId] }), "poker-getGame");
        if (game.settled) {
            event({ event: "game_settled", gameId: Number(gameId), gameType: "poker" });
            return;
        }
        const phase = Number(game.phase);
        const myCommitted = isPlayer1 ? game.p1Committed : game.p2Committed;
        const myRevealed = isPlayer1 ? game.p1Revealed : game.p2Revealed;
        const isMyTurn = game.currentTurn.toLowerCase() === getAddress().toLowerCase();
        if (phase === PHASE_COMMIT && !myCommitted) {
            // ACTION: Commit a hand value
            const handValue = Math.floor(Math.random() * 100) + 1;
            const salt = generateSalt();
            const hash = commitHash(handValue, salt);
            storeSalt(`poker-${gameId}`, { salt, handValue });
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: pokerGameAbi, functionName: "commitHand", args: [gameId, hash] }),
            }), "poker-commit");
            event({ event: "committed", gameType: "poker", handValue, txHash });
        }
        else if (phase === PHASE_COMMIT) {
            event({ event: "status", phase: "commit", message: "Waiting for opponent to commit hand..." });
        }
        else if ((phase === POKER_BETTING1 || phase === POKER_BETTING2) && isMyTurn) {
            // ACTION: Take betting action — check or call
            const currentBet = BigInt(game.currentBet);
            const action = currentBet > 0n ? POKER_CALL : POKER_CHECK;
            const actionName = currentBet > 0n ? "call" : "check";
            const value = action === POKER_CALL ? currentBet : 0n;
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: pokerGameAbi, functionName: "takeAction", args: [gameId, action] }),
                value,
            }), `poker-${actionName}`);
            event({ event: "action", gameType: "poker", action: actionName, bettingRound: phase, txHash });
        }
        else if (phase === POKER_BETTING1 || phase === POKER_BETTING2) {
            event({ event: "status", phase: `betting${phase}`, message: "Waiting for opponent's turn..." });
        }
        else if (phase === POKER_SHOWDOWN && !myRevealed) {
            // ACTION: Reveal hand
            const stored = loadStoredSalt(`poker-${gameId}`);
            if (!stored) {
                fail("Lost salt for poker reveal. Game is unrecoverable.", "SALT_LOST");
                return;
            }
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: pokerGameAbi, functionName: "revealHand", args: [gameId, stored.handValue, stored.salt] }),
            }), "poker-reveal");
            event({ event: "revealed", gameType: "poker", handValue: stored.handValue, txHash });
        }
        else if (phase === POKER_SHOWDOWN) {
            event({ event: "status", phase: "showdown", message: "Waiting for opponent to reveal..." });
        }
        else {
            event({ event: "status", phase, message: "Waiting for state change..." });
        }
        await sleep(POLL_INTERVAL_MS);
    }
}
// ═════════════════════════════════════════════════════════════════════════════
// AUCTION STATE MACHINE
// ═════════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function auctionLoop(client, gameId, addr, isPlayer1, wagerWei, startTime, timeoutMs) {
    while (true) {
        checkTimeout(startTime, timeoutMs);
        const game = await retry(() => client.readContract({ address: addr, abi: auctionGameAbi, functionName: "getGame", args: [gameId] }), "auction-getGame");
        if (game.settled) {
            event({ event: "game_settled", gameId: Number(gameId), gameType: "auction" });
            return;
        }
        const phase = Number(game.phase);
        const myCommitted = isPlayer1 ? game.p1Committed : game.p2Committed;
        const myRevealed = isPlayer1 ? game.p1Revealed : game.p2Revealed;
        if (phase === PHASE_COMMIT && !myCommitted) {
            // ACTION: Commit a bid (~55-65% of wager)
            const bidPercent = 55 + Math.floor(Math.random() * 11);
            const bidWei = (wagerWei * BigInt(bidPercent)) / 100n;
            const salt = generateSalt();
            const hash = commitBidHash(bidWei, salt);
            storeSalt(`auction-${gameId}`, { salt, bidWei: bidWei.toString() });
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: auctionGameAbi, functionName: "commitBid", args: [gameId, hash] }),
            }), "auction-commit");
            event({ event: "committed", gameType: "auction", bidMON: formatEther(bidWei), bidPercent, txHash });
        }
        else if (phase === PHASE_COMMIT) {
            event({ event: "status", phase: "commit", message: "Waiting for opponent to commit bid..." });
        }
        else if (phase === PHASE_REVEAL && !myRevealed) {
            // ACTION: Reveal bid
            const stored = loadStoredSalt(`auction-${gameId}`);
            if (!stored) {
                fail("Lost salt for auction reveal. Game is unrecoverable.", "SALT_LOST");
                return;
            }
            // bidWei stored as string, convert back to bigint
            const bidWei = BigInt(stored.bidWei);
            const { hash: txHash } = await retry(() => sendTx({
                to: addr,
                data: encodeFunctionData({ abi: auctionGameAbi, functionName: "revealBid", args: [gameId, bidWei, stored.salt] }),
            }), "auction-reveal");
            event({ event: "revealed", gameType: "auction", bidMON: formatEther(bidWei), txHash });
        }
        else if (phase === PHASE_REVEAL) {
            event({ event: "status", phase: "reveal", message: "Waiting for opponent to reveal bid..." });
        }
        else {
            event({ event: "status", phase, message: "Waiting for state change..." });
        }
        await sleep(POLL_INTERVAL_MS);
    }
}
// ═════════════════════════════════════════════════════════════════════════════
// GAME DISCOVERY
// ═════════════════════════════════════════════════════════════════════════════
const nextGameIdAbi = [
    { name: "nextGameId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findGame(client, contractAddr, gameType, matchId) {
    const abi = gameType === "rps" ? rpsGameAbi : gameType === "poker" ? pokerGameAbi : auctionGameAbi;
    let nextId;
    try {
        nextId = (await retry(() => client.readContract({ address: contractAddr, abi: nextGameIdAbi, functionName: "nextGameId" }), "nextGameId"));
    }
    catch {
        return null;
    }
    // Scan backwards (recent games first, max 50)
    const start = Number(nextId) - 1;
    const end = Math.max(0, start - 50);
    for (let i = start; i >= end; i--) {
        try {
            const game = await client.readContract({
                address: contractAddr, abi, functionName: "getGame", args: [BigInt(i)],
            });
            if (BigInt(game.escrowMatchId) === matchId)
                return BigInt(i);
        }
        catch {
            continue;
        }
    }
    return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createGame(client, gameType, matchId, rounds, contractAddr) {
    // Read nextGameId before creating — that will be our game's ID
    const beforeId = (await retry(() => client.readContract({ address: contractAddr, abi: nextGameIdAbi, functionName: "nextGameId" }), "nextGameId-pre"));
    let data;
    if (gameType === "rps") {
        data = encodeFunctionData({ abi: rpsGameAbi, functionName: "createGame", args: [matchId, BigInt(rounds)] });
    }
    else if (gameType === "poker") {
        data = encodeFunctionData({ abi: pokerGameAbi, functionName: "createGame", args: [matchId] });
    }
    else {
        data = encodeFunctionData({ abi: auctionGameAbi, functionName: "createGame", args: [matchId] });
    }
    await retry(() => sendTx({ to: contractAddr, data }), "createGame");
    return beforeId;
}
// ═════════════════════════════════════════════════════════════════════════════
// SALT STORAGE — in-memory primary, disk backup for process restarts
// Keys include wallet address to avoid collisions on shared machines.
// ═════════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoryStore = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeSalt(key, value) {
    memoryStore[key] = value;
    // Persist to disk with wallet-scoped key
    if (value.salt) {
        const diskKey = `respond-${key}-${getAddress()}`;
        saveSalt(diskKey, value.salt, JSON.stringify(value), "respond");
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadStoredSalt(key) {
    // Memory first
    if (memoryStore[key])
        return memoryStore[key];
    // Disk fallback (process restart recovery)
    const diskKey = `respond-${key}-${getAddress()}`;
    const entry = loadSalt(diskKey);
    if (entry) {
        try {
            const parsed = JSON.parse(entry.value);
            memoryStore[key] = parsed;
            return parsed;
        }
        catch {
            return null;
        }
    }
    return null;
}
//# sourceMappingURL=respond.js.map