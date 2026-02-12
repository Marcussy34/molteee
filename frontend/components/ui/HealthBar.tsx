interface HealthBarProps {
  value: number; // 0-100
  label?: string;
  maxLabel?: string;
  size?: "sm" | "lg";
}

export function HealthBar({ value, label, maxLabel, size = "sm" }: HealthBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped > 60 ? "bg-neon-green" : clamped > 30 ? "bg-neon-yellow" : "bg-neon-red";
  const height = size === "lg" ? "h-4" : "h-2";

  return (
    <div>
      {(label || maxLabel) && (
        <div className="mb-1 flex items-center justify-between">
          {label && <span className="font-pixel text-[8px] text-text-dim">{label}</span>}
          {maxLabel && <span className="text-[9px] text-text-dim">{maxLabel}</span>}
        </div>
      )}
      <div className={`w-full ${height} rounded-full bg-monad-deeper border border-monad-purple/20 overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
