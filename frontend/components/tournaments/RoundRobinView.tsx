import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { getAgentName } from "@/lib/agentNames";
import { TournamentMatchRow } from "./TournamentMatchRow";
import type { StandingRow, MatchData } from "@/hooks/useTournament";

interface RoundRobinViewProps {
  standings: StandingRow[];
  matches: MatchData[];
  /** Address of tournament winner (zero if not decided yet) */
  winnerAddress: string;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/**
 * Round-Robin tournament view: standings table + match results list.
 * Arcade-styled with pixel font and neon colors.
 */
export function RoundRobinView({ standings, matches, winnerAddress }: RoundRobinViewProps) {
  const hasWinner = winnerAddress !== ZERO_ADDR;

  return (
    <div className="space-y-6">
      {/* Standings Table */}
      <div>
        <h3 className="font-pixel text-[9px] text-text-dim mb-3 uppercase tracking-wider">
          STANDINGS
        </h3>
        <div className="rounded border border-monad-purple/20 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[2rem_1fr_3rem_2.5rem_2.5rem_2.5rem] gap-2 px-3 py-2 bg-monad-purple/10 border-b border-monad-purple/20">
            <span className="font-pixel text-[7px] text-text-dim">#</span>
            <span className="font-pixel text-[7px] text-text-dim">PLAYER</span>
            <span className="font-pixel text-[7px] text-text-dim text-center">PTS</span>
            <span className="font-pixel text-[7px] text-text-dim text-center">W</span>
            <span className="font-pixel text-[7px] text-text-dim text-center">L</span>
            <span className="font-pixel text-[7px] text-text-dim text-center">D</span>
          </div>
          {/* Data rows */}
          {standings.map((row, i) => {
            const isWinner = hasWinner && row.address.toLowerCase() === winnerAddress.toLowerCase();
            return (
              <div
                key={row.address}
                className={`grid grid-cols-[2rem_1fr_3rem_2.5rem_2.5rem_2.5rem] gap-2 px-3 py-2 border-b border-monad-purple/10 last:border-b-0
                  ${isWinner ? "bg-neon-green/5" : "bg-monad-deeper/30"}`}
              >
                <span className="font-pixel text-[8px] text-text-dim">{i + 1}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <PixelAvatar address={row.address} size={16} />
                  <span className={`font-pixel text-[8px] truncate ${isWinner ? "text-neon-green" : "text-white"}`}>
                    {getAgentName(row.address)}
                  </span>
                  {isWinner && (
                    <span className="font-pixel text-[7px] text-neon-green shrink-0">WIN</span>
                  )}
                </div>
                <span className="font-pixel text-[9px] text-white text-center font-bold">{row.points}</span>
                <span className="font-pixel text-[8px] text-neon-green text-center">{row.wins}</span>
                <span className="font-pixel text-[8px] text-neon-red text-center">{row.losses}</span>
                <span className="font-pixel text-[8px] text-text-dim text-center">{row.draws}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match Results */}
      {matches.length > 0 && (
        <div>
          <h3 className="font-pixel text-[9px] text-text-dim mb-3 uppercase tracking-wider">
            MATCHES ({matches.filter((m) => m.reported).length}/{matches.length} REPORTED)
          </h3>
          <div className="space-y-1.5">
            {matches.map((m) => (
              <TournamentMatchRow key={m.matchIndex} match={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
