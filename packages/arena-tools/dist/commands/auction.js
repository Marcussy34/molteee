// arena-tools auction-* — step-by-step Auction game commands
// auction-create: Create a new Auction game
// auction-commit: Commit a bid amount
// auction-reveal: Reveal the committed bid
import { encodeFunctionData, parseEther } from "viem";
import { CONTRACTS } from "../config.js";
import { auctionGameAbi } from "../contracts.js";
import { getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { generateSalt, saveSalt, loadSalt, commitBidHash } from "../utils/commit-reveal.js";
import { ok, fail } from "../utils/output.js";
/** Create a new Auction game for a match */
export async function auctionCreateCommand(matchId) {
    const data = encodeFunctionData({
        abi: auctionGameAbi,
        functionName: "createGame",
        args: [BigInt(matchId)],
    });
    const { hash } = await sendTx({
        to: CONTRACTS.AuctionGame,
        data,
    });
    ok({
        action: "auction-create",
        matchId: parseInt(matchId),
        txHash: hash,
    });
}
/** Commit a bid amount (in MON) */
export async function auctionCommitCommand(gameId, bid) {
    const bidWei = parseEther(bid);
    const salt = generateSalt();
    const hash = commitBidHash(bidWei, salt);
    // Save salt and bid for reveal (include wallet address to avoid collision)
    const myAddress = getAddress();
    saveSalt(`auction-${gameId}-${myAddress}`, salt, bid, "auction");
    const data = encodeFunctionData({
        abi: auctionGameAbi,
        functionName: "commitBid",
        args: [BigInt(gameId), hash],
    });
    const { hash: txHash } = await sendTx({
        to: CONTRACTS.AuctionGame,
        data,
    });
    ok({
        action: "auction-commit",
        gameId: parseInt(gameId),
        bid,
        commitHash: hash,
        txHash,
    });
}
/** Reveal the committed bid */
export async function auctionRevealCommand(gameId) {
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
    ok({
        action: "auction-reveal",
        gameId: parseInt(gameId),
        bid: saved.value,
        txHash,
    });
}
//# sourceMappingURL=auction.js.map