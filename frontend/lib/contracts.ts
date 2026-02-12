import { createPublicClient, http, defineChain } from "viem";

// Monad testnet chain definition
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
});

// ─── Rate-limited fetch ────────────────────────────────────────────────────
// Monad testnet RPC is heavily rate-limited. This queue ensures all hooks
// share a single serialized request pipeline with a delay between calls.
const RPC_DELAY_MS = 200; // minimum ms between RPC requests
let lastRequestTime = 0;
let requestQueue: Promise<unknown> = Promise.resolve();

// Wraps the global fetch to serialize RPC calls with a delay
function rateLimitedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Only rate-limit POST requests to the Monad RPC (eth_call, etc.)
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const isRpc = url.includes("testnet-rpc.monad.xyz") && init?.method === "POST";

  if (!isRpc) return fetch(input, init);

  // Chain onto the queue so only one RPC call is in-flight at a time
  const queued = requestQueue.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RPC_DELAY_MS) {
      await new Promise((r) => setTimeout(r, RPC_DELAY_MS - elapsed));
    }
    lastRequestTime = Date.now();
    return fetch(input, init);
  });

  // Update queue head (ignore errors so queue doesn't break)
  requestQueue = queued.catch(() => {});
  return queued;
}

// Single public client for all reads — uses rate-limited transport
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(undefined, { fetchOptions: {}, retryCount: 2, retryDelay: 1000 }),
  // Override the built-in fetch with our rate-limited version
  batch: { multicall: false },
});

// Monkey-patch the transport to use our rate-limited fetch
// viem's http transport doesn't expose a fetchFunction option, so we override globally
if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  let patched = false;
  if (!patched) {
    patched = true;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const isRpc = url.includes("testnet-rpc.monad.xyz") && init?.method === "POST";

      if (!isRpc) return originalFetch(input, init);

      // Chain onto the queue so only one RPC call is in-flight at a time
      const queued = requestQueue.then(async () => {
        const now = Date.now();
        const elapsed = now - lastRequestTime;
        if (elapsed < RPC_DELAY_MS) {
          await new Promise((r) => setTimeout(r, RPC_DELAY_MS - elapsed));
        }
        lastRequestTime = Date.now();
        return originalFetch(input, init);
      });

      // Update queue head (ignore errors so queue doesn't break)
      requestQueue = queued.catch(() => {});
      return queued;
    } as typeof window.fetch;
  }
}

// V5 deployed contract addresses on Monad testnet
export const ADDRESSES = {
  agentRegistry: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101" as const,
  escrow: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E" as const,
  rpsGame: "0xCe117380073c1B425273cf0f3cB098eb6e54F147" as const,
  pokerGame: "0x2Ad3a193F88f93f3B06121aF530ee626c50aD113" as const,       // Budget Poker V2
  auctionGame: "0x0Cd3cfAFDEb25a446e1fa7d0476c5B224913fC15" as const,
  tournament: "0x58707EaCCA8f19a5051e0e50dde4cb109E3bAC7f" as const,
  predictionMarket: "0xf38C7642a6B21220404c886928DcD6783C33c2b1" as const,
  tournamentV2: "0xECcbb759CD3642333D8E8D91350a40D8E02aBe65" as const,
} as const;

// Game type enum matching the contract
export enum GameType {
  RPS = 0,
  Poker = 1,
  Auction = 2,
}

// Human-readable game type labels
export const GAME_TYPE_LABELS: Record<number, string> = {
  [GameType.RPS]: "Rock Paper Scissors",
  [GameType.Poker]: "Poker",
  [GameType.Auction]: "Auction",
};
