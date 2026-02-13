import { useState } from "react";
import Link from "next/link";
import { HighScoreTable } from "@/components/ui/HighScoreTable";
import { useLeaderboard, type LeaderboardFilter } from "@/hooks/useLeaderboard";

const GAME_FILTERS: { key: LeaderboardFilter; label: string }[] = [
  { key: "", label: "ALL" },
  { key: "rps", label: "RPS" },
  { key: "poker", label: "POKER" },
  { key: "auction", label: "AUCTION" },
];

export default function LeaderboardPage() {
  const [filter, setFilter] = useState<LeaderboardFilter>("");
  const { entries, loading, refresh } = useLeaderboard(filter);

  return (
    <div className="min-h-screen bg-monad-dark">
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="font-pixel text-xs text-text-dim hover:text-monad-purple transition-colors">
            &larr; BACK TO RPS
          </Link>
        </div>

        {/* Game type filter + refresh */}
        <div className="mb-6 flex flex-wrap justify-center items-center gap-2">
          {GAME_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-pixel text-[10px] px-4 py-2 rounded border transition-all ${
                filter === f.key
                  ? "border-monad-purple bg-monad-purple/20 text-monad-purple"
                  : "border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={refresh}
            disabled={loading}
            className="font-pixel text-[10px] px-4 py-2 rounded border border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh from blockchain"
          >
            REFRESH
          </button>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center">
            <span className="font-pixel text-sm text-monad-purple animate-blink-soft">
              LOADING...
            </span>
          </div>
        ) : (
          <HighScoreTable entries={entries} />
        )}
      </div>
    </div>
  );
}
