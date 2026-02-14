import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { getAgentName } from "@/lib/agentNames";
import { GameType } from "@/lib/contracts";
import type { MatchData } from "@/hooks/useTournament";

// Short game type labels with arcade colors
const GAME_BADGES: Record<number, { label: string; className: string }> = {
  [GameType.RPS]: { label: "RPS", className: "text-neon-cyan border-neon-cyan/30" },
  [GameType.Poker]: { label: "POKER", className: "text-monad-purple border-monad-purple/30" },
  [GameType.Auction]: { label: "AUCTION", className: "text-neon-yellow border-neon-yellow/30" },
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

interface TournamentMatchRowProps {
  match: MatchData;
  /** Optional label prefix like "W-R1" for bracket context */
  label?: string;
}

/**
 * Shared match row for both Round-Robin and Double-Elimination views.
 * Arcade-styled with pixel font and neon colors.
 */
export function TournamentMatchRow({ match, label }: TournamentMatchRowProps) {
  const game = GAME_BADGES[match.gameType] || GAME_BADGES[GameType.RPS];
  const isP1Winner = match.reported && match.winner.toLowerCase() === match.player1.toLowerCase();
  const isP2Winner = match.reported && match.winner.toLowerCase() === match.player2.toLowerCase();
  const isDraw = match.reported && match.winner.toLowerCase() === ZERO_ADDR.toLowerCase();
  const isPending = !match.reported;

  // Check if player slot is empty (not yet assigned in bracket)
  const p1Empty = match.player1 === ZERO_ADDR;
  const p2Empty = match.player2 === ZERO_ADDR;

  return (
    <div className="flex items-center gap-3 rounded border border-monad-purple/15 bg-monad-deeper/40 px-3 py-2">
      {/* Match identifier */}
      <span className="w-10 shrink-0 font-pixel text-[7px] text-text-dim">
        {label || `#${match.matchIndex + 1}`}
      </span>

      {/* Player 1 */}
      <div className={`flex items-center gap-1.5 flex-1 min-w-0`}>
        {!p1Empty && <PixelAvatar address={match.player1} size={16} />}
        <span className={`font-pixel text-[8px] truncate ${isP1Winner ? "text-neon-green" : p1Empty ? "text-text-dim" : "text-white"}`}>
          {p1Empty ? "TBD" : getAgentName(match.player1)}
        </span>
      </div>

      {/* VS */}
      <span className="shrink-0 font-pixel text-[7px] text-text-dim">VS</span>

      {/* Player 2 */}
      <div className={`flex items-center gap-1.5 flex-1 min-w-0`}>
        {!p2Empty && <PixelAvatar address={match.player2} size={16} />}
        <span className={`font-pixel text-[8px] truncate ${isP2Winner ? "text-neon-green" : p2Empty ? "text-text-dim" : "text-white"}`}>
          {p2Empty ? "TBD" : getAgentName(match.player2)}
        </span>
      </div>

      {/* Game type badge */}
      <span className={`shrink-0 font-pixel text-[7px] border rounded px-1.5 py-0.5 ${game.className}`}>
        {game.label}
      </span>

      {/* Result */}
      <div className="w-14 shrink-0 text-right">
        {isPending ? (
          <span className="font-pixel text-[7px] text-neon-yellow">PENDING</span>
        ) : isDraw ? (
          <span className="font-pixel text-[7px] text-text-dim">DRAW</span>
        ) : (
          <span className="font-pixel text-[7px] text-neon-green">DONE</span>
        )}
      </div>
    </div>
  );
}
