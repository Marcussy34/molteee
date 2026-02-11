// arena-tools get-game — get game state for RPS, Poker, or Auction
import { formatEther } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS, type GameTypeName } from "../config.js";
import { rpsGameAbi, pokerGameAbi, auctionGameAbi } from "../contracts.js";
import { ok, fail } from "../utils/output.js";

// RPS + Auction phases: Commit=0, Reveal=1, Complete=2
const PHASE_NAMES = ["Commit", "Reveal", "Complete"] as const;
// Poker phases: Commit=0, BettingRound1=1, BettingRound2=2, Showdown=3, Complete=4
const POKER_PHASE_NAMES = ["Commit", "BettingRound1", "BettingRound2", "Showdown", "Complete"] as const;
const RPS_MOVES = ["None", "Rock", "Paper", "Scissors"] as const;

export async function getGameCommand(gameType: string, gameId: string) {
  const gt = gameType.toLowerCase() as GameTypeName;
  const client = getPublicClient();
  const id = BigInt(gameId);

  if (gt === "rps") {
    const game = await client.readContract({
      address: CONTRACTS.RPSGame as `0x${string}`,
      abi: rpsGameAbi,
      functionName: "getGame",
      args: [id],
    });
    ok({
      gameType: "rps",
      gameId: Number(id),
      matchId: Number(game.escrowMatchId),
      player1: game.player1,
      player2: game.player2,
      totalRounds: Number(game.totalRounds),
      currentRound: Number(game.currentRound),
      p1Score: Number(game.p1Score),
      p2Score: Number(game.p2Score),
      phase: PHASE_NAMES[game.phase as number] || `Unknown(${game.phase})`,
      phaseCode: Number(game.phase),
      phaseDeadline: Number(game.phaseDeadline),
      settled: game.settled,
    });
  } else if (gt === "poker") {
    const game = await client.readContract({
      address: CONTRACTS.PokerGame as `0x${string}`,
      abi: pokerGameAbi,
      functionName: "getGame",
      args: [id],
    });
    ok({
      gameType: "poker",
      gameId: Number(id),
      matchId: Number(game.escrowMatchId),
      player1: game.player1,
      player2: game.player2,
      pot: formatEther(game.pot as bigint),
      currentBet: formatEther(game.currentBet as bigint),
      currentTurn: game.currentTurn,
      phase: POKER_PHASE_NAMES[game.phase as number] || `Unknown(${game.phase})`,
      phaseCode: Number(game.phase),
      phaseDeadline: Number(game.phaseDeadline),
      settled: game.settled,
      p1HandValue: Number(game.p1HandValue),
      p2HandValue: Number(game.p2HandValue),
      p1Committed: game.p1Committed,
      p2Committed: game.p2Committed,
      p1Revealed: game.p1Revealed,
      p2Revealed: game.p2Revealed,
      p1ExtraBets: formatEther(game.p1ExtraBets as bigint),
      p2ExtraBets: formatEther(game.p2ExtraBets as bigint),
    });
  } else if (gt === "auction") {
    const game = await client.readContract({
      address: CONTRACTS.AuctionGame as `0x${string}`,
      abi: auctionGameAbi,
      functionName: "getGame",
      args: [id],
    });
    ok({
      gameType: "auction",
      gameId: Number(id),
      matchId: Number(game.escrowMatchId),
      player1: game.player1,
      player2: game.player2,
      prize: formatEther(game.prize as bigint),
      p1Bid: formatEther(game.p1Bid as bigint),
      p2Bid: formatEther(game.p2Bid as bigint),
      p1Committed: game.p1Committed,
      p2Committed: game.p2Committed,
      p1Revealed: game.p1Revealed,
      p2Revealed: game.p2Revealed,
      phase: PHASE_NAMES[game.phase as number] || `Unknown(${game.phase})`,
      phaseCode: Number(game.phase),
      phaseDeadline: Number(game.phaseDeadline),
      settled: game.settled,
    });
  } else {
    fail(
      `Invalid game type: ${gameType}. Must be rps, poker, or auction.`,
      "INVALID_GAME_TYPE"
    );
  }
}
