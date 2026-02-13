import { useState, useEffect } from "react";
import Link from "next/link";
import { HighScoreTable } from "@/components/ui/HighScoreTable";
import type { LeaderboardEntry } from "@/lib/types";

const GAME_FILTERS = [
  { key: "", label: "ALL" },
  { key: "rps", label: "RPS" },
  { key: "poker", label: "POKER" },
  { key: "auction", label: "AUCTION" },
];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = filter
      ? `/api/leaderboard-data?game=${filter}`
      : "/api/leaderboard-data";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setEntries(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

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

        {/* Game type filter */}
        <div className="mb-6 flex justify-center gap-2">
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
