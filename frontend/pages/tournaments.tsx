import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { useTournaments, TournamentStatus } from "@/hooks/useTournaments";

// Filter options for tournament status
const FILTERS = [
  { label: "ALL", value: -1 },
  { label: "OPEN", value: TournamentStatus.Registration },
  { label: "ACTIVE", value: TournamentStatus.Active },
  { label: "COMPLETE", value: TournamentStatus.Complete },
] as const;

export default function TournamentsPage() {
  const { tournaments, loading } = useTournaments();
  const [statusFilter, setStatusFilter] = useState<number>(-1);

  // Filtered tournaments based on selected status
  const filtered = useMemo(() => {
    if (statusFilter === -1) return tournaments;
    return tournaments.filter((t) => t.status === statusFilter);
  }, [tournaments, statusFilter]);

  // Summary counts
  const counts = useMemo(() => {
    const total = tournaments.length;
    const active = tournaments.filter((t) => t.status === TournamentStatus.Active).length;
    const registration = tournaments.filter((t) => t.status === TournamentStatus.Registration).length;
    const complete = tournaments.filter((t) => t.status === TournamentStatus.Complete).length;
    return { total, active, registration, complete };
  }, [tournaments]);

  return (
    <div className="min-h-screen bg-monad-dark">
      {/* CRT scanline overlay */}
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-pixel text-lg text-monad-purple glow-purple">
            TOURNAMENTS
          </h1>
          {!loading && tournaments.length > 0 && (
            <div className="flex gap-4 font-pixel text-[9px]">
              <span className="text-text-dim">{counts.total} TOTAL</span>
              <span className="text-neon-green">{counts.active} ACTIVE</span>
              <span className="text-neon-yellow">{counts.registration} OPEN</span>
              <span className="text-text-dim">{counts.complete} DONE</span>
            </div>
          )}
        </div>

        {/* Status filter buttons */}
        {!loading && tournaments.length > 0 && (
          <div className="mb-6 flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`font-pixel text-[9px] px-3 py-1.5 rounded border transition-colors
                  ${statusFilter === f.value
                    ? "border-monad-purple bg-monad-purple/15 text-neon-cyan"
                    : "border-monad-purple/20 text-text-dim hover:text-monad-purple hover:border-monad-purple/40"
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Tournament list */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded border border-monad-purple/10 bg-monad-deeper/50 animate-pulse" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-pixel text-[9px] text-text-dim">NO TOURNAMENTS YET.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-pixel text-[9px] text-text-dim">NO TOURNAMENTS MATCH THIS FILTER.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
