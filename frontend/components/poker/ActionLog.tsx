interface ActionLogProps {
  actionA?: string;
  actionB?: string;
  bettingStep: number;
  playerAName: string;
  playerBName: string;
}

const ACTION_BADGE_COLORS: Record<string, string> = {
  check: "bg-neon-green/20 text-neon-green border-neon-green/40",
  raise: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40",
  call: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40",
  fold: "bg-neon-red/20 text-neon-red border-neon-red/40",
};

function ActionBadge({ playerName, action }: { playerName: string; action: string }) {
  const colors = ACTION_BADGE_COLORS[action.toLowerCase()] || "bg-monad-purple/20 text-monad-purple border-monad-purple/40";
  return (
    <div className="flex items-center gap-2 animate-fade-in-up">
      <span className="font-pixel text-[8px] text-text-dim">{playerName}</span>
      <span className={`font-pixel text-[9px] px-2 py-0.5 rounded border ${colors}`}>
        {action.toUpperCase()}
      </span>
    </div>
  );
}

export function ActionLog({ actionA, actionB, bettingStep, playerAName, playerBName }: ActionLogProps) {
  return (
    <div className="flex flex-col items-center gap-2 min-h-[48px]">
      {bettingStep >= 0 && actionA && (
        <ActionBadge playerName={playerAName} action={actionA} />
      )}
      {bettingStep >= 1 && actionB && (
        <ActionBadge playerName={playerBName} action={actionB} />
      )}
    </div>
  );
}
