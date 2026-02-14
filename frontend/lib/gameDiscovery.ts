// ─── Shared Game ID Discovery ────────────────────────────────────────────────
// Finds the game contract's gameId for a given escrow matchId.
//
// Strategy (two-tier):
//   1. Event log query — filters GameCreated logs by indexed escrowMatchId.
//      This is O(1) and the fastest approach when the RPC supports it.
//   2. Multicall fallback — if event logs fail (e.g., Monad RPC may limit
//      log queries to a small block range), batch all getGame() reads via
//      multicall to build a complete matchId→gameId map.
//
// Results are cached permanently (matchId→gameId never changes). When new
// games are created during a session, the cache is incrementally updated
// by scanning only newly added game IDs.
//
// This module is shared between useActiveMatches and useLiveGameState to
// prevent code duplication and ensure both hooks use the same discovery logic.

import { publicClient, ADDRESSES } from "@/lib/contracts";
import { rpsGameAbi } from "@/lib/abi/RPSGame";
import { pokerGameV2Abi } from "@/lib/abi/PokerGameV2";
import { auctionGameAbi } from "@/lib/abi/AuctionGame";

// ─── Persistent cache: matchId → gameId (never needs re-discovery) ──────────
const gameIdCache = new Map<number, number>();

// Tracks the highest nextGameId we've scanned up to, per game type.
// When nextGameId increases, we only need to scan the new games.
const lastScannedNextId = new Map<string, number>();

// ─── ABI / address helpers ──────────────────────────────────────────────────

export function getGameAbi(gameType: string) {
  switch (gameType) {
    case "rps": return rpsGameAbi;
    case "poker": return pokerGameV2Abi;
    case "auction": return auctionGameAbi;
    default: return rpsGameAbi;
  }
}

export function getGameAddress(gameType: string): `0x${string}` {
  switch (gameType) {
    case "rps": return ADDRESSES.rpsGame;
    case "poker": return ADDRESSES.pokerGame;
    case "auction": return ADDRESSES.auctionGame;
    default: return ADDRESSES.rpsGame;
  }
}

// ─── GameCreated event ABI definitions (minimal, shared across game types) ──
// All game contracts emit: GameCreated(indexed gameId, indexed escrowMatchId, ...)
// We only need the first two indexed params for discovery.

const GAME_CREATED_EVENT = {
  type: "event" as const,
  name: "GameCreated" as const,
  inputs: [
    { name: "gameId", type: "uint256" as const, indexed: true },
    { name: "escrowMatchId", type: "uint256" as const, indexed: true },
    { name: "player1", type: "address" as const, indexed: true },
    { name: "player2", type: "address" as const, indexed: false },
  ],
};

// ─── Multicall batch size ───────────────────────────────────────────────────
const MULTICALL_BATCH = 50;

// ─── Tier 1: Event log query ────────────────────────────────────────────────
// Filters GameCreated logs by the indexed escrowMatchId topic.
// Returns the gameId if found, or null if no matching log exists.

async function discoverViaEventLogs(
  matchId: number,
  gameType: string,
): Promise<number | null> {
  const address = getGameAddress(gameType);

  try {
    const logs = await publicClient.getLogs({
      address,
      event: GAME_CREATED_EVENT,
      args: { escrowMatchId: BigInt(matchId) },
      fromBlock: BigInt(0),
      toBlock: "latest",
    });

    if (logs.length > 0) {
      const args = logs[0].args as { gameId?: bigint; escrowMatchId?: bigint };
      const gameId = Number(args.gameId);
      // Cache the result for future lookups
      gameIdCache.set(matchId, gameId);
      return gameId;
    }
  } catch (err) {
    // Event log query failed — likely Monad block range limit.
    // Caller will fall back to multicall.
    console.warn("[discoverGameId] event log query failed, will use multicall fallback:", err);
    throw err; // re-throw so caller knows to fall back
  }

  return null;
}

// ─── Tier 2: Multicall batch scan (fallback) ────────────────────────────────
// Batches getGame() reads into multicall requests. Only scans game IDs
// that haven't been scanned yet (incremental).

async function discoverViaMulticall(
  matchId: number,
  gameType: string,
): Promise<number | null> {
  const address = getGameAddress(gameType);
  const abi = getGameAbi(gameType);

  // Get total number of games
  const nextId = await publicClient.readContract({
    address,
    abi,
    functionName: "nextGameId",
  }) as bigint;

  const total = Number(nextId);
  if (total === 0) return null;

  // Determine where to start scanning (skip already-scanned range)
  const alreadyScanned = lastScannedNextId.get(gameType) ?? 0;
  const startFrom = alreadyScanned;

  // If we've already scanned up to the current total, nothing new to check
  if (startFrom >= total) {
    return gameIdCache.get(matchId) ?? null;
  }

  // Scan only the new games via multicall
  for (let start = startFrom; start < total; start += MULTICALL_BATCH) {
    const end = Math.min(start + MULTICALL_BATCH, total);
    const contracts = [];

    for (let i = start; i < end; i++) {
      contracts.push({
        address,
        abi,
        functionName: "getGame" as const,
        args: [BigInt(i)],
      });
    }

    try {
      const results = await publicClient.multicall({
        contracts: contracts as any,
        allowFailure: true,
      });

      // Cache every successful result — builds the matchId→gameId map
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "success" && r.result) {
          const game = r.result as any;
          // escrowMatchId is the first field in all game contract tuples
          const escrowMatchId = Number(game.escrowMatchId ?? game[0]);
          gameIdCache.set(escrowMatchId, start + j);
        }
      }
    } catch (mcErr) {
      // Multicall not available — fall back to sequential reads for this batch
      console.warn("[discoverGameId] multicall failed, using sequential:", mcErr);
      for (let i = start; i < end; i++) {
        try {
          const game = await publicClient.readContract({
            address,
            abi,
            functionName: "getGame",
            args: [BigInt(i)],
          }) as any;
          gameIdCache.set(Number(game.escrowMatchId), i);
        } catch {
          // Skip invalid game IDs
        }
      }
    }

    // Early exit if we found our target
    if (gameIdCache.has(matchId)) {
      lastScannedNextId.set(gameType, total);
      return gameIdCache.get(matchId)!;
    }
  }

  // Update scan watermark — we've now scanned everything up to `total`
  lastScannedNextId.set(gameType, total);
  return gameIdCache.get(matchId) ?? null;
}

// ─── Public API: Discover game ID for an escrow matchId ─────────────────────
// Tries event logs first (O(1)), falls back to multicall if logs fail.
// Results are cached permanently in-memory.

// Track whether event logs work for this RPC (sticky per session)
let eventLogsSupported: boolean | null = null;

export async function discoverGameId(
  matchId: number,
  gameType: string,
): Promise<number | null> {
  // Return cached result immediately (matchId→gameId never changes)
  if (gameIdCache.has(matchId)) {
    return gameIdCache.get(matchId)!;
  }

  try {
    // Tier 1: Try event log query first (if not already known to fail)
    if (eventLogsSupported !== false) {
      try {
        const result = await discoverViaEventLogs(matchId, gameType);
        // Event logs worked — remember for future calls
        eventLogsSupported = true;
        return result;
      } catch {
        // Event logs not supported — fall through to multicall
        eventLogsSupported = false;
      }
    }

    // Tier 2: Multicall batch scan (fallback)
    return await discoverViaMulticall(matchId, gameType);
  } catch (err) {
    console.error("[discoverGameId] error:", err);
  }

  return null;
}
