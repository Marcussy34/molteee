// arena-tools join-tournament — register for a tournament
import { encodeFunctionData } from "viem";
import { CONTRACTS } from "../config.js";
import { tournamentV2Abi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { ok } from "../utils/output.js";

export async function joinTournamentCommand(tournamentId: string) {
    const client = getPublicClient();
    const id = BigInt(tournamentId);
    const address = getAddress();

    // Get tournament to know entry fee
    const tournament = (await client.readContract({
        address: CONTRACTS.TournamentV2,
        abi: tournamentV2Abi,
        functionName: "getTournament",
        args: [id],
    })) as any;

    const data = encodeFunctionData({
        abi: tournamentV2Abi,
        functionName: "register",
        args: [id],
    });

    const { hash } = await sendTx({
        to: CONTRACTS.TournamentV2,
        data,
        value: tournament.entryFee,
    });

    ok({
        action: "join-tournament",
        tournamentId: Number(id),
        address,
        entryFee: tournament.entryFee.toString(),
        txHash: hash,
    });
}
