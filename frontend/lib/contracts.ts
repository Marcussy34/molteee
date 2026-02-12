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
  escrow: "0xcdEe16523cf8c280f2094f9CDd19Bcf10fF94713" as const,
  rpsGame: "0xa8733Ea743C330bd891E28660d9F4ffdc7dfAF9f" as const,
  pokerGame: "0xD796d3F4c6a68B141b162912829cE510C0B32bDA" as const,
  auctionGame: "0x7A7c761871B9932741B57E898aa8C1C61E38A30A" as const,
  tournament: "0xC567D280ABAc62594A37efbc0DBc73b40925Db03" as const,
  predictionMarket: "0x8Fef302Ec63C4213861CA165652CDce93A15670f" as const,
  tournamentV2: "0x25D159aE6055df96965342Ab36e467565b7feA79" as const,
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
