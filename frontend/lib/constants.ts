// Re-export contract addresses from contracts.ts for convenience
export { ADDRESSES, monadChain, GameType, GAME_TYPE_LABELS } from "./contracts";

// Monad explorer base URL
export const EXPLORER_URL = "https://monadscan.com";

// ERC-8004 agent scanner
export const AGENT_SCAN_URL = "https://8004scan.io/agents/monad";

// Game type display config
export const GAME_CONFIG = {
  rps: { label: "RPS", icon: "RPS", color: "monad-purple" },
  poker: { label: "POKER", icon: "PKR", color: "neon-cyan" },
  auction: { label: "AUCTION", icon: "AUC", color: "neon-yellow" },
} as const;
