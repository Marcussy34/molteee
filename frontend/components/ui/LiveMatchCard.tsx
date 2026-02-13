import { PixelAvatar } from "./PixelAvatar";
import { getAgentName, truncateAddress } from "@/lib/agentNames";
import type { OnChainMatch } from "@/hooks/useActiveMatches";
import { formatEther } from "viem";

// ─── Game type badge colors ──────────────────────────────────────────────────

const GAME_BADGE: Record<string, { label: string; color: string }> = {
  rps: { label: "RPS", color: "text-monad-purple bg-monad-purple/15" },
  poker: { label: "POKER", color: "text-neon-cyan bg-neon-cyan/15" },
  auction: { label: "AUCTION", color: "text-neon-yellow bg-neon-yellow/15" },
  unknown: { label: "???", color: "text-text-dim bg-white/5" },
};

interface LiveMatchCardProps {
  match: OnChainMatch;
  isSelected?: boolean;
  onClick?: () => void;
}

export function LiveMatchCard({ match, isSelected, onClick }: LiveMatchCardProps) {
  // Only truly live if game is actively in progress on-chain
  const isLive = match.isPlaying === true;
  const isPending = match.status === "pending";
  const badge = GAME_BADGE[match.gameType] || GAME_BADGE.unknown;
  const wagerStr = formatEther(match.wager);
  const p1Name = getAgentName(match.player1);
  const p2Name = getAgentName(match.player2);

  // Determine winner name for settled matches
  let winnerName = "";
  if (match.winner) {
    winnerName = match.winner.toLowerCase() === match.player1.toLowerCase()
      ? p1Name
      : p2Name;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border transition-all ${
        isSelected
          ? "border-monad-purple/60 bg-monad-purple/10"
          : "border-monad-purple/15 bg-monad-deeper/60 hover:border-monad-purple/30 hover:bg-monad-deeper/80"
      }`}
    >
      {/* Top row: game badge + live indicator + wager */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`font-pixel text-[7px] px-1.5 py-0.5 rounded ${badge.color}`}>
            {badge.label}
          </span>
          <span className="font-pixel text-[7px] text-text-dim">#{match.matchId}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <>
              <span className="font-pixel text-[7px] text-neon-green animate-pulse">
                LIVE
              </span>
              {match.gamePhase && (
                <span className="font-pixel text-[6px] text-monad-purple">
                  {match.gamePhase}
                </span>
              )}
            </>
          )}
          {isPending && (
            <span className="font-pixel text-[7px] text-neon-yellow animate-pulse">
              PENDING
            </span>
          )}
          <span className="font-pixel text-[8px] text-neon-yellow">{wagerStr} MON</span>
        </div>
      </div>

      {/* Players row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PixelAvatar address={match.player1} size={20} />
          <span className="font-pixel text-[8px] text-text-primary">{p1Name}</span>
        </div>
        <span className="font-pixel text-[7px] text-text-dim">VS</span>
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-[8px] text-text-primary">{p2Name}</span>
          <PixelAvatar address={match.player2} size={20} />
        </div>
      </div>

      {/* Winner or draw (settled only) */}
      {match.status === "settled" && (
        <div className="mt-1 text-center">
          {winnerName ? (
            <span className="font-pixel text-[7px] text-neon-green">{winnerName} WINS</span>
          ) : (
            <span className="font-pixel text-[7px] text-neon-yellow">DRAW</span>
          )}
        </div>
      )}
    </button>
  );
}
