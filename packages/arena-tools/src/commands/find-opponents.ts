// arena-tools find-opponents — list open agents for a game type
import { formatEther } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS, GAME_TYPES } from "../config.js";
import { agentRegistryAbi } from "../contracts.js";
import { ok, fail } from "../utils/output.js";

export async function findOpponentsCommand(gameType: string) {
    const gt = gameType.toLowerCase();
    if (!(gt in GAME_TYPES)) {
        fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
    }

    const client = getPublicClient();
    const gameTypeId = GAME_TYPES[gt];

    // Get all open agents for this game type
    const agents = (await client.readContract({
        address: CONTRACTS.AgentRegistry,
        abi: agentRegistryAbi,
        functionName: "getOpenAgents",
        args: [gameTypeId],
    })) as any as string[];

    // Fetch details for each agent in parallel
    const details = await Promise.all(
        agents.map(async (addr: string) => {
            const [info, elo] = (await Promise.all([
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
                    args: [addr, gameTypeId],
                }),
            ])) as any;
            return {
                address: addr,
                elo: Number(elo),
                minWager: formatEther(info.minWager),
                maxWager: formatEther(info.maxWager),
            };
        })
    );

    ok({
        gameType: gt,
        count: details.length,
        agents: details,
    });
}
