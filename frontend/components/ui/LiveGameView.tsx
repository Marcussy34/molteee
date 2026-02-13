import type { LiveGameState } from "@/hooks/useLiveGameState";
import { getAgentName, truncateAddress } from "@/lib/agentNames";
import { rpsMoveLabel } from "@/lib/liveStateAdapters";
import { formatEther } from "viem";

// ─── Countdown helper ─────────────────────────────────────────────────────────

function useCountdown(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = deadline - now;
  if (remaining <= 0 || deadline === 0) return "";
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ─── Commit status indicator ──────────────────────────────────────────────────

function CommitDot({ committed, revealed, label }: { committed?: boolean; revealed?: boolean; label: string }) {
  const color = revealed
    ? "text-neon-green"
    : committed
      ? "text-neon-yellow"
      : "text-text-dim";
  const status = revealed ? "REVEALED" : committed ? "COMMITTED" : "WAITING";
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-pixel text-[7px] ${color}`}>●</span>
      <span className="font-pixel text-[7px] text-text-dim">{label}</span>
      <span className={`font-pixel text-[7px] ${color}`}>{status}</span>
    </div>
  );
}

// ─── RPS View ─────────────────────────────────────────────────────────────────
// (Used when ArenaScene is not rendered, e.g., on mobile or fallback)

function RpsView({ state }: { state: LiveGameState }) {
  const p1Name = getAgentName(state.player1);
  const p2Name = getAgentName(state.player2);
  const countdown = useCountdown(state.phaseDeadline);

  return (
    <div className="space-y-4">
      {/* Round + score */}
      <div className="text-center">
        <span className="font-pixel text-[8px] text-text-dim">
          ROUND {(state.currentRound || 0) + 1} OF {state.totalRounds || 3}
        </span>
        <div className="flex items-center justify-center gap-4 mt-1">
          <span className="font-pixel text-sm text-neon-green">{p1Name}</span>
          <span className="font-pixel text-lg text-neon-yellow">
            {state.p1Score} - {state.p2Score}
          </span>
          <span className="font-pixel text-sm text-neon-red">{p2Name}</span>
        </div>
      </div>

      {/* Phase + countdown */}
      <div className="text-center">
        <span className="font-pixel text-[10px] text-monad-purple">{state.phase}</span>
        {countdown && (
          <span className="font-pixel text-[8px] text-neon-yellow ml-2">{countdown}</span>
        )}
      </div>

      {/* Commit/reveal status */}
      <div className="flex justify-between px-4">
        <CommitDot committed={state.p1Committed} revealed={state.p1Revealed} label={p1Name} />
        <CommitDot committed={state.p2Committed} revealed={state.p2Revealed} label={p2Name} />
      </div>

      {/* Revealed moves */}
      {(state.p1Move && state.p1Move > 0) || (state.p2Move && state.p2Move > 0) ? (
        <div className="flex justify-center gap-8">
          {state.p1Move && state.p1Move > 0 && (
            <div className="text-center">
              <span className="font-pixel text-[7px] text-text-dim">{p1Name}</span>
              <p className="font-pixel text-sm text-neon-yellow mt-0.5">
                {rpsMoveLabel(state.p1Move).toUpperCase()}
              </p>
            </div>
          )}
          {state.p2Move && state.p2Move > 0 && (
            <div className="text-center">
              <span className="font-pixel text-[7px] text-text-dim">{p2Name}</span>
              <p className="font-pixel text-sm text-neon-yellow mt-0.5">
                {rpsMoveLabel(state.p2Move).toUpperCase()}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Poker View ───────────────────────────────────────────────────────────────

function PokerView({ state }: { state: LiveGameState }) {
  const p1Name = getAgentName(state.player1);
  const p2Name = getAgentName(state.player2);
  const countdown = useCountdown(state.phaseDeadline);
  const budget = state.startingBudget || 150;

  // Budget bar percentage
  const p1Pct = Math.round(((state.p1Budget || 0) / budget) * 100);
  const p2Pct = Math.round(((state.p2Budget || 0) / budget) * 100);

  // Current turn indicator
  const isTurnP1 = state.currentTurn?.toLowerCase() === state.player1.toLowerCase();

  return (
    <div className="space-y-4">
      {/* Round + score */}
      <div className="text-center">
        <span className="font-pixel text-[8px] text-text-dim">
          ROUND {(state.currentRound || 0) + 1} OF {state.totalRounds || 3}
        </span>
        <div className="flex items-center justify-center gap-4 mt-1">
          <span className="font-pixel text-sm text-neon-green">{p1Name}</span>
          <span className="font-pixel text-lg text-neon-yellow">
            {state.p1Score} - {state.p2Score}
          </span>
          <span className="font-pixel text-sm text-neon-red">{p2Name}</span>
        </div>
      </div>

      {/* Phase + countdown */}
      <div className="text-center">
        <span className="font-pixel text-[10px] text-neon-cyan">{state.phase}</span>
        {countdown && (
          <span className="font-pixel text-[8px] text-neon-yellow ml-2">{countdown}</span>
        )}
      </div>

      {/* Budget bars */}
      <div className="px-4 space-y-2">
        <div>
          <div className="flex justify-between mb-0.5">
            <span className={`font-pixel text-[7px] ${isTurnP1 ? "text-neon-green animate-pulse" : "text-text-dim"}`}>
              {p1Name} {isTurnP1 ? "◄ TURN" : ""}
            </span>
            <span className="font-pixel text-[7px] text-text-dim">{state.p1Budget}/{budget}</span>
          </div>
          <div className="h-2 bg-monad-deeper rounded-sm overflow-hidden border border-monad-purple/20">
            <div
              className="h-full bg-neon-green transition-all"
              style={{ width: `${p1Pct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-0.5">
            <span className={`font-pixel text-[7px] ${!isTurnP1 && state.currentTurn ? "text-neon-red animate-pulse" : "text-text-dim"}`}>
              {p2Name} {!isTurnP1 && state.currentTurn ? "◄ TURN" : ""}
            </span>
            <span className="font-pixel text-[7px] text-text-dim">{state.p2Budget}/{budget}</span>
          </div>
          <div className="h-2 bg-monad-deeper rounded-sm overflow-hidden border border-monad-purple/20">
            <div
              className="h-full bg-neon-red transition-all"
              style={{ width: `${p2Pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current bet */}
      {state.currentBet !== undefined && state.currentBet > BigInt(0) && (
        <div className="text-center">
          <span className="font-pixel text-[7px] text-text-dim">CURRENT BET</span>
          <p className="font-pixel text-sm text-neon-yellow">{Number(state.currentBet)} PTS</p>
        </div>
      )}

      {/* Commit/reveal status */}
      <div className="flex justify-between px-4">
        <CommitDot committed={state.p1Committed} revealed={state.p1Revealed} label={p1Name} />
        <CommitDot committed={state.p2Committed} revealed={state.p2Revealed} label={p2Name} />
      </div>
    </div>
  );
}

// ─── Auction View ─────────────────────────────────────────────────────────────

function AuctionView({ state }: { state: LiveGameState }) {
  const p1Name = getAgentName(state.player1);
  const p2Name = getAgentName(state.player2);
  const countdown = useCountdown(state.phaseDeadline);

  return (
    <div className="space-y-4">
      {/* Prize pool */}
      {state.prize !== undefined && (
        <div className="text-center">
          <span className="font-pixel text-[7px] text-text-dim">PRIZE POOL</span>
          <p className="font-pixel text-lg text-neon-yellow glow-yellow">
            {formatEther(state.prize)} MON
          </p>
        </div>
      )}

      {/* Phase + countdown */}
      <div className="text-center">
        <span className="font-pixel text-[10px] text-neon-yellow">{state.phase}</span>
        {countdown && (
          <span className="font-pixel text-[8px] text-neon-yellow ml-2">{countdown}</span>
        )}
      </div>

      {/* Commit/reveal status */}
      <div className="flex justify-between px-4">
        <CommitDot committed={state.p1Committed} revealed={state.p1Revealed} label={p1Name} />
        <CommitDot committed={state.p2Committed} revealed={state.p2Revealed} label={p2Name} />
      </div>

      {/* Revealed bids */}
      {state.p1Revealed && state.p2Revealed && state.p1Bid !== undefined && state.p2Bid !== undefined && (
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <span className="font-pixel text-[7px] text-text-dim">{p1Name}</span>
            <p className="font-pixel text-sm text-neon-green">{formatEther(state.p1Bid)} MON</p>
          </div>
          <div className="text-center">
            <span className="font-pixel text-[7px] text-text-dim">{p2Name}</span>
            <p className="font-pixel text-sm text-neon-red">{formatEther(state.p2Bid)} MON</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LiveGameViewProps {
  state: LiveGameState;
}

export function LiveGameView({ state }: LiveGameViewProps) {
  return (
    <div className="rounded border border-monad-purple/20 bg-monad-deeper/60 p-4">
      {state.gameType === "rps" && <RpsView state={state} />}
      {state.gameType === "poker" && <PokerView state={state} />}
      {state.gameType === "auction" && <AuctionView state={state} />}
    </div>
  );
}
