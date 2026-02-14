#!/usr/bin/env npx tsx
/**
 * One-off script to query AgentRegistry.agentList and count registered agents.
 * Run: npx tsx scripts/check-agent-count.ts
 */

import { createPublicClient, http, defineChain } from "viem";

const monadTestnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_RPC_URL || "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB"] },
  },
});

const agentRegistryAbi = [
  {
    type: "function",
    name: "agentList",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

const AGENT_REGISTRY = "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101" as const;

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

async function main() {
  const addresses: string[] = [];
  for (let i = 0; i < 100; i++) {
    try {
      const addr = await client.readContract({
        address: AGENT_REGISTRY,
        abi: agentRegistryAbi,
        functionName: "agentList",
        args: [BigInt(i)],
      });
      addresses.push(addr as string);
    } catch {
      break;
    }
  }
  console.log(`AgentRegistry at ${AGENT_REGISTRY}`);
  console.log(`Registered agents: ${addresses.length}`);
  addresses.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
}

main().catch(console.error);
