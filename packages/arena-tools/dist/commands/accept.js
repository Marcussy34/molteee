// arena-tools accept — accept an escrow match
import { encodeFunctionData } from "viem";
import { CONTRACTS } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";
export async function acceptCommand(matchId) {
    const client = getPublicClient();
    const id = BigInt(matchId);
    const address = getAddress();
    // Get match details to know the wager
    const match = await client.readContract({
        address: CONTRACTS.Escrow,
        abi: escrowAbi,
        functionName: "getMatch",
        args: [id],
    });
    if (match.status !== 0) {
        fail(`Match ${matchId} is not in Created status (current: ${match.status})`, "INVALID_STATUS");
    }
    const data = encodeFunctionData({
        abi: escrowAbi,
        functionName: "acceptMatch",
        args: [id],
    });
    const { hash } = await sendTx({
        to: CONTRACTS.Escrow,
        data,
        value: match.wager,
    });
    ok({
        action: "accept",
        matchId: Number(id),
        player1: match.player1,
        player2: address,
        wager: match.wager.toString(),
        txHash: hash,
    });
}
//# sourceMappingURL=accept.js.map