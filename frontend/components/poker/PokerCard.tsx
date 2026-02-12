interface PokerCardProps {
  revealed: boolean;
  handValue?: number;
  folded?: boolean;
  isWinner?: boolean;
  side: "left" | "right";
}

function getStrengthStyle(value: number): { border: string; text: string; glow: string } {
  if (value >= 67) return { border: "border-neon-green", text: "text-neon-green", glow: "#39FF14" };
  if (value >= 34) return { border: "border-neon-yellow", text: "text-neon-yellow", glow: "#FFD700" };
  return { border: "border-neon-red", text: "text-neon-red", glow: "#FF3131" };
}

export function PokerCard({ revealed, handValue, folded, isWinner, side }: PokerCardProps) {
  const slideClass = side === "left" ? "animate-card-slide-left" : "animate-card-slide-right";
  const strength = handValue ? getStrengthStyle(handValue) : null;

  return (
    <div className={`card-flip-container w-28 h-40 ${slideClass}`}>
      <div className={`card-flip-inner ${revealed ? "flipped" : ""}`}>
        {/* Back (face-down) — commit phase */}
        <div className="card-flip-back flex flex-col items-center justify-center rounded-lg border-2 border-monad-purple bg-monad-deeper animate-seal-glow">
          <span className="font-pixel text-2xl text-monad-purple" style={{ textShadow: "0 0 12px #836EF9" }}>
            ?
          </span>
        </div>
        {/* Front (face-up) — reveal phase */}
        <div
          className={`card-flip-front flex flex-col items-center justify-center gap-1 rounded-lg border-2 bg-monad-deeper ${
            folded
              ? "border-neon-red"
              : strength?.border || "border-monad-purple"
          } ${isWinner ? "animate-winner-pulse" : ""}`}
        >
          {folded ? (
            <span
              className="font-pixel text-sm text-neon-red"
              style={{ textShadow: "0 0 10px #FF3131" }}
            >
              FOLDED
            </span>
          ) : (
            <>
              <span className="font-pixel text-[7px] text-text-dim tracking-wider">
                HAND VALUE
              </span>
              <span
                className={`font-pixel text-2xl ${strength?.text || "text-monad-purple"}`}
                style={{ textShadow: `0 0 14px ${strength?.glow || "#836EF9"}` }}
              >
                {handValue ?? "?"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
