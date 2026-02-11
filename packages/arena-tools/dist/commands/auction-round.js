// arena-tools auction-round — play a full auction round with LLM-chosen bid.
// Commits bid, waits for opponent, reveals, waits, returns result.
//
// Usage: npx arena-tools auction-round <game_id> <bid_in_MON>
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { auctionGameAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitBidHash } from "../utils/commit-reveal.js";
import { ok, fail, event } from "../utils/output.js";
// ─── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2_000; // Reduced from 6s — WS transport avoids rate limits
const MAX_WAIT_MS = 300_000;
const MAX_RETRIES = 8;
const RETRY_BASE_MS = 1_500;
const PHASE_COMMIT = 0;
const PHASE_REVEAL = 1;
// ─── Retry wrapper ──────────────────────────────────────────────────────────
function isTransient(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNRESET") || msg.includes("fetch failed") || msg.includes("socket hang up");
}
async function retry(fn, label) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
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
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
// ─── Main command ─────────────────────────────────────────────────────────
export async function auctionRoundCommand(gameId, bid) {
    const client = getPublicClient();
    const myAddress = getAddress();
    const gid = BigInt(gameId);
    const addr = CONTRACTS.AuctionGame;
    const bidWei = parseEther(bid);
    // Read game state
    const game = await retry(() => client.readContract({ address: addr, abi: auctionGameAbi, functionName: "getGame", args: [gid] }), "getGame");
    if (game.settled) {
        ok({ gameId: Number(gid), gameComplete: true, message: "Game is already settled." });
        return;
    }
    const isPlayer1 = game.player1.toLowerCase() === myAddress.toLowerCase();
    const phase = Number(game.phase);
    // ── Step 1: Commit ──────────────────────────────────────────────────────
    const myCommitted = isPlayer1 ? game.p1Committed : game.p2Committed;
    if (phase === PHASE_COMMIT && !myCommitted) {
        const salt = generateSalt();
        const hash = commitBidHash(bidWei, salt);
        const saltKey = `auctionround-${gameId}-${myAddress}`;
        saveSalt(saltKey, salt, JSON.stringify({ bidWei: bidWei.toString() }), "auction-round");
        const { hash: txHash } = await retry(() => sendTx({ to: addr, data: encodeFunctionData({ abi: auctionGameAbi, functionName: "commitBid", args: [gid, hash] }) }), "commit");
        event({ event: "committed", bid, txHash });
    }
    else if (phase === PHASE_COMMIT) {
        event({ event: "already_committed" });
    }
    // ── Step 2: Wait for opponent to commit ──────────────────────────────
    const commitStart = Date.now();
    while (true) {
        if (Date.now() - commitStart > MAX_WAIT_MS) {
            fail("Timeout waiting for opponent to commit.", "OPPONENT_TIMEOUT");
            return;
        }
        const g = await retry(() => client.readContract({ address: addr, abi: auctionGameAbi, functionName: "getGame", args: [gid] }), "poll-commit");
        if (g.settled) {
            ok({ gameId: Number(gid), gameComplete: true, message: "Game settled." });
            return;
        }
        if (Number(g.phase) === PHASE_REVEAL)
            break;
        event({ event: "waiting", phase: "commit", message: "Waiting for opponent to commit..." });
        await sleep(POLL_INTERVAL_MS);
    }
    // ── Step 3: Reveal ────────────────────────────────────────────────────
    // Re-read to check if we already revealed
    const game2 = await retry(() => client.readContract({ address: addr, abi: auctionGameAbi, functionName: "getGame", args: [gid] }), "getGame-reveal");
    const myRevealed = isPlayer1 ? game2.p1Revealed : game2.p2Revealed;
    if (!myRevealed) {
        const saltKey = `auctionround-${gameId}-${myAddress}`;
        const entry = loadSalt(saltKey);
        if (!entry) {
            fail("Salt not found for auction reveal.", "SALT_LOST");
            return;
        }
        const storedBid = BigInt(JSON.parse(entry.value).bidWei);
        const { hash: txHash } = await retry(() => sendTx({
            to: addr,
            data: encodeFunctionData({ abi: auctionGameAbi, functionName: "revealBid", args: [gid, storedBid, entry.salt] }),
        }), "reveal");
        event({ event: "revealed", bid: formatEther(storedBid), txHash });
    }
    else {
        event({ event: "already_revealed" });
    }
    // ── Step 4: Wait for opponent to reveal and game to settle ───────────
    const revealStart = Date.now();
    while (true) {
        if (Date.now() - revealStart > MAX_WAIT_MS) {
            fail("Timeout waiting for opponent to reveal.", "OPPONENT_TIMEOUT");
            return;
        }
        const g = await retry(() => client.readContract({ address: addr, abi: auctionGameAbi, functionName: "getGame", args: [gid] }), "poll-reveal");
        if (g.settled) {
            const myBid = isPlayer1 ? g.p1Bid : g.p2Bid;
            const oppBid = isPlayer1 ? g.p2Bid : g.p1Bid;
            const myBidMON = formatEther(myBid);
            const oppBidMON = formatEther(oppBid);
            const result = myBid > oppBid ? "win" : myBid < oppBid ? "loss" : "draw";
            ok({
                gameId: Number(gid),
                yourBid: myBidMON,
                opponentBid: oppBidMON,
                prize: formatEther(g.prize),
                gameComplete: true,
                gameResult: result,
                message: `Auction over! Your bid: ${myBidMON} MON, Opponent: ${oppBidMON} MON. You ${result}!`,
            });
            return;
        }
        event({ event: "waiting", phase: "reveal", message: "Waiting for opponent to reveal..." });
        await sleep(POLL_INTERVAL_MS);
    }
}
//# sourceMappingURL=auction-round.js.map