import { LiveMatchCard } from "./LiveMatchCard";
import type { OnChainMatch, GameFilter } from "@/hooks/useActiveMatches";

// ─── Tab configuration ───────────────────────────────────────────────────────

const TABS: { value: GameFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "rps", label: "RPS" },
  { value: "poker", label: "POKER" },
  { value: "auction", label: "AUCTION" },
];

interface LiveMatchListProps {
  liveMatches: OnChainMatch[];
  pendingChallenges: OnChainMatch[];
  recentSettled: OnChainMatch[];
  loading: boolean;
  filter: GameFilter;
  onFilterChange: (f: GameFilter) => void;
  selectedMatchId: number | null;
  onSelectMatch: (matchId: number) => void;
}

export function LiveMatchList({
  liveMatches,
  pendingChallenges,
  recentSettled,
  loading,
  filter,
  onFilterChange,
  selectedMatchId,
  onSelectMatch,
}: LiveMatchListProps) {
  return (
    <div className="relative flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-monad-purple/15">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange(tab.value)}
            className={`font-pixel text-[8px] px-2 py-1 rounded transition-colors ${
              filter === tab.value
                ? "text-neon-cyan bg-monad-purple/15"
                : "text-text-dim hover:text-monad-purple"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {loading && (
          <span className="ml-auto font-pixel text-[7px] text-text-dim animate-pulse">
            SCANNING...
          </span>
        )}
      </div>

      {/* Match sections */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Live matches — always show section, with empty state when idle */}
        <div>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className={`font-pixel text-[7px] ${liveMatches.length > 0 ? "text-neon-green animate-pulse" : "text-text-dim"}`}>●</span>
            <span className="font-pixel text-[8px] text-text-dim">LIVE MATCHES</span>
            {liveMatches.length > 0 && (
              <span className="font-pixel text-[7px] text-text-dim">({liveMatches.length})</span>
            )}
          </div>
          {liveMatches.length > 0 ? (
            <div className="space-y-1">
              {liveMatches.map((m) => (
                <LiveMatchCard
                  key={m.matchId}
                  match={m}
                  isSelected={selectedMatchId === m.matchId}
                  onClick={() => onSelectMatch(m.matchId)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <span className="font-pixel text-[9px] text-text-dim">NO LIVE MATCHES</span>
              <span className="font-pixel text-[7px] text-text-dim mt-1">WAITING FOR ACTION...</span>
            </div>
          )}
        </div>

        {/* Pending challenges — accepted but no game yet, or awaiting acceptance */}
        {pendingChallenges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <span className="font-pixel text-[7px] text-neon-yellow">●</span>
              <span className="font-pixel text-[8px] text-text-dim">PENDING CHALLENGES</span>
              <span className="font-pixel text-[7px] text-text-dim">({pendingChallenges.length})</span>
            </div>
            <div className="space-y-1">
              {pendingChallenges.map((m) => (
                <LiveMatchCard
                  key={m.matchId}
                  match={m}
                  isSelected={selectedMatchId === m.matchId}
                  onClick={() => onSelectMatch(m.matchId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent settled results */}
        {recentSettled.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <span className="font-pixel text-[7px] text-text-dim">●</span>
              <span className="font-pixel text-[8px] text-text-dim">RECENT RESULTS</span>
            </div>
            <div className="space-y-1">
              {recentSettled.map((m) => (
                <LiveMatchCard
                  key={m.matchId}
                  match={m}
                  isSelected={selectedMatchId === m.matchId}
                  onClick={() => onSelectMatch(m.matchId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
