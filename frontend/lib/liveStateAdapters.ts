// Adapters: convert LiveGameState → synthetic Match objects
// that the existing director hooks (useBattleDirector, usePokerDirector, useAuctionDirector)
// can consume to drive their full animation sequences.

import type { LiveGameState, RoundHistoryEntry } from "@/hooks/useLiveGameState";
import type { OnChainMatch } from "@/hooks/useActiveMatches";
import type { Match, MatchRound } from "@/lib/types";
import { getAgentName } from "@/lib/agentNames";
import { formatEther } from "viem";

// ─── RPS Move Labels ──────────────────────────────────────────────────────────

const RPS_MOVE_NAMES: Record<number, string> = {
  0: "",        // None / not revealed
  1: "rock",
  2: "paper",
  3: "scissors",
};

export function rpsMoveLabel(move: number): string {
  return RPS_MOVE_NAMES[move] || "";
}

// ─── Round winner for RPS ─────────────────────────────────────────────────────

function determineRpsRoundWinner(p1Move: number, p2Move: number): "A" | "B" | "draw" {
  if (!p1Move || !p2Move) return "draw";
  if (p1Move === p2Move) return "draw";
  if (
    (p1Move === 1 && p2Move === 3) ||
    (p1Move === 2 && p2Move === 1) ||
    (p1Move === 3 && p2Move === 2)
  ) return "A";
  return "B";
}

// ─── Build synthetic Match from live blockchain state ─────────────────────────
// These Match objects feed into the director hooks to drive animations.

/**
 * Build a synthetic Match for RPS from live chain data.
 * Includes full round history from completed rounds + current round in progress.
 * The director uses roundHistory for past rounds and current round for live animation.
 */
export function liveToRpsMatch(live: LiveGameState, onChain: OnChainMatch): Match {
  const rounds: MatchRound[] = [];

  // Add completed rounds from history (immutable, cached on chain)
  if (live.roundHistory && live.roundHistory.length > 0) {
    for (const entry of live.roundHistory) {
      rounds.push({
        round: entry.round,
        moveA: rpsMoveLabel(entry.p1Move) || undefined,
        moveB: rpsMoveLabel(entry.p2Move) || undefined,
        winner: entry.winner,
      });
    }
  }

  // Add current round (may be in-progress with partial data)
  const p1Move = live.p1Move || 0;
  const p2Move = live.p2Move || 0;
  const currentRound: MatchRound = {
    round: live.currentRound || 0,
    moveA: rpsMoveLabel(p1Move) || undefined,
    moveB: rpsMoveLabel(p2Move) || undefined,
    winner: determineRpsRoundWinner(p1Move, p2Move),
  };
  rounds.push(currentRound);

  // Determine overall match result from scores
  let result: "playerA" | "playerB" | "draw" = "draw";
  if (live.settled && live.p1Score !== undefined && live.p2Score !== undefined) {
    if (live.p1Score > live.p2Score) result = "playerA";
    else if (live.p2Score > live.p1Score) result = "playerB";
  }

  return {
    id: `live-rps-${onChain.matchId}`,
    matchId: onChain.matchId,
    gameType: "rps",
    playerA: { address: live.player1, name: getAgentName(live.player1) },
    playerB: { address: live.player2, name: getAgentName(live.player2) },
    wager: formatEther(onChain.wager),
    rounds,
    result,
    eloChange: { playerA: 0, playerB: 0 },
    strategyUsed: "",
    txHashes: [],
    timestamp: onChain.createdAt,
  };
}

/**
 * Build a synthetic Match for Poker from live chain data.
 * Maps poker contract state to the actionA/actionB/handValue fields
 * that usePokerDirector and PokerTable expect.
 */
export function liveToPokerMatch(live: LiveGameState, onChain: OnChainMatch): Match {
  // Map contract phase to poker actions for the animation
  // Phase 1=Commit, 2=Betting1, 3=Betting2, 4=Showdown, 5=Settled
  let actionA: string | undefined;
  let actionB: string | undefined;

  if (live.phaseRaw >= 2 && live.phaseRaw <= 3) {
    // During betting rounds, show bet/check/call
    actionA = live.p1ExtraBets && live.p1ExtraBets > BigInt(0) ? "raise" : "check";
    actionB = live.p2ExtraBets && live.p2ExtraBets > BigInt(0) ? "call" : "check";
  }

  // Build round with poker-specific fields
  const round: MatchRound = {
    round: live.currentRound || 0,
    actionA,
    actionB,
    handValueA: live.p1Revealed ? 0 : undefined, // Values hidden until showdown on-chain
    handValueB: live.p2Revealed ? 0 : undefined,
    winner: "draw", // Updated when settled
  };

  // Determine result from scores
  let result: "playerA" | "playerB" | "draw" = "draw";
  if (live.settled && live.p1Score !== undefined && live.p2Score !== undefined) {
    if (live.p1Score > live.p2Score) result = "playerA";
    else if (live.p2Score > live.p1Score) result = "playerB";
  }

  return {
    id: `live-poker-${onChain.matchId}`,
    matchId: onChain.matchId,
    gameType: "poker",
    playerA: { address: live.player1, name: getAgentName(live.player1) },
    playerB: { address: live.player2, name: getAgentName(live.player2) },
    wager: formatEther(onChain.wager),
    rounds: [round],
    result,
    eloChange: { playerA: 0, playerB: 0 },
    strategyUsed: "",
    txHashes: [],
    timestamp: onChain.createdAt,
  };
}

/**
 * Build a synthetic Match for Auction from live chain data.
 * Maps auction contract state to the bidA/bidB fields
 * that useAuctionDirector and AuctionStage expect.
 */
export function liveToAuctionMatch(live: LiveGameState, onChain: OnChainMatch): Match {
  // Bids are visible only after reveal on-chain
  const bidA = live.p1Revealed && live.p1Bid !== undefined ? formatEther(live.p1Bid) : undefined;
  const bidB = live.p2Revealed && live.p2Bid !== undefined ? formatEther(live.p2Bid) : undefined;

  // Determine round winner from bid amounts (higher bid wins)
  let winner: "A" | "B" | "draw" = "draw";
  if (bidA && bidB) {
    const a = parseFloat(bidA);
    const b = parseFloat(bidB);
    if (a > b) winner = "A";
    else if (b > a) winner = "B";
  }

  const round: MatchRound = {
    round: 0,
    bidA,
    bidB,
    winner,
  };

  // Match result (auction is single round)
  let result: "playerA" | "playerB" | "draw" = "draw";
  if (live.settled) {
    if (winner === "A") result = "playerA";
    else if (winner === "B") result = "playerB";
  }

  return {
    id: `live-auction-${onChain.matchId}`,
    matchId: onChain.matchId,
    gameType: "auction",
    playerA: { address: live.player1, name: getAgentName(live.player1) },
    playerB: { address: live.player2, name: getAgentName(live.player2) },
    wager: formatEther(onChain.wager),
    rounds: [round],
    result,
    eloChange: { playerA: 0, playerB: 0 },
    strategyUsed: "",
    txHashes: [],
    timestamp: onChain.createdAt,
  };
}
