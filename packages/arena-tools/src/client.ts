// Viem client setup — public client for reads, wallet client for writes.
import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
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
let _publicClient: PublicClient<Transport, Chain> | null = null;
export function getPublicClient(): PublicClient<Transport, Chain> {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: monadTestnet,
      transport,
    }) as PublicClient<Transport, Chain>;
  }
  return _publicClient;
}

// Wallet client — only created when a write command needs it
let _walletClient: WalletClient<Transport, Chain, Account> | null = null;
export function getWalletClient(): WalletClient<Transport, Chain, Account> {
  if (!_walletClient) {
    const account = privateKeyToAccount(getPrivateKey());
    _walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    }) as WalletClient<Transport, Chain, Account>;
  }
  return _walletClient;
}

// Get the wallet address (from PRIVATE_KEY)
export function getAddress(): `0x${string}` {
  return getWalletClient().account.address;
}
