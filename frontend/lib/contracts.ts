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

// Deployed contract addresses on Monad testnet
export const ADDRESSES = {
  agentRegistry: "0x96728e0962d7B3fA3B1c632bf489004803C165cE" as const,
  escrow: "0x6A52Bd7fe53f022bb7c392DE6285BfEc2d7dD163" as const,
  rpsGame: "0x4f66f4a355Ea9a54fB1F39eC9Be0E3281c2Cf415" as const,
  pokerGame: "0xB7B9741da4417852f42267FA1d295E399d11801C" as const,
  auctionGame: "0x1Fc358c48e7523800Eec9B0baeD5F7C145e9E847" as const,
  tournament: "0xB9a2634E53EA9dF280Bb93195898B7166b2CadAb" as const,
  predictionMarket: "0xEb40a1F092e7e2015A39E4E5355A252b57440563" as const,
  tournamentV2: "0x90a4FacAE37E8d98C36404055Ab8f629bE64b30e" as const,
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
