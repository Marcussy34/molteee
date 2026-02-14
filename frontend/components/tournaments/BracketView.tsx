import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { getAgentName } from "@/lib/agentNames";
import { GameType } from "@/lib/contracts";
import { TournamentMatchRow } from "./TournamentMatchRow";
import type { BracketData, MatchData } from "@/hooks/useTournament";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// Bracket name labels
const BRACKET_LABELS: Record<number, string> = {
  0: "WINNERS BRACKET",
  1: "LOSERS BRACKET",
  2: "GRAND FINAL",
};

// Short game type labels
const GAME_SHORT: Record<number, string> = {
  [GameType.RPS]: "RPS",
  [GameType.Poker]: "PKR",
  [GameType.Auction]: "AUC",
};

interface BracketViewProps {
  bracketData: BracketData;
  matches: MatchData[];
  playerLosses?: Record<string, number>;
  winnerAddress: string;
}

/** Single match card inside the bracket visualization */
function BracketMatchCard({ match }: { match: MatchData }) {
  const isP1Winner = match.reported && match.winner.toLowerCase() === match.player1.toLowerCase();
  const isP2Winner = match.reported && match.winner.toLowerCase() === match.player2.toLowerCase();
  const p1Empty = match.player1 === ZERO_ADDR;
  const p2Empty = match.player2 === ZERO_ADDR;

  return (
    <div className="rounded border border-monad-purple/20 bg-monad-deeper/60 w-44">
      {/* Player 1 row */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-monad-purple/10 ${isP1Winner ? "bg-neon-green/5" : ""}`}>
        {!p1Empty && <PixelAvatar address={match.player1} size={14} />}
        <span className={`font-pixel text-[7px] truncate flex-1 ${isP1Winner ? "text-neon-green" : p1Empty ? "text-text-dim" : "text-white"}`}>
          {p1Empty ? "TBD" : getAgentName(match.player1)}
        </span>
        {isP1Winner && <span className="font-pixel text-[6px] text-neon-green">W</span>}
      </div>
      {/* Player 2 row */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 ${isP2Winner ? "bg-neon-green/5" : ""}`}>
        {!p2Empty && <PixelAvatar address={match.player2} size={14} />}
        <span className={`font-pixel text-[7px] truncate flex-1 ${isP2Winner ? "text-neon-green" : p2Empty ? "text-text-dim" : "text-white"}`}>
          {p2Empty ? "TBD" : getAgentName(match.player2)}
        </span>
        {isP2Winner && <span className="font-pixel text-[6px] text-neon-green">W</span>}
      </div>
      {/* Footer: game type + status */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-monad-purple/10 bg-monad-purple/5">
        <span className="font-pixel text-[6px] text-text-dim">
          {GAME_SHORT[match.gameType] || "???"}
        </span>
        {match.reported ? (
          <span className="font-pixel text-[6px] text-neon-green">DONE</span>
        ) : (
          <span className="font-pixel text-[6px] text-neon-yellow">PENDING</span>
        )}
      </div>
    </div>
  );
}

/**
 * Double-Elimination bracket visualization.
 * Shows Winners → Losers → Grand Final brackets with match cards.
 * Arcade-styled with pixel font and neon colors.
 */
export function BracketView({ bracketData, matches, playerLosses, winnerAddress }: BracketViewProps) {
  // Get sorted bracket keys (0=Winners, 1=Losers, 2=Grand Final)
  const bracketKeys = Object.keys(bracketData)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      {/* Bracket Visualization */}
      {bracketKeys.map((bracketKey) => {
        const rounds = bracketData[bracketKey];
        const roundKeys = Object.keys(rounds)
          .map(Number)
          .sort((a, b) => a - b);

        return (
          <div key={bracketKey}>
            {/* Bracket header */}
            <h3 className="font-pixel text-[9px] text-text-dim mb-3 uppercase tracking-wider">
              {BRACKET_LABELS[bracketKey] || `BRACKET ${bracketKey}`}
            </h3>

            {/* Rounds displayed horizontally */}
            <div className="overflow-x-auto">
              <div className="flex items-start gap-6 min-w-max pb-4">
                {roundKeys.map((roundKey, roundIdx) => {
                  const roundMatches = rounds[roundKey];
                  return (
                    <div key={roundKey} className="flex items-center gap-6">
                      {/* Round column */}
                      <div className="space-y-3">
                        <div className="font-pixel text-[7px] text-text-dim text-center uppercase tracking-wider mb-2">
                          ROUND {roundKey + 1}
                        </div>
                        {roundMatches.map((m, mIdx) => (
                          <BracketMatchCard key={mIdx} match={m} />
                        ))}
                      </div>

                      {/* Connector line between rounds */}
                      {roundIdx < roundKeys.length - 1 && (
                        <div className="flex items-center self-center">
                          <div className="w-6 h-px bg-monad-purple/30" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Full match list */}
      {matches.length > 0 && (
        <div>
          <h3 className="font-pixel text-[9px] text-text-dim mb-3 uppercase tracking-wider">
            ALL MATCHES ({matches.filter((m) => m.reported).length}/{matches.length} REPORTED)
          </h3>
          <div className="space-y-1.5">
            {matches.map((m) => {
              const bracketPrefix = m.bracket === 0 ? "W" : m.bracket === 1 ? "L" : "GF";
              const label = m.bracket === 2 ? "GF" : `${bracketPrefix}-R${(m.round ?? 0) + 1}`;
              return (
                <TournamentMatchRow key={`${m.bracket}-${m.round}-${m.bracketMatchIndex}`} match={m} label={label} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
