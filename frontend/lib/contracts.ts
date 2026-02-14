import { createPublicClient, http, fallback, defineChain } from "viem";

// ─── RPC endpoints ──────────────────────────────────────────────────────────
const ALCHEMY_RPC = "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3";
const MONAD_PUBLIC_RPC = "https://testnet-rpc.monad.xyz";

// Monad testnet chain definition
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [ALCHEMY_RPC] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
});

// ─── Rate-limited fetch ────────────────────────────────────────────────────
// Monad testnet RPCs are rate-limited. This queue ensures all hooks share a
// single serialized request pipeline with a delay between calls.
const RPC_DELAY_MS = 200; // minimum ms between RPC requests
let lastRequestTime = 0;
let requestQueue: Promise<unknown> = Promise.resolve();

// Check if a URL is one of our Monad RPC endpoints
function isMonadRpc(url: string): boolean {
  return url.includes("monad-testnet.g.alchemy.com") || url.includes("testnet-rpc.monad.xyz");
}

// Single public client for all reads — Alchemy primary, public Monad fallback
// viem's fallback transport auto-switches when Alchemy 429s or times out
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: fallback([
    http(ALCHEMY_RPC, { retryCount: 1, retryDelay: 500, timeout: 8_000 }),
    http(MONAD_PUBLIC_RPC, { retryCount: 2, retryDelay: 1000, timeout: 10_000 }),
  ]),
  batch: { multicall: false },
});

// Monkey-patch global fetch with rate limiter for RPC calls
// Applies to both Alchemy and public Monad RPC endpoints
if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  let patched = false;
  if (!patched) {
    patched = true;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const isRpc = isMonadRpc(url) && init?.method === "POST";

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

// Deployed contract addresses on Monad testnet (V5 deployment)
export const ADDRESSES = {
  agentRegistry: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101" as const,
  escrow: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E" as const,
  rpsGame: "0xCe117380073c1B425273cf0f3cB098eb6e54F147" as const,
  pokerGame: "0x2Ad3a193F88f93f3B06121aF530ee626c50aD113" as const,   // PokerGameV2 (Budget Poker)
  auctionGame: "0x0Cd3cfAFDEb25a446e1fa7d0476c5B224913fC15" as const,
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
