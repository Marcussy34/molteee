import { createPublicClient, http, fallback, defineChain } from "viem";

// ─── RPC endpoints ──────────────────────────────────────────────────────────
const ALCHEMY_RPC = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB";
const MONAD_PUBLIC_RPC = "https://rpc.monad.xyz";

// Monad chain definition
export const monadChain = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "143"),
  name: process.env.NEXT_PUBLIC_MONAD_CHAIN_NAME || "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [ALCHEMY_RPC] },
  },
  blockExplorers: {
    default: { name: "Monadscan", url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://monadscan.com" },
  },
});

// ─── Rate-limited fetch ────────────────────────────────────────────────────
// Monad RPCs are rate-limited. This queue ensures all hooks share a
// single serialized request pipeline with a delay between calls.
const RPC_DELAY_MS = 200; // minimum ms between RPC requests
let lastRequestTime = 0;
let requestQueue: Promise<unknown> = Promise.resolve();

// Check if a URL is one of our Monad RPC endpoints
function isMonadRpc(url: string): boolean {
  return url.includes("monad-mainnet.g.alchemy.com") || url.includes("rpc.monad.xyz");
}

// Single public client for all reads — Alchemy primary, public Monad fallback
// viem's fallback transport auto-switches when Alchemy 429s or times out
export const publicClient = createPublicClient({
  chain: monadChain,
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

// Deployed contract addresses on Monad mainnet
export const ADDRESSES = {
  agentRegistry: "0x88Ca39AE7b2e0fc3aA166DFf93561c71CF129b08" as const,
  escrow: "0x14C394b4042Fd047fD9226082684ED3F174eFD0C" as const,
  rpsGame: "0xE05544220998684540be9DC8859bE9954A6E3B6a" as const,
  pokerGame: "0xb08e06cF59EDB3aF1Cbf15EBB4EcE9c65876D91a" as const,   // PokerGameV2 (Budget Poker)
  auctionGame: "0xC5058a75A5E7124F3dB5657C635EB7c3b8C84A3D" as const,
  predictionMarket: "0x4D845ae4B5d640181F0c1bAeCfd0722C792242C0" as const,
  tournamentV2: "0xF1f333a4617186Cf10284Dc9d930f6082cf92A74" as const,
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
