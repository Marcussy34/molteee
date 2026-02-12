import Link from "next/link";
import { PixelAvatar } from "./PixelAvatar";
import type { LeaderboardEntry } from "@/lib/types";

interface HighScoreTableProps {
  entries: LeaderboardEntry[];
  title?: string;
  className?: string;
}

const rankDecorations: Record<number, { icon: string; class: string }> = {
  1: { icon: "1ST", class: "text-neon-yellow glow-yellow" },
  2: { icon: "2ND", class: "text-gray-300" },
  3: { icon: "3RD", class: "text-amber-600" },
};

export function HighScoreTable({
  entries,
  title = "HIGH SCORES",
  className = "",
}: HighScoreTableProps) {
  return (
    <div className={`${className}`}>
      {/* Header */}
      <h2 className="mb-4 text-center font-pixel text-xl text-neon-yellow glow-yellow animate-blink-soft">
        {title}
      </h2>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-monad-purple/20">
        {/* Header row */}
        <div className="grid grid-cols-[3rem_3rem_1fr_5rem_4rem_4rem_5rem] gap-2 border-b border-monad-purple/20 bg-monad-deeper px-4 py-2">
          <span className="font-pixel text-[8px] text-text-dim">RANK</span>
          <span className="text-[8px] text-text-dim" />
          <span className="font-pixel text-[8px] text-text-dim">AGENT</span>
          <span className="font-pixel text-[8px] text-text-dim text-right">ELO</span>
          <span className="font-pixel text-[8px] text-text-dim text-right">W</span>
          <span className="font-pixel text-[8px] text-text-dim text-right">L</span>
          <span className="font-pixel text-[8px] text-text-dim text-right">WIN%</span>
        </div>

        {/* Rows */}
        {entries.map((entry) => {
          const decoration = rankDecorations[entry.rank];
          return (
            <Link
              key={entry.address}
              href={`/agents/${entry.address}`}
              className="grid grid-cols-[3rem_3rem_1fr_5rem_4rem_4rem_5rem] gap-2 border-b border-monad-purple/10 px-4 py-2.5 transition-colors hover:bg-monad-purple/5"
            >
              {/* Rank */}
              <span
                className={`font-pixel text-sm ${decoration?.class || "text-text-dim"}`}
              >
                {decoration?.icon || `${entry.rank}`}
              </span>

              {/* Avatar */}
              <PixelAvatar address={entry.address} size={28} />

              {/* Name */}
              <div className="flex flex-col justify-center">
                <span className="text-sm text-text-primary">{entry.name}</span>
                <span className="text-[9px] text-text-dim font-mono">
                  {entry.address.slice(0, 8)}...
                </span>
              </div>

              {/* ELO */}
              <span className="flex items-center justify-end font-pixel text-sm text-neon-cyan">
                {entry.elo}
                {entry.recentChange !== 0 && (
                  <span
                    className={`ml-1 text-[8px] ${entry.recentChange > 0 ? "text-neon-green" : "text-neon-red"}`}
                  >
                    {entry.recentChange > 0 ? "+" : ""}
                    {entry.recentChange}
                  </span>
                )}
                {entry.recentChange > 0 && (
                  <span className="ml-2 font-pixel text-[7px] text-neon-yellow glow-yellow animate-blink">
                    NEW HIGH SCORE!!
                  </span>
                )}
              </span>

              {/* W/L/% */}
              <span className="flex items-center justify-end text-sm text-neon-green">
                {entry.wins}
              </span>
              <span className="flex items-center justify-end text-sm text-neon-red">
                {entry.losses}
              </span>
              <span className="flex items-center justify-end font-pixel text-xs text-neon-yellow">
                {entry.winRate}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
