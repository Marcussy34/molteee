import Link from "next/link";
import type { Match } from "@/lib/types";

interface MatchFeedProps {
  matches: Match[];
  maxItems?: number;
}

export function MatchFeed({ matches, maxItems = 10 }: MatchFeedProps) {
  const items = matches.slice(0, maxItems);

  return (
    <div className="divide-y divide-monad-purple/10">
      {items.map((m) => {
        const winnerName = m.result === "playerA" ? m.playerA.name : m.playerB.name;
        return (
          <Link
            key={m.id}
            href={`/matches/${m.id}`}
            className="flex items-center justify-between px-4 py-2 hover:bg-monad-purple/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[7px] text-monad-purple">
                {m.gameType.toUpperCase()}
              </span>
              <span className="text-[10px] text-text-dim">
                {m.playerA.name} vs {m.playerB.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[7px] text-neon-green">{winnerName}</span>
              <span className="text-[9px] text-neon-yellow">{m.wager} MON</span>
            </div>
          </Link>
        );
      })}
      {items.length === 0 && (
        <p className="px-4 py-3 text-[10px] text-text-dim">No matches yet</p>
      )}
    </div>
  );
}
