import type { AuctionState } from "@/hooks/useAuctionDirector";
import { SealedBid } from "./SealedBid";

interface AuctionStageProps {
  auctionState: AuctionState;
  playerAName: string;
  playerBName: string;
}

const COUNTDOWN_COLORS: Record<number, string> = {
  3: "text-monad-purple",
  2: "text-neon-cyan",
  1: "text-neon-yellow",
  0: "text-neon-green",
};

const COUNTDOWN_TEXT: Record<number, string> = {
  3: "3",
  2: "2",
  1: "1",
  0: "REVEAL!",
};

export function AuctionStage({ auctionState, playerAName, playerBName }: AuctionStageProps) {
  const { phase, bidA, bidB, roundWinner, matchWinner, match, countdownNumber } = auctionState;

  const showEnvelopes = phase === "sealed" || phase === "countdown" || phase === "reveal_a" || phase === "reveal_b" || phase === "result";
  const revealA = phase === "reveal_a" || phase === "reveal_b" || phase === "result";
  const revealB = phase === "reveal_b" || phase === "result";
  const showResult = phase === "result";
  const wager = match?.wager || "0";
  const prize = (parseFloat(wager) * 2).toFixed(1);

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* Stage surface */}
      <div
        className="relative flex flex-col items-center justify-center gap-8 rounded-2xl border-2 border-monad-purple/30 px-12 py-10"
        style={{
          background: "radial-gradient(ellipse at center, #1a1040 0%, #0d0a24 60%, #08061A 100%)",
          boxShadow: "0 0 30px rgba(131, 110, 249, 0.1), inset 0 0 60px rgba(0, 0, 0, 0.4)",
          minWidth: 480,
          minHeight: 340,
        }}
      >
        {/* Title */}
        {(phase === "sealed" || phase === "countdown") && (
          <span className="font-pixel text-[10px] text-monad-purple glow-purple tracking-wider">
            SEALED BID AUCTION
          </span>
        )}

        {/* Countdown */}
        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span
              key={countdownNumber}
              className={`font-pixel text-5xl animate-countdown-pop ${COUNTDOWN_COLORS[countdownNumber] || "text-monad-purple"}`}
              style={{ textShadow: "0 0 30px currentColor" }}
            >
              {COUNTDOWN_TEXT[countdownNumber] || ""}
            </span>
          </div>
        )}

        {/* Envelopes row */}
        {showEnvelopes && (
          <div className="flex items-center justify-center gap-8">
            <SealedBid
              revealed={revealA}
              bidAmount={bidA}
              isWinner={showResult && roundWinner === "A"}
              isLoser={showResult && roundWinner === "B"}
              side="left"
            />

            <span className="font-pixel text-sm text-neon-red" style={{ textShadow: "0 0 10px #FF3131" }}>
              VS
            </span>

            <SealedBid
              revealed={revealB}
              bidAmount={bidB}
              isWinner={showResult && roundWinner === "B"}
              isLoser={showResult && roundWinner === "A"}
              side="right"
            />
          </div>
        )}

        {/* Prize display */}
        {showEnvelopes && (
          <span className="font-pixel text-[9px] text-neon-yellow glow-yellow">
            PRIZE: {prize} MON
          </span>
        )}

        {/* Player names */}
        {showEnvelopes && (
          <div className="flex w-full items-center justify-between px-8">
            <span className={`font-pixel text-[10px] ${roundWinner === "A" && showResult ? "text-neon-green glow-green" : "text-text-primary"}`}>
              {playerAName}
            </span>
            <span className={`font-pixel text-[10px] ${roundWinner === "B" && showResult ? "text-neon-green glow-green" : "text-text-primary"}`}>
              {playerBName}
            </span>
          </div>
        )}
      </div>

      {/* Phase overlays */}
      {(phase === "entrance_a" || phase === "entrance_b") && match && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-pixel text-lg text-monad-purple animate-blink" style={{ textShadow: "0 0 15px #836EF9" }}>
            {phase === "entrance_a" ? playerAName : playerBName}
          </span>
        </div>
      )}

      {phase === "result" && roundWinner && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded border border-monad-purple/30 bg-monad-deeper/80 px-6 py-2 backdrop-blur-sm">
          {roundWinner === "draw" ? (
            <span className="font-pixel text-sm text-neon-yellow">TIE - SPLIT POT</span>
          ) : (
            <span className={`font-pixel text-sm ${roundWinner === "A" ? "text-neon-green" : "text-neon-red"}`}>
              HIGHEST BIDDER WINS
            </span>
          )}
        </div>
      )}

      {phase === "victory" && match && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-pixel text-3xl text-neon-green block" style={{ textShadow: "0 0 30px #39FF14" }}>
            {matchWinner === "A" ? playerAName : playerBName}
          </span>
          <span className="font-pixel text-lg text-neon-yellow mt-2 block">
            WINS!
          </span>
        </div>
      )}
    </div>
  );
}
