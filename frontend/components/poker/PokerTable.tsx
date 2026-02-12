import type { PokerState } from "@/hooks/usePokerDirector";
import { PokerCard } from "./PokerCard";
import { ActionLog } from "./ActionLog";
import { ChipStack } from "./ChipStack";

interface PokerTableProps {
  pokerState: PokerState;
  playerAName: string;
  playerBName: string;
}

export function PokerTable({ pokerState, playerAName, playerBName }: PokerTableProps) {
  const {
    phase, actionA, actionB, handValueA, handValueB,
    hasFold, bettingStep, roundWinner, matchWinner, match,
  } = pokerState;

  const showCards = phase === "deal" || phase === "betting" || phase === "showdown" || phase === "round_result";
  // For fold rounds, cards reveal at round_result (showdown is skipped)
  const cardsRevealed = hasFold
    ? phase === "round_result"
    : phase === "showdown" || phase === "round_result";
  const showBetting = phase === "betting" || phase === "showdown" || phase === "round_result";
  const showDealer = phase === "deal" || phase === "betting" || phase === "showdown" || phase === "round_result";
  const wager = match?.wager || "0";

  const foldedA = actionA?.toLowerCase() === "fold";
  const foldedB = actionB?.toLowerCase() === "fold";

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* Table surface */}
      <div
        className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-neon-cyan/30 px-12 py-6"
        style={{
          background: "radial-gradient(ellipse at center, #0f3d2a 0%, #0a2a1a 60%, #061a10 100%)",
          boxShadow: "0 0 30px rgba(0, 240, 255, 0.1), inset 0 0 60px rgba(0, 0, 0, 0.4)",
          minWidth: 480,
          minHeight: 380,
        }}
      >
        {/* Dealer area */}
        {showDealer && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              {/* Card icon */}
              <div className="w-4 h-5 rounded-sm border border-monad-purple/60 bg-monad-deeper flex items-center justify-center">
                <span className="font-pixel text-[6px] text-monad-purple">D</span>
              </div>
              <span
                className="font-pixel text-[10px] text-monad-purple tracking-widest"
                style={{ textShadow: "0 0 8px #836EF9" }}
              >
                DEALER
              </span>
            </div>
            {phase === "deal" && (
              <span className="font-pixel text-[8px] text-neon-cyan animate-blink">
                DEALING...
              </span>
            )}
            {phase === "betting" && (
              <span className="font-pixel text-[8px] text-neon-yellow">
                BETTING
              </span>
            )}
          </div>
        )}

        {/* Cards + Pot row */}
        <div className="flex items-center justify-center gap-8">
          {/* Card A */}
          {showCards && (
            <PokerCard
              revealed={cardsRevealed}
              handValue={handValueA}
              folded={cardsRevealed && foldedA}
              isWinner={cardsRevealed && roundWinner === "A"}
              side="left"
            />
          )}

          {/* Center Pot */}
          <ChipStack amount={wager} side="center" />

          {/* Card B */}
          {showCards && (
            <PokerCard
              revealed={cardsRevealed}
              handValue={handValueB}
              folded={cardsRevealed && foldedB}
              isWinner={cardsRevealed && roundWinner === "B"}
              side="right"
            />
          )}
        </div>

        {/* Action Log (below cards) */}
        {showBetting && (
          <ActionLog
            actionA={actionA}
            actionB={actionB}
            bettingStep={bettingStep}
            playerAName={playerAName}
            playerBName={playerBName}
          />
        )}

        {/* Chip stacks row */}
        {showBetting && (
          <div className="flex w-full items-center justify-between px-8">
            <ChipStack amount={wager} side="left" animated={phase === "betting"} />
            <ChipStack amount={wager} side="right" animated={phase === "betting"} />
          </div>
        )}

        {/* Player names row */}
        <div className="flex w-full items-center justify-between px-4">
          <span className={`font-pixel text-[10px] ${roundWinner === "A" ? "text-neon-green glow-green" : "text-text-primary"}`}>
            {playerAName}
          </span>
          <span className={`font-pixel text-[10px] ${roundWinner === "B" ? "text-neon-green glow-green" : "text-text-primary"}`}>
            {playerBName}
          </span>
        </div>
      </div>

      {/* Phase overlays */}
      {(phase === "entrance_a" || phase === "entrance_b") && match && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-pixel text-lg text-monad-purple animate-blink" style={{ textShadow: "0 0 15px #836EF9" }}>
            {phase === "entrance_a" ? playerAName : playerBName}
          </span>
        </div>
      )}

      {phase === "showdown" && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <span className="font-pixel text-xl text-neon-yellow animate-blink" style={{ textShadow: "0 0 20px #FFD700" }}>
            SHOWDOWN!
          </span>
        </div>
      )}

      {phase === "round_result" && roundWinner && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded border border-monad-purple/30 bg-monad-deeper/80 px-6 py-2 backdrop-blur-sm">
          {roundWinner === "draw" ? (
            <span className="font-pixel text-sm text-neon-yellow">DRAW</span>
          ) : hasFold ? (
            <span className="font-pixel text-sm text-neon-red">
              {foldedA ? playerAName : playerBName} FOLDED
            </span>
          ) : (
            <span className="font-pixel text-[9px] text-text-primary">
              <span className={roundWinner === "A" ? "text-neon-green" : "text-neon-red"}>
                {handValueA ?? "?"}
              </span>
              {" vs "}
              <span className={roundWinner === "B" ? "text-neon-green" : "text-neon-red"}>
                {handValueB ?? "?"}
              </span>
              <span className="text-neon-green ml-2">
                {roundWinner === "A" ? playerAName : playerBName} WINS
              </span>
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
