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
export function getPrivateKey(): `0x${string}` {
    // Check common env var names for private key
    const key =
        process.env.PRIVATE_KEY ||
        process.env.DEPLOYER_PRIVATE_KEY ||
        process.env.WALLET_PRIVATE_KEY;
    if (!key) {
        throw new Error(
            "PRIVATE_KEY env var required for write operations. " +
            "Also checks DEPLOYER_PRIVATE_KEY and WALLET_PRIVATE_KEY. " +
            "Set it in your environment or .env file."
        );
    }
    // Ensure 0x prefix
    const prefixed = key.startsWith("0x") ? key : `0x${key}`;
    return prefixed as `0x${string}`;
}

// ─── Contract Addresses (V5 deployment — hardcoded, immutable on-chain) ──────
export const CONTRACTS: Record<string, `0x${string}`> = {
    AgentRegistry: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101",
    Escrow: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E",
    RPSGame: "0xCe117380073c1B425273cf0f3cB098eb6e54F147",
    PokerGame: "0x63fF00026820eeBCF6f7FF4eE9C2629Bf914a509",
    AuctionGame: "0x0Cd3cfAFDEb25a446e1fa7d0476c5B224913fC15",
    Tournament: "0x58707EaCCA8f19a5051e0e50dde4cb109E3bAC7f",
    TournamentV2: "0xECcbb759CD3642333D8E8D91350a40D8E02aBe65",
    PredictionMarket: "0xf38C7642a6B21220404c886928DcD6783C33c2b1",
};

// ─── Game type enum (matches Solidity) ──────────────────────────────────────
export const GAME_TYPES: Record<string, number> = { rps: 0, poker: 1, auction: 2 };

// ─── Game contract mapping ──────────────────────────────────────────────────
export const GAME_CONTRACTS: Record<string, `0x${string}`> = {
    rps: CONTRACTS.RPSGame,
    poker: CONTRACTS.PokerGame,
    auction: CONTRACTS.AuctionGame,
};
