#!/usr/bin/env node
// @molteee/arena-tools — CLI for the Molteee Gaming Arena on Monad testnet.
// All commands output JSON to stdout. Exit code 0 = success, 1 = error.
import { Command } from "commander";
import { wrapCommand } from "./utils/output.js";

// ─── Read commands ──────────────────────────────────────────────────────────
import { statusCommand } from "./commands/status.js";
import { findOpponentsCommand } from "./commands/find-opponents.js";
import { historyCommand } from "./commands/history.js";
import { getMatchCommand } from "./commands/get-match.js";
import { getGameCommand } from "./commands/get-game.js";
import { findGameCommand } from "./commands/find-game.js";
import { pendingCommand } from "./commands/pending.js";
import { marketStatusCommand } from "./commands/market-status.js";
import {
  tournamentsCommand,
  tournamentStatusCommand,
} from "./commands/tournaments.js";

// ─── Write commands ─────────────────────────────────────────────────────────
import { registerCommand } from "./commands/register.js";
import { challengeCommand } from "./commands/challenge.js";
import { acceptCommand } from "./commands/accept.js";
import {
  rpsCreateCommand,
  rpsCommitCommand,
  rpsRevealCommand,
} from "./commands/rps.js";
import {
  pokerCreateCommand,
  pokerCommitCommand,
  pokerActionCommand,
  pokerRevealCommand,
} from "./commands/poker.js";
import {
  auctionCreateCommand,
  auctionCommitCommand,
  auctionRevealCommand,
} from "./commands/auction.js";
import { claimTimeoutCommand } from "./commands/claim-timeout.js";
import { rpsRoundCommand } from "./commands/rps-round.js";
import { pokerStepCommand } from "./commands/poker-step.js";
import { auctionRoundCommand } from "./commands/auction-round.js";
import {
  listMarketsCommand,
  createMarketCommand,
  betCommand,
  resolveMarketCommand,
  redeemCommand,
} from "./commands/market.js";
import { joinTournamentCommand } from "./commands/join-tournament.js";
import { createTournamentCommand } from "./commands/create-tournament.js";

const program = new Command();

program
  .name("arena-tools")
  .description(
    "CLI for the Molteee Gaming Arena on Monad testnet. All output is JSON."
  )
  .version("0.1.8");

// ═══════════════════════════════════════════════════════════════════════════
// READ-ONLY COMMANDS (no PRIVATE_KEY needed)
// ═══════════════════════════════════════════════════════════════════════════

program
  .command("status")
  .description("Get wallet balance, registration status, and ELO ratings")
  .requiredOption("--address <address>", "Wallet address to check")
  .action(wrapCommand(async (opts: { address: string }) => {
    await statusCommand(opts.address);
  }));

program
  .command("find-opponents")
  .description("List open agents for a game type")
  .argument("<game_type>", "Game type: rps, poker, or auction")
  .action(wrapCommand(async (gameType: string) => {
    await findOpponentsCommand(gameType);
  }));

program
  .command("history")
  .description("Get match history for an address")
  .requiredOption("--address <address>", "Wallet address")
  .action(wrapCommand(async (opts: { address: string }) => {
    await historyCommand(opts.address);
  }));

program
  .command("get-match")
  .description("Get details of a specific match")
  .argument("<match_id>", "Match ID")
  .action(wrapCommand(async (matchId: string) => {
    await getMatchCommand(matchId);
  }));

program
  .command("get-game")
  .description("Get game state for RPS, Poker, or Auction")
  .argument("<game_type>", "Game type: rps, poker, or auction")
  .argument("<game_id>", "Game ID")
  .action(wrapCommand(async (gameType: string, gameId: string) => {
    await getGameCommand(gameType, gameId);
  }));

program
  .command("find-game")
  .description("Find the game ID for a match (use after accepting a challenge)")
  .argument("<match_id>", "Match ID to look up")
  .action(wrapCommand(async (matchId: string) => {
    await findGameCommand(matchId);
  }));

program
  .command("pending")
  .description("List pending challenges (incoming matches not yet accepted)")
  .requiredOption("--address <address>", "Wallet address to check")
  .action(wrapCommand(async (opts: { address: string }) => {
    await pendingCommand(opts.address);
  }));

program
  .command("market-status")
  .description("Get prediction market prices and state")
  .argument("<market_id>", "Market ID")
  .action(wrapCommand(async (marketId: string) => {
    await marketStatusCommand(marketId);
  }));

program
  .command("list-markets")
  .description("List all prediction markets with prices")
  .action(wrapCommand(async () => {
    await listMarketsCommand();
  }));

program
  .command("tournaments")
  .description("List all tournaments")
  .action(wrapCommand(async () => {
    await tournamentsCommand();
  }));

program
  .command("tournament-status")
  .description("Get tournament details and participants")
  .argument("<tournament_id>", "Tournament ID")
  .action(wrapCommand(async (tournamentId: string) => {
    await tournamentStatusCommand(tournamentId);
  }));

// ═══════════════════════════════════════════════════════════════════════════
// WRITE COMMANDS (require PRIVATE_KEY env var)
// ═══════════════════════════════════════════════════════════════════════════

program
  .command("register")
  .description("Register on the AgentRegistry for game types")
  .argument("<game_types>", "Comma-separated: rps,poker,auction")
  .option("--min-wager <amount>", "Min wager in MON", "0.001")
  .option("--max-wager <amount>", "Max wager in MON", "1.0")
  .action(
    wrapCommand(
      async (gameTypes: string, opts: { minWager: string; maxWager: string }) => {
        await registerCommand(gameTypes, opts);
      }
    )
  );

program
  .command("challenge")
  .description("Create an escrow match against an opponent")
  .argument("<address>", "Opponent address")
  .argument("<wager>", "Wager amount in MON")
  .argument("<game_type>", "Game type: rps, poker, or auction")
  .action(
    wrapCommand(async (address: string, wager: string, gameType: string) => {
      await challengeCommand(address, wager, gameType);
    })
  );

program
  .command("accept")
  .description("Accept an escrow match (auto-matches wager)")
  .argument("<match_id>", "Match ID to accept")
  .action(wrapCommand(async (matchId: string) => {
    await acceptCommand(matchId);
  }));

// ─── RPS Commands ────────────────────────────────────────────────────────────

program
  .command("rps-create")
  .description("Create a new RPS game for a match")
  .argument("<match_id>", "Escrow match ID")
  .argument("[rounds]", "Number of rounds (must be odd)", "1")
  .action(wrapCommand(async (matchId: string, rounds: string) => {
    await rpsCreateCommand(matchId, rounds);
  }));

program
  .command("rps-commit")
  .description("Commit a move (salt handled automatically)")
  .argument("<game_id>", "RPS game ID")
  .argument("<move>", "Move: rock, paper, or scissors")
  .action(wrapCommand(async (gameId: string, move: string) => {
    await rpsCommitCommand(gameId, move);
  }));

program
  .command("rps-reveal")
  .description("Reveal your committed move")
  .argument("<game_id>", "RPS game ID")
  .action(wrapCommand(async (gameId: string) => {
    await rpsRevealCommand(gameId);
  }));

// ─── Poker Commands ──────────────────────────────────────────────────────────

program
  .command("poker-create")
  .description("Create a new Poker game for a match")
  .argument("<match_id>", "Escrow match ID")
  .action(wrapCommand(async (matchId: string) => {
    await pokerCreateCommand(matchId);
  }));

program
  .command("poker-commit")
  .description("Commit a hand value (1-100)")
  .argument("<game_id>", "Poker game ID")
  .argument("<hand_value>", "Hand value: 1-100")
  .action(wrapCommand(async (gameId: string, handValue: string) => {
    await pokerCommitCommand(gameId, handValue);
  }));

program
  .command("poker-action")
  .description("Take a betting action")
  .argument("<game_id>", "Poker game ID")
  .argument("<action>", "Action: check, bet, raise, call, or fold")
  .argument("[amount]", "Amount in MON (for bet/raise)")
  .action(
    wrapCommand(async (gameId: string, action: string, amount?: string) => {
      await pokerActionCommand(gameId, action, amount);
    })
  );

program
  .command("poker-reveal")
  .description("Reveal your committed hand")
  .argument("<game_id>", "Poker game ID")
  .action(wrapCommand(async (gameId: string) => {
    await pokerRevealCommand(gameId);
  }));

// ─── Auction Commands ────────────────────────────────────────────────────────

program
  .command("auction-create")
  .description("Create a new Auction game for a match")
  .argument("<match_id>", "Escrow match ID")
  .action(wrapCommand(async (matchId: string) => {
    await auctionCreateCommand(matchId);
  }));

program
  .command("auction-commit")
  .description("Commit a bid amount")
  .argument("<game_id>", "Auction game ID")
  .argument("<bid>", "Bid amount in MON")
  .action(wrapCommand(async (gameId: string, bid: string) => {
    await auctionCommitCommand(gameId, bid);
  }));

program
  .command("auction-reveal")
  .description("Reveal your committed bid")
  .argument("<game_id>", "Auction game ID")
  .action(wrapCommand(async (gameId: string) => {
    await auctionRevealCommand(gameId);
  }));

// ─── Shared Game Commands ────────────────────────────────────────────────────

program
  .command("claim-timeout")
  .description("Claim a timeout win when opponent doesn't act within 5 min")
  .argument("<game_type>", "Game type: rps, poker, or auction")
  .argument("<game_id>", "Game ID")
  .action(wrapCommand(async (gameType: string, gameId: string) => {
    await claimTimeoutCommand(gameType, gameId);
  }));

// ─── Agent-Driven Game Commands (LLM decides each move) ────────────────────

program
  .command("rps-round")
  .description("Play one RPS round (commit + wait + reveal + wait). LLM picks each move.")
  .argument("<game_id>", "RPS game ID")
  .argument("<move>", "Move: rock, paper, or scissors")
  .action(wrapCommand(async (gameId: string, move: string) => {
    await rpsRoundCommand(gameId, move);
  }));

program
  .command("poker-step")
  .description("Play one Poker step. Commit: hand value 1-100. Betting: check/bet/raise/call/fold. Showdown: reveal.")
  .argument("<game_id>", "Poker game ID")
  .argument("<decision>", "Hand value (1-100) during commit, or action during betting, or 'reveal' during showdown")
  .option("--amount <amount>", "Amount in MON (for bet/raise)")
  .action(wrapCommand(async (gameId: string, decision: string, opts: { amount?: string }) => {
    await pokerStepCommand(gameId, decision, opts);
  }));

program
  .command("auction-round")
  .description("Play a full Auction round (commit bid + wait + reveal + wait).")
  .argument("<game_id>", "Auction game ID")
  .argument("<bid>", "Bid amount in MON")
  .action(wrapCommand(async (gameId: string, bid: string) => {
    await auctionRoundCommand(gameId, bid);
  }));

// ─── Market Commands ─────────────────────────────────────────────────────────

program
  .command("create-market")
  .description("Create a prediction market for a match")
  .argument("<match_id>", "Match ID")
  .argument("<seed>", "Seed liquidity in MON")
  .action(wrapCommand(async (matchId: string, seed: string) => {
    await createMarketCommand(matchId, seed);
  }));

program
  .command("bet")
  .description("Buy YES or NO tokens on a prediction market")
  .argument("<market_id>", "Market ID")
  .argument("<side>", "Side: yes or no")
  .argument("<amount>", "Amount in MON")
  .action(
    wrapCommand(async (marketId: string, side: string, amount: string) => {
      await betCommand(marketId, side, amount);
    })
  );

program
  .command("resolve-market")
  .description("Resolve a prediction market after match settles")
  .argument("<market_id>", "Market ID")
  .action(wrapCommand(async (marketId: string) => {
    await resolveMarketCommand(marketId);
  }));

program
  .command("redeem")
  .description("Redeem winning prediction market tokens")
  .argument("<market_id>", "Market ID")
  .action(wrapCommand(async (marketId: string) => {
    await redeemCommand(marketId);
  }));

// ─── Tournament Commands ─────────────────────────────────────────────────────

program
  .command("join-tournament")
  .description("Register for a tournament (auto-pays entry fee)")
  .argument("<tournament_id>", "Tournament ID")
  .action(wrapCommand(async (tournamentId: string) => {
    await joinTournamentCommand(tournamentId);
  }));

program
  .command("create-tournament")
  .description("Create a new tournament (round-robin or double-elim)")
  .argument("<format>", "Tournament format: round-robin or double-elim")
  .argument("<max_players>", "Max players: 4 or 8")
  .option("--entry-fee <amount>", "Entry fee in MON", "0.01")
  .option("--base-wager <amount>", "Base wager in MON", "0.001")
  .action(
    wrapCommand(async (format: string, maxPlayers: string, opts: { entryFee: string; baseWager: string }) => {
      await createTournamentCommand(format, maxPlayers, opts);
    })
  );

program.parse();
