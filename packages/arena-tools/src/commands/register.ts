// arena-tools register — register on AgentRegistry for game types
import { encodeFunctionData, parseEther } from "viem";
import { CONTRACTS, GAME_TYPES, type GameTypeName } from "../config.js";
import { agentRegistryAbi } from "../contracts.js";
import { getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";

export async function registerCommand(
  gameTypes: string,
  opts: { minWager?: string; maxWager?: string }
) {
  // Parse game types: "rps,poker,auction" → [0, 1, 2]
  const types = gameTypes.split(",").map((t) => {
    const gt = t.trim().toLowerCase() as GameTypeName;
    if (!(gt in GAME_TYPES)) {
      fail(`Invalid game type: ${t}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
    }
    return GAME_TYPES[gt];
  });

  const minWager = parseEther(opts.minWager || "0.001");
  const maxWager = parseEther(opts.maxWager || "1.0");
  const address = getAddress();

  const data = encodeFunctionData({
    abi: agentRegistryAbi,
    functionName: "register",
    args: [types, minWager, maxWager],
  });

  const { hash, gasUsed } = await sendTx({
    to: CONTRACTS.AgentRegistry as `0x${string}`,
    data,
  });

  ok({
    action: "register",
    address,
    gameTypes: gameTypes.split(",").map((t) => t.trim().toLowerCase()),
    minWager: opts.minWager || "0.001",
    maxWager: opts.maxWager || "1.0",
    txHash: hash,
    gasUsed: gasUsed.toString(),
  });
}
