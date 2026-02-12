// arena-tools status — wallet balance, registration, ELO
import { formatEther, getAddress as checksumAddress } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS, GAME_TYPES } from "../config.js";
import { agentRegistryAbi } from "../contracts.js";
import { ok } from "../utils/output.js";

export async function statusCommand(address: string) {
    const client = getPublicClient();
    // Normalize to checksummed address (handles mixed-case input)
    const addr = checksumAddress(address);

    // Fetch balance and agent info in parallel
    const [balance, agentInfo, rpsElo, pokerElo, auctionElo] = await Promise.all([
        client.getBalance({ address: addr }),
        client.readContract({
            address: CONTRACTS.AgentRegistry,
            abi: agentRegistryAbi,
            functionName: "getAgent",
            args: [addr],
        }),
        client.readContract({
            address: CONTRACTS.AgentRegistry,
            abi: agentRegistryAbi,
            functionName: "elo",
            args: [addr, GAME_TYPES.rps],
        }),
        client.readContract({
            address: CONTRACTS.AgentRegistry,
            abi: agentRegistryAbi,
            functionName: "elo",
            args: [addr, GAME_TYPES.poker],
        }),
        client.readContract({
            address: CONTRACTS.AgentRegistry,
            abi: agentRegistryAbi,
            functionName: "elo",
            args: [addr, GAME_TYPES.auction],
        }),
    ]) as any;

    // Map game type numbers to names
    const gameTypeNames = ["rps", "poker", "auction"];
    const registeredGames = agentInfo.gameTypes.map((t: number) => gameTypeNames[t] || `unknown(${t})`);

    ok({
        address: addr,
        balance: formatEther(balance),
        balanceWei: balance.toString(),
        registered: agentInfo.exists,
        isOpen: agentInfo.isOpen,
        gameTypes: registeredGames,
        minWager: formatEther(agentInfo.minWager),
        maxWager: formatEther(agentInfo.maxWager),
        elo: {
            rps: Number(rpsElo),
            poker: Number(pokerElo),
            auction: Number(auctionElo),
        },
    });
}
