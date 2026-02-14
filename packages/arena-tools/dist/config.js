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
// Primary RPC (Alchemy) — higher reliability, but rate-limited on free tier
export const RPC_URL = process.env.MONAD_RPC_URL || "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB";
// WebSocket RPC — primary transport for lower latency and no polling rate limits
export const WS_RPC_URL = process.env.MONAD_WS_RPC_URL || "wss://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB";
// Fallback RPC (Monad public) — separate rate limit pool, used when Alchemy 429s
export const FALLBACK_RPC_URL = process.env.MONAD_FALLBACK_RPC_URL || "https://rpc.monad.xyz";
export const CHAIN_ID = 143;
export const CHAIN_NAME = "Monad";
export const EXPLORER_URL = "https://monadscan.com";
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
// ─── Contract Addresses (V5 deployment — Monad mainnet) ──────────────────────
export const CONTRACTS = {
    AgentRegistry: "0x88Ca39AE7b2e0fc3aA166DFf93561c71CF129b08",
    Escrow: "0x14C394b4042Fd047fD9226082684ED3F174eFD0C",
    RPSGame: "0xE05544220998684540be9DC8859bE9954A6E3B6a",
    PokerGame: "0xb08e06cF59EDB3aF1Cbf15EBB4EcE9c65876D91a", // PokerGameV2 (Budget Poker)
    AuctionGame: "0xC5058a75A5E7124F3dB5657C635EB7c3b8C84A3D",
    TournamentV2: "0xF1f333a4617186Cf10284Dc9d930f6082cf92A74",
    PredictionMarket: "0x4D845ae4B5d640181F0c1bAeCfd0722C792242C0",
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