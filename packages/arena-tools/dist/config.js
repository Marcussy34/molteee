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
export const RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
// WebSocket RPC — primary transport for lower latency and no polling rate limits
export const WS_RPC_URL = process.env.MONAD_WS_RPC_URL || "wss://testnet-rpc.monad.xyz";
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
// ─── Contract Addresses (hardcoded — immutable on-chain) ─────────────────────
export const CONTRACTS = {
    AgentRegistry: "0x96728e0962d7B3fA3B1c632bf489004803C165cE",
    Escrow: "0x6a52bd7fe53f022bb7c392de6285bfec2d7dd163",
    RPSGame: "0x4f66f4a355ea9a54fb1f39ec9be0e3281c2cf415",
    PokerGame: "0xb7b9741da4417852f42267fa1d295e399d11801c",
    AuctionGame: "0x1fc358c48e7523800eec9b0baed5f7c145e9e847",
    Tournament: "0xb9a2634e53ea9df280bb93195898b7166b2cadab",
    TournamentV2: "0x90a4facae37e8d98c36404055ab8f629be64b30e",
    PredictionMarket: "0xeb40a1f092e7e2015a39e4e5355a252b57440563",
};
// ─── Game type enum (matches Solidity) ──────────────────────────────────────
export const GAME_TYPES = { rps: 0, poker: 1, auction: 2 };
// ─── Game contract mapping ──────────────────────────────────────────────────
export const GAME_CONTRACTS = {
    rps: CONTRACTS.RPSGame,
    poker: CONTRACTS.PokerGame,
    auction: CONTRACTS.AuctionGame,
};
//# sourceMappingURL=config.js.map