// ─── Shared Game ID Discovery ────────────────────────────────────────────────
// Finds the game contract's gameId for a given escrow matchId.
//
// Uses multicall to batch all getGame() reads into a single RPC request,
// building a complete matchId→gameId map in 1-2 calls. Results are cached
// permanently since the mapping never changes.
//
// NOTE: Event log filtering (eth_getLogs) doesn't work on Monad because
// the RPC limits log queries to a 100-block range. Multicall is the most
// efficient alternative — one RPC call fetches all games.
//
// This module is shared between useActiveMatches and useLiveGameState to
// prevent code duplication and ensure both hooks use the same discovery logic.

import { publicClient, ADDRESSES } from "@/lib/contracts";
import { rpsGameAbi } from "@/lib/abi/RPSGame";
import { pokerGameV2Abi } from "@/lib/abi/PokerGameV2";
import { auctionGameAbi } from "@/lib/abi/AuctionGame";

// ─── Persistent cache: matchId → gameId (never needs re-discovery) ──────────
const gameIdCache = new Map<number, number>();

// Tracks whether we've done a full multicall scan for a game type already.
// After a full scan, any matchId not in the cache truly has no game.
const fullScanDone = new Map<string, boolean>();

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

// ─── Multicall batch size ───────────────────────────────────────────────────
// Each getGame call is small, so we can fit many in one multicall.
// 50 is conservative to avoid RPC payload limits.
const MULTICALL_BATCH = 50;

// ─── Discover game ID via multicall batch scan ──────────────────────────────

export async function discoverGameId(
  matchId: number,
  gameType: string,
): Promise<number | null> {
  // Return cached result immediately
  if (gameIdCache.has(matchId)) {
    return gameIdCache.get(matchId)!;
  }

  // If we already did a full scan for this game type, the matchId has no game
  if (fullScanDone.get(gameType)) {
    return null;
  }

  const address = getGameAddress(gameType);
  const abi = getGameAbi(gameType);

  try {
    // Get total number of games
    const nextId = await publicClient.readContract({
      address,
      abi,
      functionName: "nextGameId",
    }) as bigint;

    const total = Number(nextId);
    if (total === 0) return null;

    // ── Multicall: batch all getGame() reads into minimal RPC requests ────
    // This builds the complete matchId→gameId map in ceil(total/50) calls.
    // E.g., 60 games = 2 RPC calls. Results are cached permanently.
    for (let start = 0; start < total; start += MULTICALL_BATCH) {
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

        // Cache every successful result — builds the full map
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === "success" && r.result) {
            // escrowMatchId is the first field in all game contract tuples
            const game = r.result as any;
            const escrowMatchId = Number(game.escrowMatchId ?? game[0]);
            gameIdCache.set(escrowMatchId, start + j);
          }
        }
      } catch (mcErr) {
        // Multicall not available — fall back to sequential for this batch
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
        return gameIdCache.get(matchId)!;
      }
    }

    // Finished scanning all games — mark this game type as fully scanned
    fullScanDone.set(gameType, true);
  } catch (err) {
    console.error("[discoverGameId] error:", err);
  }

  return null;
}
