interface ChipStackProps {
  amount: string;
  side?: "left" | "right" | "center";
  animated?: boolean;
}

export function ChipStack({ amount, side = "center", animated = false }: ChipStackProps) {
  const chipColors = ["bg-neon-yellow", "bg-monad-purple", "bg-neon-yellow", "bg-monad-purple", "bg-neon-yellow"];
  const animClass = animated
    ? side === "left"
      ? "animate-chip-to-center-left"
      : side === "right"
      ? "animate-chip-to-center-right"
      : ""
    : "";

  const isCenter = side === "center";

  return (
    <div className={`flex flex-col items-center gap-0.5 ${animClass}`}>
      {/* Chip stack */}
      <div className="flex flex-col-reverse items-center gap-px">
        {chipColors.slice(0, isCenter ? 5 : 3).map((color, i) => (
          <div
            key={i}
            className={`w-6 h-1.5 rounded-sm ${color} opacity-80`}
          />
        ))}
      </div>
      {/* Amount */}
      <span
        className={`font-pixel mt-1 ${
          isCenter
            ? "text-[10px] text-neon-yellow glow-yellow"
            : "text-[8px] text-text-dim"
        }`}
      >
        {isCenter ? `POT: ${amount} MON` : `${amount} MON`}
      </span>
    </div>
  );
}
