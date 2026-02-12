// Viem client setup — public client for reads, wallet client for writes.
import {
    createPublicClient,
    createWalletClient,
    http,
    webSocket,
    fallback,
    defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL, WS_RPC_URL, CHAIN_ID, CHAIN_NAME, getPrivateKey } from "./config.js";

// Define Monad testnet chain
export const monadTestnet = defineChain({
    id: CHAIN_ID,
    name: CHAIN_NAME,
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: {
        default: { http: [RPC_URL], webSocket: [WS_RPC_URL] },
    },
    blockExplorers: {
        default: {
            name: "Monad Explorer",
            url: "https://testnet.monadexplorer.com",
        },
    },
});

// Shared transport: WebSocket primary, HTTP fallback
// WS gives real-time updates without polling; HTTP catches WS failures
const transport = fallback([webSocket(WS_RPC_URL), http(RPC_URL)]);

// Public client — always available, no private key needed
let _publicClient: any = null;
export function getPublicClient() {
    if (!_publicClient) {
        _publicClient = createPublicClient({
            chain: monadTestnet,
            transport,
        });
    }
    return _publicClient;
}

// Wallet client — only created when a write command needs it
let _walletClient: any = null;
export function getWalletClient() {
    if (!_walletClient) {
        const account = privateKeyToAccount(getPrivateKey());
        _walletClient = createWalletClient({
            account,
            chain: monadTestnet,
            transport,
        });
    }
    return _walletClient;
}

// Get the wallet address (from PRIVATE_KEY)
export function getAddress(): `0x${string}` {
    return getWalletClient().account.address;
}
