// arena-tools get-match — single match details
import { formatEther } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { ok } from "../utils/output.js";
const STATUS_NAMES = ["Created", "Active", "Settled", "Cancelled"];
export async function getMatchCommand(matchId) {
    const client = getPublicClient();
    const id = BigInt(matchId);
    const [match, winner] = await Promise.all([
        client.readContract({
            address: CONTRACTS.Escrow,
            abi: escrowAbi,
            functionName: "getMatch",
            args: [id],
        }),
        client.readContract({
            address: CONTRACTS.Escrow,
            abi: escrowAbi,
            functionName: "winners",
            args: [id],
        }),
    ]);
    ok({
        matchId: Number(id),
        player1: match.player1,
        player2: match.player2,
        wager: formatEther(match.wager),
        gameContract: match.gameContract,
        status: STATUS_NAMES[match.status] || `Unknown(${match.status})`,
        statusCode: Number(match.status),
        createdAt: Number(match.createdAt),
        winner: winner,
    });
}
//# sourceMappingURL=get-match.js.map