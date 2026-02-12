// arena-tools create-tournament — create a new tournament on TournamentV2
import { encodeFunctionData, parseEther } from "viem";
import { CONTRACTS } from "../config.js";
import { tournamentV2Abi } from "../contracts.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";
// Map format names to uint8 values
const FORMAT_MAP = {
    "round-robin": 0,
    "double-elim": 1,
};
/** Create a tournament with the given format, entry fee, base wager, and max players */
export async function createTournamentCommand(format, maxPlayers, opts) {
    // Validate format
    const formatCode = FORMAT_MAP[format.toLowerCase()];
    if (formatCode === undefined) {
        fail(`Invalid format: ${format}. Must be round-robin or double-elim.`, "INVALID_FORMAT");
        return;
    }
    // Validate max players (4 or 8)
    const players = parseInt(maxPlayers, 10);
    if (players !== 4 && players !== 8) {
        fail(`Invalid max_players: ${maxPlayers}. Must be 4 or 8.`, "INVALID_PLAYERS");
        return;
    }
    const entryFeeWei = parseEther(opts.entryFee);
    const baseWagerWei = parseEther(opts.baseWager);
    const data = encodeFunctionData({
        abi: tournamentV2Abi,
        functionName: "createTournament",
        args: [formatCode, entryFeeWei, baseWagerWei, BigInt(players)],
    });
    const { hash, logs } = await sendTx({
        to: CONTRACTS.TournamentV2,
        data,
    });
    // Parse tournament ID from TournamentCreated event (first indexed topic)
    const createLog = logs.find((l) => l.address.toLowerCase() === CONTRACTS.TournamentV2.toLowerCase());
    const tournamentId = createLog ? Number(BigInt(createLog.topics[1])) : undefined;
    ok({
        action: "create-tournament",
        tournamentId,
        format,
        formatCode,
        maxPlayers: players,
        entryFee: opts.entryFee,
        baseWager: opts.baseWager,
        txHash: hash,
    });
}
//# sourceMappingURL=create-tournament.js.map