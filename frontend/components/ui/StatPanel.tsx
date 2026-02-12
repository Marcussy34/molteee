import { PixelAvatar } from "./PixelAvatar";

interface StatPanelProps {
  address: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  bankroll: string;
  strategy: string;
  side: "left" | "right";
  isWinner?: boolean;
  currentMove?: string;
}

export function StatPanel({
  address,
  name,
  elo,
  wins,
  losses,
  bankroll,
  strategy,
  side,
  isWinner,
  currentMove,
}: StatPanelProps) {
  const align = side === "right" ? "text-right" : "text-left";

  return (
    <div className="flex h-full flex-col p-4">
      {/* Player identity */}
      <div className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
        <PixelAvatar address={address} size={40} />
        <div className={align}>
          <p className={`font-pixel text-xs ${isWinner ? "text-neon-green glow-green" : "text-text-primary"}`}>
            {name}
          </p>
          <p className="text-[8px] text-text-dim font-mono">{address.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 space-y-2">
        <StatRow label="ELO" value={String(elo)} color="text-neon-cyan" align={align} />
        <StatRow label="W/L" value={`${wins}/${losses}`} color="text-text-primary" align={align} />
        <StatRow label="BANK" value={`${bankroll} MON`} color="text-neon-yellow" align={align} />
      </div>

      {/* Strategy */}
      <p className={`mt-3 text-[8px] text-monad-violet ${align}`}>{strategy}</p>

      {/* Current move */}
      {currentMove && (
        <div className={`mt-auto pt-4 ${align}`}>
          <span className="font-pixel text-[8px] text-text-dim">MOVE</span>
          <p className="font-pixel text-sm text-neon-yellow glow-yellow mt-1">
            {String(currentMove).toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color, align }: { label: string; value: string; color: string; align: string }) {
  return (
    <div className={`flex items-center justify-between ${align === "text-right" ? "flex-row-reverse" : ""}`}>
      <span className="font-pixel text-[7px] text-text-dim">{label}</span>
      <span className={`font-pixel text-[10px] ${color}`}>{value}</span>
    </div>
  );
}
