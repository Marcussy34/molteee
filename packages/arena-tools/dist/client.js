// Viem client setup — public client for reads, wallet client for writes.
import { createPublicClient, createWalletClient, http, webSocket, fallback, defineChain, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL, WS_RPC_URL, FALLBACK_RPC_URL, CHAIN_ID, CHAIN_NAME, getPrivateKey } from "./config.js";
// Define Monad chain
export const monadChain = defineChain({
    id: CHAIN_ID,
    name: CHAIN_NAME,
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: {
        default: { http: [RPC_URL], webSocket: [WS_RPC_URL] },
    },
    blockExplorers: {
        default: {
            name: "Monad Explorer",
            url: "https://monadscan.com",
        },
    },
});
// Retry config for 429 rate limit errors — exponential backoff
const retryOpts = { retryCount: 3, retryDelay: 1500 };
// Transport priority: WS (lowest latency) → Alchemy HTTP → Monad public HTTP (separate rate limit pool)
// If Alchemy 429s, viem's fallback auto-switches to the next transport
const transport = fallback([
    webSocket(WS_RPC_URL),
    http(RPC_URL, { retryCount: 2, retryDelay: 1000 }),
    http(FALLBACK_RPC_URL, retryOpts),
]);
// Public client — always available, no private key needed
let _publicClient = null;
export function getPublicClient() {
    if (!_publicClient) {
        _publicClient = createPublicClient({
            chain: monadChain,
            transport,
        });
    }
    return _publicClient;
}
// Wallet client — only created when a write command needs it
let _walletClient = null;
export function getWalletClient() {
    if (!_walletClient) {
        const account = privateKeyToAccount(getPrivateKey());
        _walletClient = createWalletClient({
            account,
            chain: monadChain,
            transport,
        });
    }
    return _walletClient;
}
// Get the wallet address (from PRIVATE_KEY)
export function getAddress() {
    return getWalletClient().account.address;
}
//# sourceMappingURL=client.js.map