// Viem client setup — public client for reads, wallet client for writes.
import { createPublicClient, createWalletClient, http, defineChain, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL, CHAIN_ID, CHAIN_NAME, getPrivateKey } from "./config.js";
// Define Monad testnet chain
export const monadTestnet = defineChain({
    id: CHAIN_ID,
    name: CHAIN_NAME,
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: {
        default: { http: [RPC_URL] },
    },
    blockExplorers: {
        default: {
            name: "Monad Explorer",
            url: "https://testnet.monadexplorer.com",
        },
    },
});
// Public client — always available, no private key needed
let _publicClient = null;
export function getPublicClient() {
    if (!_publicClient) {
        _publicClient = createPublicClient({
            chain: monadTestnet,
            transport: http(RPC_URL),
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
            chain: monadTestnet,
            transport: http(RPC_URL),
        });
    }
    return _walletClient;
}
// Get the wallet address (from PRIVATE_KEY)
export function getAddress() {
    return getWalletClient().account.address;
}
//# sourceMappingURL=client.js.map