// Known agent address → name mapping.
// Loaded from data/agents.json at build time + known bot addresses.
// Fallback: truncated address.

import agentsData from "@/data/agents.json";

// Build lookup map from agents.json
const NAME_MAP: Record<string, string> = {};
for (const agent of agentsData) {
  NAME_MAP[agent.address.toLowerCase()] = agent.name;
}

// Additional known addresses (real deployed bots on Monad)
const EXTRA_NAMES: Record<string, string> = {
  "0x88ca39ae7b2e0fc3aa166dff93561c71cf129b08": "AgentRegistry",
  "0x14c394b4042fd047fd9226082684ed3f174efd0c": "Escrow",
};

// Merge extras (don't overwrite agents.json entries)
for (const [addr, name] of Object.entries(EXTRA_NAMES)) {
  if (!NAME_MAP[addr]) NAME_MAP[addr] = name;
}

/**
 * Get a human-readable name for an address.
 * Returns the known name if available, otherwise a truncated address.
 */
export function getAgentName(address: string): string {
  return NAME_MAP[address.toLowerCase()] || truncateAddress(address);
}

/**
 * Truncate an address to 0x1234...abcd format
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
