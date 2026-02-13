interface SealedBidProps {
  revealed: boolean;
  bidAmount?: string;
  isWinner?: boolean;
  isLoser?: boolean;
  side: "left" | "right";
}

export function SealedBid({ revealed, bidAmount, isWinner, isLoser, side }: SealedBidProps) {
  const slideClass = side === "left" ? "animate-card-slide-left" : "animate-card-slide-right";

  const resultBorder = isWinner
    ? "border-neon-green"
    : isLoser
    ? "border-neon-red"
    : "border-neon-yellow";

  const resultGlow = isWinner
    ? "animate-winner-pulse"
    : "";

  return (
    <div className={`card-flip-container w-36 h-48 ${slideClass}`}>
      <div className={`card-flip-inner ${revealed ? "flipped" : ""}`}>
        {/* Back (sealed) */}
        <div className="card-flip-back flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-monad-purple bg-monad-deeper animate-seal-glow">
          {/* Padlock icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-monad-purple">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-pixel text-[8px] text-monad-purple" style={{ textShadow: "0 0 8px #836EF9" }}>
            SEALED BID
          </span>
        </div>
        {/* Front (revealed) */}
        <div
          className={`card-flip-front flex flex-col items-center justify-center gap-2 rounded-lg border-2 bg-monad-deeper ${resultBorder} ${resultGlow}`}
        >
          <span
            className={`font-pixel text-xl ${
              isWinner ? "text-neon-green" : isLoser ? "text-neon-red" : "text-neon-yellow"
            }`}
            style={{ textShadow: `0 0 12px currentColor` }}
          >
            {bidAmount || "?"}
          </span>
          <span className="font-pixel text-[8px] text-text-dim">MON</span>
        </div>
      </div>
    </div>
  );
}
