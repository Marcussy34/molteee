import { useRouter } from "next/router";
import Link from "next/link";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { getAgentName } from "@/lib/agentNames";
import { useTournament } from "@/hooks/useTournament";
import { TournamentStatus, TournamentFormat } from "@/hooks/useTournaments";
import { RoundRobinView } from "@/components/tournaments/RoundRobinView";
import { BracketView } from "@/components/tournaments/BracketView";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// Status labels and arcade colors
const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
  [TournamentStatus.Registration]: { label: "OPEN", className: "text-neon-yellow" },
  [TournamentStatus.Active]: { label: "ACTIVE", className: "text-neon-green" },
  [TournamentStatus.Complete]: { label: "COMPLETE", className: "text-text-dim" },
  [TournamentStatus.Cancelled]: { label: "CANCELLED", className: "text-neon-red" },
};

const FORMAT_LABELS: Record<number, string> = {
  [TournamentFormat.RoundRobin]: "ROUND ROBIN",
  [TournamentFormat.DoubleElimination]: "DOUBLE ELIMINATION",
};

export default function TournamentDetailPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const id = rawId ? Number(rawId) : undefined;

  const { tournament, loading, error } = useTournament(id);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-monad-dark">
        <div className="crt-overlay" />
        <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12">
          <div className="space-y-4">
            <div className="h-6 w-48 rounded bg-monad-purple/10 animate-pulse" />
            <div className="h-32 w-full rounded border border-monad-purple/10 bg-monad-deeper/50 animate-pulse" />
            <div className="h-64 w-full rounded border border-monad-purple/10 bg-monad-deeper/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-monad-dark">
        <div className="crt-overlay" />
        <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12">
          <Link href="/tournaments" className="font-pixel text-[9px] text-text-dim hover:text-monad-purple transition-colors">
            &larr; TOURNAMENTS
          </Link>
          <div className="mt-8 text-center py-12 rounded border border-monad-purple/10 bg-monad-deeper/50">
            <p className="font-pixel text-[9px] text-text-dim">{error || "TOURNAMENT NOT FOUND"}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[tournament.status] || STATUS_CONFIG[TournamentStatus.Registration];
  const hasWinner = tournament.winner !== ZERO_ADDR;
  const isRoundRobin = tournament.format === TournamentFormat.RoundRobin;

  return (
    <div className="min-h-screen bg-monad-dark">
      {/* CRT scanline overlay */}
      <div className="crt-overlay" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12">
        {/* Back link */}
        <Link href="/tournaments" className="font-pixel text-[9px] text-text-dim hover:text-monad-purple transition-colors">
          &larr; TOURNAMENTS
        </Link>

        {/* Tournament Header */}
        <div className="mt-4 mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-pixel text-lg text-monad-purple glow-purple">
              TOURNAMENT #{tournament.id}
            </h1>
            <p className="font-pixel text-[9px] text-text-dim mt-1">
              {FORMAT_LABELS[tournament.format ?? 0] || "UNKNOWN FORMAT"}
            </p>
          </div>
          <span className={`font-pixel text-[10px] ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {[
            { label: "ENTRY FEE", value: `${parseFloat(tournament.entryFee).toFixed(4)} MON`, color: "text-white" },
            { label: "PRIZE POOL", value: `${parseFloat(tournament.prizePool).toFixed(4)} MON`, color: "text-neon-yellow" },
            { label: "PLAYERS", value: `${tournament.playerCount} / ${tournament.maxPlayers}`, color: "text-white" },
            {
              label: "MATCHES",
              value: `${tournament.matchesReported} / ${tournament.totalMatches}`,
              color: "text-white",
              suffix: tournament.totalMatches > 0
                ? ` (${Math.round((tournament.matchesReported / tournament.totalMatches) * 100)}%)`
                : "",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded border border-monad-purple/20 bg-monad-deeper/50 px-3 py-2">
              <p className="font-pixel text-[7px] text-text-dim mb-0.5">{stat.label}</p>
              <p className={`font-pixel text-[9px] ${stat.color}`}>
                {stat.value}
                {stat.suffix && <span className="text-text-dim">{stat.suffix}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Winner banner */}
        {hasWinner && (
          <div className="mb-6 rounded border border-neon-green/30 bg-neon-green/5 px-4 py-3 flex items-center gap-3">
            <PixelAvatar address={tournament.winner} size={28} />
            <div>
              <p className="font-pixel text-[7px] text-neon-green uppercase tracking-wider">TOURNAMENT WINNER</p>
              <p className="font-pixel text-[10px] text-neon-green">{getAgentName(tournament.winner)}</p>
            </div>
          </div>
        )}

        {/* Format-specific view */}
        {tournament.status !== TournamentStatus.Registration && (
          <>
            {isRoundRobin && tournament.standings ? (
              <RoundRobinView
                standings={tournament.standings}
                matches={tournament.matches}
                winnerAddress={tournament.winner}
              />
            ) : !isRoundRobin && tournament.bracketData ? (
              <BracketView
                bracketData={tournament.bracketData}
                matches={tournament.matches}
                playerLosses={tournament.playerLosses}
                winnerAddress={tournament.winner}
              />
            ) : null}
          </>
        )}

        {/* Participants Grid */}
        {tournament.participants.length > 0 && (
          <div className="mt-8">
            <h3 className="font-pixel text-[9px] text-text-dim mb-3 uppercase tracking-wider">
              PARTICIPANTS ({tournament.participants.length})
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {tournament.participants.map((addr) => (
                <div
                  key={addr}
                  className={`flex items-center gap-2 rounded border px-3 py-2
                    ${hasWinner && addr.toLowerCase() === tournament.winner.toLowerCase()
                      ? "border-neon-green/30 bg-neon-green/5"
                      : "border-monad-purple/20 bg-monad-deeper/50"
                    }`}
                >
                  <PixelAvatar address={addr} size={18} />
                  <span className="font-pixel text-[8px] text-white truncate">{getAgentName(addr)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
