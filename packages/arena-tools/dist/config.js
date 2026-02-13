// Environment configuration for the arena CLI.
// Loads from env vars and .env files. Only PRIVATE_KEY is needed for write ops.
import { config as dotenvConfig } from "dotenv";
import path from "path";
// Load .env from CWD (agent's working directory) and parent dirs
dotenvConfig({ path: path.resolve(process.cwd(), ".env") });
dotenvConfig({ path: path.resolve(process.cwd(), ".env.local") });
// Also check parent directory (for monorepo setups where .env is at root)
dotenvConfig({ path: path.resolve(process.cwd(), "..", ".env") });
dotenvConfig({ path: path.resolve(process.cwd(), "..", "..", ".env") });
// ─── Network ─────────────────────────────────────────────────────────────────
export const RPC_URL = process.env.MONAD_RPC_URL || "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3";
// WebSocket RPC — primary transport for lower latency and no polling rate limits
export const WS_RPC_URL = process.env.MONAD_WS_RPC_URL || "wss://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3";
export const CHAIN_ID = 10143;
export const CHAIN_NAME = "Monad Testnet";
export const EXPLORER_URL = "https://testnet.monadexplorer.com";
// ─── Wallet (optional — only needed for write commands) ──────────────────────
export function getPrivateKey() {
    // Check common env var names for private key
    const key = process.env.PRIVATE_KEY ||
        process.env.DEPLOYER_PRIVATE_KEY ||
        process.env.WALLET_PRIVATE_KEY;
    if (!key) {
        throw new Error("PRIVATE_KEY env var required for write operations. " +
            "Also checks DEPLOYER_PRIVATE_KEY and WALLET_PRIVATE_KEY. " +
            "Set it in your environment or .env file.");
    }
    // Ensure 0x prefix
    const prefixed = key.startsWith("0x") ? key : `0x${key}`;
    return prefixed;
}
// ─── Contract Addresses (V5 deployment — Monad testnet) ──────────────────────
export const CONTRACTS = {
    AgentRegistry: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101",
    Escrow: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E",
    RPSGame: "0xCe117380073c1B425273cf0f3cB098eb6e54F147",
    PokerGame: "0x2Ad3a193F88f93f3B06121aF530ee626c50aD113", // PokerGameV2 (Budget Poker)
    AuctionGame: "0x0Cd3cfAFDEb25a446e1fa7d0476c5B224913fC15",
    TournamentV2: "0xECcbb759CD3642333D8E8D91350a40D8E02aBe65",
    PredictionMarket: "0xf38C7642a6B21220404c886928DcD6783C33c2b1",
};
// ─── Derive wallet address from private key (for read commands) ─────────────
import { privateKeyToAccount } from "viem/accounts";
export function getAddressFromKey() {
    const key = process.env.PRIVATE_KEY ||
        process.env.DEPLOYER_PRIVATE_KEY ||
        process.env.WALLET_PRIVATE_KEY;
    if (!key)
        return null;
    const prefixed = key.startsWith("0x") ? key : `0x${key}`;
    return privateKeyToAccount(prefixed).address;
}
// ─── Game type enum (matches Solidity) ──────────────────────────────────────
export const GAME_TYPES = { rps: 0, poker: 1, auction: 2 };
// ─── Game contract mapping ──────────────────────────────────────────────────
export const GAME_CONTRACTS = {
    rps: CONTRACTS.RPSGame,
    poker: CONTRACTS.PokerGame,
    auction: CONTRACTS.AuctionGame,
};
//# sourceMappingURL=config.js.map