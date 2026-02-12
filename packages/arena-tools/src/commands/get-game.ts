// arena-tools get-game — get game state for RPS, Poker, or Auction
import { formatEther } from "viem";
import { getPublicClient } from "../client.js";
import { CONTRACTS } from "../config.js";
import { rpsGameAbi, pokerGameAbi, auctionGameAbi } from "../contracts.js";
import { ok, fail } from "../utils/output.js";

// RPS + Auction phases: Commit=0, Reveal=1, Complete=2
const PHASE_NAMES = ["Commit", "Reveal", "Complete"];
// Poker phases: Commit=0, BettingRound1=1, BettingRound2=2, Showdown=3, Complete=4
const POKER_PHASE_NAMES = ["Commit", "BettingRound1", "BettingRound2", "Showdown", "Complete"];
const RPS_MOVES = ["None", "Rock", "Paper", "Scissors"];

export async function getGameCommand(gameType: string, gameId: string) {
    const gt = gameType.toLowerCase();
    const client = getPublicClient();
    const id = BigInt(gameId);

    if (gt === "rps") {
        const game = (await client.readContract({
            address: CONTRACTS.RPSGame,
            abi: rpsGameAbi,
            functionName: "getGame",
            args: [id],
        })) as any;
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
            phase: PHASE_NAMES[game.phase] || `Unknown(${game.phase})`,
            phaseCode: Number(game.phase),
            phaseDeadline: Number(game.phaseDeadline),
            settled: game.settled,
        });
    }
    else if (gt === "poker") {
        const game = (await client.readContract({
            address: CONTRACTS.PokerGame,
            abi: pokerGameAbi,
            functionName: "getGame",
            args: [id],
        })) as any;
        ok({
            gameType: "poker",
            gameId: Number(id),
            matchId: Number(game.escrowMatchId),
            player1: game.player1,
            player2: game.player2,
            pot: formatEther(game.pot),
            currentBet: formatEther(game.currentBet),
            currentTurn: game.currentTurn,
            phase: POKER_PHASE_NAMES[game.phase] || `Unknown(${game.phase})`,
            phaseCode: Number(game.phase),
            phaseDeadline: Number(game.phaseDeadline),
            settled: game.settled,
            p1HandValue: Number(game.p1HandValue),
            p2HandValue: Number(game.p2HandValue),
            p1Committed: game.p1Committed,
            p2Committed: game.p2Committed,
            p1Revealed: game.p1Revealed,
            p2Revealed: game.p2Revealed,
            p1ExtraBets: formatEther(game.p1ExtraBets),
            p2ExtraBets: formatEther(game.p2ExtraBets),
        });
    }
    else if (gt === "auction") {
        const game = (await client.readContract({
            address: CONTRACTS.AuctionGame,
            abi: auctionGameAbi,
            functionName: "getGame",
            args: [id],
        })) as any;
        ok({
            gameType: "auction",
            gameId: Number(id),
            matchId: Number(game.escrowMatchId),
            player1: game.player1,
            player2: game.player2,
            prize: formatEther(game.prize),
            p1Bid: formatEther(game.p1Bid),
            p2Bid: formatEther(game.p2Bid),
            p1Committed: game.p1Committed,
            p2Committed: game.p2Committed,
            p1Revealed: game.p1Revealed,
            p2Revealed: game.p2Revealed,
            phase: PHASE_NAMES[game.phase] || `Unknown(${game.phase})`,
            phaseCode: Number(game.phase),
            phaseDeadline: Number(game.phaseDeadline),
            settled: game.settled,
        });
    }
    else {
        fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
    }
}
