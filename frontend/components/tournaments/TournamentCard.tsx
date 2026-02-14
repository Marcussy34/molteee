import Link from "next/link";
import { PixelAvatar } from "@/components/ui/PixelAvatar";
import { getAgentName } from "@/lib/agentNames";
import { TournamentStatus, TournamentFormat, type TournamentData } from "@/hooks/useTournaments";

interface TournamentCardProps {
  tournament: TournamentData;
}

// Status display config with arcade colors
const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
  [TournamentStatus.Registration]: { label: "OPEN", className: "text-neon-yellow" },
  [TournamentStatus.Active]: { label: "ACTIVE", className: "text-neon-green" },
  [TournamentStatus.Complete]: { label: "DONE", className: "text-text-dim" },
  [TournamentStatus.Cancelled]: { label: "CANCELLED", className: "text-neon-red" },
};

const FORMAT_LABELS: Record<number, string> = {
  [TournamentFormat.RoundRobin]: "ROUND ROBIN",
  [TournamentFormat.DoubleElimination]: "DOUBLE ELIM",
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/**
 * Tournament card for the list page. Links to /tournaments/[id].
 * Arcade-styled to match the rest of the Molteee UI.
 */
export function TournamentCard({ tournament: t }: TournamentCardProps) {
  const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG[TournamentStatus.Registration];
  const hasWinner = t.winner !== ZERO_ADDR;
  const fillPct = Math.min(100, (t.playerCount / t.maxPlayers) * 100);

  return (
    <Link
      href={`/tournaments/${t.id}`}
      className="block group rounded border border-monad-purple/20 bg-monad-deeper/50 p-4 transition-colors hover:border-monad-purple/40 hover:bg-monad-deeper/70"
    >
      {/* Top row: ID + format + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[10px] text-monad-purple">
            #{t.id}
          </span>
          {t.format !== undefined && (
            <span className="font-pixel text-[8px] text-text-dim border border-monad-purple/20 rounded px-1.5 py-0.5">
              {FORMAT_LABELS[t.format] ?? "???"}
            </span>
          )}
        </div>
        <span className={`font-pixel text-[8px] ${statusCfg.className}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="font-pixel text-[7px] text-text-dim mb-0.5">ENTRY FEE</p>
          <p className="font-pixel text-[9px] text-white">{parseFloat(t.entryFee).toFixed(4)} MON</p>
        </div>
        <div>
          <p className="font-pixel text-[7px] text-text-dim mb-0.5">PRIZE POOL</p>
          <p className="font-pixel text-[9px] text-neon-yellow">{parseFloat(t.prizePool).toFixed(4)} MON</p>
        </div>
        <div>
          <p className="font-pixel text-[7px] text-text-dim mb-0.5">PLAYERS</p>
          <p className="font-pixel text-[9px] text-white">
            {t.playerCount} / {t.maxPlayers}
          </p>
        </div>
        <div>
          <p className="font-pixel text-[7px] text-text-dim mb-0.5">WINNER</p>
          {hasWinner ? (
            <div className="flex items-center gap-1.5">
              <PixelAvatar address={t.winner} size={14} />
              <span className="font-pixel text-[8px] text-neon-green truncate">
                {getAgentName(t.winner)}
              </span>
            </div>
          ) : (
            <p className="font-pixel text-[8px] text-text-dim">TBD</p>
          )}
        </div>
      </div>

      {/* Player fill progress bar */}
      <div className="h-1 w-full rounded-full bg-monad-purple/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            t.status === TournamentStatus.Active ? "bg-neon-green" :
            t.status === TournamentStatus.Registration ? "bg-neon-yellow" :
            "bg-text-dim"
          }`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </Link>
  );
}
