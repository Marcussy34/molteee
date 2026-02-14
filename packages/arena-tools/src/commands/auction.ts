// arena-tools auction-* — step-by-step Auction game commands
// auction-create: Create a new Auction game
// auction-commit: Commit a bid amount (validates bid ≤ wager before committing)
// auction-reveal: Reveal the committed bid
import { encodeFunctionData, parseEther, formatEther } from "viem";
import { CONTRACTS } from "../config.js";
import { auctionGameAbi, escrowAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, deleteSalt, commitBidHash } from "../utils/commit-reveal.js";
import { ok, fail } from "../utils/output.js";

/** Create a new Auction game for a match */
export async function auctionCreateCommand(matchId: string) {
    const data = encodeFunctionData({
        abi: auctionGameAbi,
        functionName: "createGame",
        args: [BigInt(matchId)],
    });

    const { hash, logs } = await sendTx({
        to: CONTRACTS.AuctionGame,
        data,
    });

    // Parse the game ID from the GameCreated event in tx logs
    let gameId = -1;
    for (const log of logs) {
        if (log.address.toLowerCase() === CONTRACTS.AuctionGame.toLowerCase() && log.topics.length > 1) {
            gameId = Number(BigInt(log.topics[1]));
            break;
        }
    }

    ok({
        action: "auction-create",
        matchId: parseInt(matchId),
        gameId,
        txHash: hash,
    });
}

/** Commit a bid amount (in MON).
 *  Validates bid ≤ match wager BEFORE committing to prevent unrevealable bids. */
export async function auctionCommitCommand(gameId: string, bid: string) {
    const bidWei = parseEther(bid);
    const client = getPublicClient();
    const gid = BigInt(gameId);

    // Fetch game state to get the escrow match ID, then fetch the wager
    const game = await client.readContract({
        address: CONTRACTS.AuctionGame,
        abi: auctionGameAbi,
        functionName: "getGame",
        args: [gid],
    }) as any;

    const match = await client.readContract({
        address: CONTRACTS.Escrow,
        abi: escrowAbi,
        functionName: "getMatch",
        args: [game.escrowMatchId],
    }) as any;

    const wager = match.wager;

    // Validate: bid must be > 0 and ≤ wager (contract enforces at reveal, but catch early)
    if (bidWei <= 0n) {
        fail(`Bid must be greater than 0. Got: ${bid} MON`, "INVALID_BID");
        return;
    }
    if (bidWei > wager) {
        fail(`Bid ${bid} MON exceeds match wager ${formatEther(wager)} MON. Bid must be ≤ wager.`, "BID_EXCEEDS_WAGER");
        return;
    }

    const salt = generateSalt();
    const hash = commitBidHash(bidWei, salt);

    // Save salt and bid for reveal (include wallet address to avoid collision)
    const myAddress = getAddress();
    saveSalt(`auction-${gameId}-${myAddress}`, salt, bid, "auction");

    const data = encodeFunctionData({
        abi: auctionGameAbi,
        functionName: "commitBid",
        args: [gid, hash],
    });

    const { hash: txHash } = await sendTx({
        to: CONTRACTS.AuctionGame,
        data,
    });

    ok({
        action: "auction-commit",
        gameId: parseInt(gameId),
        bid,
        maxBid: formatEther(wager),
        commitHash: hash,
        txHash,
    });
}

/** Reveal the committed bid */
export async function auctionRevealCommand(gameId: string) {
    const myAddress = getAddress();
    const saved = loadSalt(`auction-${gameId}-${myAddress}`);
    if (!saved) {
        fail(`No saved salt for auction game ${gameId}. Did you commit first?`, "NO_SALT");
        return;
    }

    const bidWei = parseEther(saved.value);
    const data = encodeFunctionData({
        abi: auctionGameAbi,
        functionName: "revealBid",
        args: [BigInt(gameId), bidWei, saved.salt],
    });

    const { hash: txHash } = await sendTx({
        to: CONTRACTS.AuctionGame,
        data,
    });

    // Only delete salt after successful reveal TX
    deleteSalt(`auction-${gameId}-${myAddress}`);

    ok({
        action: "auction-reveal",
        gameId: parseInt(gameId),
        bid: saved.value,
        txHash,
    });
}
