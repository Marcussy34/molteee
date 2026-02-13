import { useState, useEffect } from "react";
import Link from "next/link";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import type { Match } from "@/lib/types";

const GAME_FILTERS = [
  { key: "", label: "ALL" },
  { key: "rps", label: "RPS" },
  { key: "poker", label: "POKER" },
  { key: "auction", label: "AUCTION" },
];

const RESULT_FILTERS = [
  { key: "", label: "ALL" },
  { key: "playerA", label: "P1 WINS" },
  { key: "playerB", label: "P2 WINS" },
  { key: "draw", label: "DRAW" },
];

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (gameFilter) params.set("gameType", gameFilter);
    const qs = params.toString();
    fetch(`/api/match-data${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMatches(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gameFilter]);

  const filtered = resultFilter
    ? matches.filter((m) => m.result === resultFilter)
    : matches;

  return (
    <div className="min-h-screen bg-monad-dark">
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/arena" className="font-pixel text-xs text-text-dim hover:text-monad-purple transition-colors">
            &larr; RPS
          </Link>
          <h1 className="font-pixel text-lg text-monad-purple glow-purple">MATCH HISTORY</h1>
          <span className="font-pixel text-[9px] text-text-dim">
            {filtered.length} MATCHES
          </span>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Game type filter */}
          <div className="flex gap-2">
            <span className="font-pixel text-[8px] text-text-dim self-center mr-1">GAME:</span>
            {GAME_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setGameFilter(f.key)}
                className={`font-pixel text-[9px] px-3 py-1.5 rounded border transition-all ${
                  gameFilter === f.key
                    ? "border-monad-purple bg-monad-purple/20 text-monad-purple"
                    : "border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Result filter */}
          <div className="flex gap-2">
            <span className="font-pixel text-[8px] text-text-dim self-center mr-1">RESULT:</span>
            {RESULT_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setResultFilter(f.key)}
                className={`font-pixel text-[9px] px-3 py-1.5 rounded border transition-all ${
                  resultFilter === f.key
                    ? "border-monad-purple bg-monad-purple/20 text-monad-purple"
                    : "border-monad-purple/20 text-text-dim hover:border-monad-purple/40 hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Match table */}
        {loading ? (
          <div className="text-center py-12">
            <span className="font-pixel text-sm text-monad-purple animate-blink-soft">
              LOADING...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-pixel text-sm text-text-dim">NO MATCHES FOUND</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_60px_1fr_80px_80px_70px] gap-2 px-4 py-2 text-[8px] text-text-dim font-pixel">
              <span>TYPE</span>
              <span>PLAYER A</span>
              <span>VS</span>
              <span>PLAYER B</span>
              <span>RESULT</span>
              <span>WAGER</span>
              <span>ELO</span>
            </div>

            {/* Match rows */}
            {filtered.map((m) => {
              const date = new Date(m.timestamp * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              const winnerIsA = m.result === "playerA";
              const isDraw = m.result === "draw";

              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="grid grid-cols-[60px_1fr_60px_1fr_80px_80px_70px] gap-2 items-center rounded border border-monad-purple/10 bg-monad-deeper/50 px-4 py-3 transition-colors hover:bg-monad-purple/5 hover:border-monad-purple/25"
                >
                  {/* Game type */}
                  <span className="font-pixel text-[9px] text-monad-purple">
                    {m.gameType.toUpperCase()}
                  </span>

                  {/* Player A */}
                  <div className="flex items-center gap-2 overflow-hidden">
                    <PixelAvatar address={m.playerA.address} size={20} />
                    <span className={`text-xs truncate ${winnerIsA ? "text-neon-green" : "text-text-primary"}`}>
                      {m.playerA.name}
                    </span>
                  </div>

                  {/* VS */}
                  <span className="text-center text-[8px] text-text-dim">vs</span>

                  {/* Player B */}
                  <div className="flex items-center gap-2 overflow-hidden">
                    <PixelAvatar address={m.playerB.address} size={20} />
                    <span className={`text-xs truncate ${!winnerIsA && !isDraw ? "text-neon-green" : "text-text-primary"}`}>
                      {m.playerB.name}
                    </span>
                  </div>

                  {/* Result */}
                  <span className={`font-pixel text-[9px] ${isDraw ? "text-neon-yellow" : winnerIsA ? "text-neon-green" : "text-neon-red"}`}>
                    {isDraw ? "DRAW" : winnerIsA ? "P1 WIN" : "P2 WIN"}
                  </span>

                  {/* Wager */}
                  <span className="text-[10px] text-neon-yellow">{m.wager} MON</span>

                  {/* ELO change */}
                  <div className="text-[9px]">
                    <span className={m.eloChange.playerA >= 0 ? "text-neon-green" : "text-neon-red"}>
                      {m.eloChange.playerA >= 0 ? "+" : ""}{m.eloChange.playerA}
                    </span>
                    <span className="text-text-dim"> / </span>
                    <span className={m.eloChange.playerB >= 0 ? "text-neon-green" : "text-neon-red"}>
                      {m.eloChange.playerB >= 0 ? "+" : ""}{m.eloChange.playerB}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
