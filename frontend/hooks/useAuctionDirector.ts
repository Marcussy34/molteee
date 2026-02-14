import { useState, useEffect, useRef, useCallback } from "react";
import { sfx } from "@/lib/sound";
import type { Match, MatchRound } from "@/lib/types";
import type { LiveGameState } from "@/hooks/useLiveGameState";

// ─── Phase Types ───────────────────────────────────────────────

export type AuctionPhase =
  | "idle"
  | "entrance_a"
  | "entrance_b"
  | "sealed"
  | "countdown"
  | "reveal_a"
  | "reveal_b"
  | "result"
  | "victory"
  | "reset";

export interface AuctionState {
  phase: AuctionPhase;
  phaseElapsed: number;
  phaseStartTime: number;
  phaseDuration: number;
  roundIndex: number;
  matchIndex: number;
  match: Match | null;
  currentRound: MatchRound | null;
  roundWinner: "A" | "B" | "draw" | null;
  matchWinner: "A" | "B" | null;
  bidA?: string;
  bidB?: string;
  countdownNumber: number; // 3, 2, 1, or 0 (REVEAL)
  // ─── Live mode fields ──────────────────────────────────────────
  isLiveMode: boolean;
  waitingFor: string | null;
  chainPhaseLabel: string | null;
}

// ─── Phase Durations (ms) ──────────────────────────────────────

const REPLAY_DURATIONS: Record<AuctionPhase, number> = {
  idle: Infinity,
  entrance_a: 2000,
  entrance_b: 2000,
  sealed: 3000,
  countdown: 3000,
  reveal_a: 2000,
  reveal_b: 2000,
  result: 3500,
  victory: 4500,
  reset: 2000,
};

// Cinematic durations for live mode
const CINEMATIC_DURATIONS: Partial<Record<AuctionPhase, number>> = {
  entrance_a: 2000,
  entrance_b: 2000,
  countdown: 3000,
  reveal_a: 2000,
  reveal_b: 2000,
  result: 3500,
  victory: 4500,
};

// Phases that lock out chain state changes while animating
const CINEMATIC_PHASES = new Set<AuctionPhase>(["countdown", "reveal_a", "reveal_b", "result", "victory"]);

// ─── Phase Transition Map (replay mode) ─────────────────────────

function getNextPhaseReplay(
  current: AuctionPhase,
  roundIndex: number,
  totalRounds: number
): AuctionPhase {
  switch (current) {
    case "idle":
      return "entrance_a";
    case "entrance_a":
      return "entrance_b";
    case "entrance_b":
      return "sealed";
    case "sealed":
      return "countdown";
    case "countdown":
      return "reveal_a";
    case "reveal_a":
      return "reveal_b";
    case "reveal_b":
      return "result";
    case "result":
      if (roundIndex < totalRounds - 1) return "sealed";
      return "victory";
    case "victory":
      return "reset";
    case "reset":
      return "entrance_a";
    default:
      return "idle";
  }
}

// ─── Live mode: map chain state → auction phase ──────────────────

function chainStateToAuctionPhase(
  chainState: LiveGameState,
): { phase: AuctionPhase; waitingFor: string | null } {
  if (chainState.settled) {
    return { phase: "victory", waitingFor: null };
  }

  // AuctionGame phases: 0=Commit, 1=Reveal, 2=Complete (no Idle)
  const { phaseRaw, commitCount, revealCount } = chainState;

  switch (phaseRaw) {
    case 0: // Commit (sealed bidding)
      if (commitCount < 2) {
        return { phase: "sealed", waitingFor: `SEALING BIDS... ${commitCount}/2` };
      }
      return { phase: "sealed", waitingFor: "BIDS SEALED" };
    case 1: // Reveal
      if (revealCount === 0) {
        return { phase: "countdown", waitingFor: null }; // Dramatic countdown before reveals
      }
      if (revealCount === 1) {
        // One revealed — show that reveal, wait for second
        return { phase: "reveal_a", waitingFor: "WAITING FOR SECOND REVEAL..." };
      }
      // Both revealed — show results
      return { phase: "result", waitingFor: null };
    case 2: // Complete
      return { phase: "victory", waitingFor: null };
    default:
      return { phase: "sealed", waitingFor: null };
  }
}

// ─── Build chain phase label for UI ─────────────────────────────

function buildAuctionChainLabel(chainState: LiveGameState): string {
  if (chainState.settled) return "AUCTION COMPLETE";

  const { phaseRaw, commitCount, revealCount } = chainState;

  // Auction: 0=Commit, 1=Reveal, 2=Complete
  switch (phaseRaw) {
    case 0:
      if (commitCount < 2) return `SEALED BIDDING — ${commitCount}/2 SUBMITTED`;
      return "ALL BIDS SEALED";
    case 1:
      if (revealCount < 2) return `REVEALING BIDS — ${revealCount}/2`;
      return "BIDS REVEALED!";
    case 2: return "COMPLETE";
    default: return chainState.phase;
  }
}

// ─── SFX Triggers ──────────────────────────────────────────────

function playSfxForPhase(phase: AuctionPhase) {
  switch (phase) {
    case "entrance_a":
    case "entrance_b":
      sfx.entrance();
      break;
    case "sealed":
      sfx.coin();
      break;
    case "countdown":
      sfx.tension();
      break;
    case "reveal_a":
    case "reveal_b":
      sfx.click();
      break;
    case "result":
      sfx.clash();
      break;
    case "victory":
      sfx.victoryFanfare();
      break;
  }
}

// ─── Hook ──────────────────────────────────────────────────────

export function useAuctionDirector(
  matches: Match[],
  liveChainState?: LiveGameState | null,
): AuctionState {
  const [phase, setPhase] = useState<AuctionPhase>("idle");
  const [phaseStartTime, setPhaseStartTime] = useState(Date.now());
  const [roundIndex, setRoundIndex] = useState(0);
  const [matchIndex, setMatchIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);

  // ─── Live mode state ──────────────────────────────────────────
  const cinematicLockRef = useRef(false);
  const entranceDoneRef = useRef(false);
  const prevCommitCountRef = useRef(0);

  const isLiveMode = !!(liveChainState && !liveChainState.settled);

  const match = matches.length > 0 ? matches[matchIndex % matches.length] : null;
  const totalRounds = match?.rounds?.length || 1;
  const currentRound = match?.rounds?.[roundIndex] || null;

  const matchWinner =
    match?.result === "playerA" ? "A" as const :
    match?.result === "playerB" ? "B" as const :
    null;

  const roundWinner =
    currentRound?.winner === "A" ? "A" as const :
    currentRound?.winner === "B" ? "B" as const :
    currentRound?.winner === "draw" ? "draw" as const :
    null;

  const bidA = currentRound?.bidA;
  const bidB = currentRound?.bidB;

  // Compute countdown number from phaseElapsed (3→2→1→0)
  const countdownNumber = phase === "countdown"
    ? phaseElapsed < 0.25 ? 3 : phaseElapsed < 0.5 ? 2 : phaseElapsed < 0.75 ? 1 : 0
    : 3;

  // ─── Transition to next phase ────────────────────────────────

  const transitionTo = useCallback(
    (nextPhase: AuctionPhase) => {
      playSfxForPhase(nextPhase);
      setPhase(nextPhase);
      setPhaseStartTime(Date.now());
    },
    []
  );

  // ─── REPLAY MODE: Phase timer ─────────────────────────────────

  useEffect(() => {
    if (isLiveMode) return;
    if (phase === "idle") return;
    if (!match) return;

    const duration = REPLAY_DURATIONS[phase];
    if (duration === Infinity) return;

    timerRef.current = setTimeout(() => {
      const next = getNextPhaseReplay(phase, roundIndex, totalRounds);

      if (phase === "result" && next === "sealed") {
        setRoundIndex((prev) => prev + 1);
      }

      if (phase === "reset") {
        setRoundIndex(0);
        setMatchIndex((prev) => prev + 1);
      }

      transitionTo(next);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, roundIndex, totalRounds, match, transitionTo, isLiveMode]);

  // ─── LIVE MODE: React to chain state changes ──────────────────

  useEffect(() => {
    if (!isLiveMode || !liveChainState) return;

    // Play entrance once
    if (!entranceDoneRef.current && phase === "idle") {
      entranceDoneRef.current = true;
      transitionTo("entrance_a");
      return;
    }

    // Let entrance finish
    if (phase === "entrance_a" || phase === "entrance_b") return;

    // Don't interrupt cinematic phases
    if (cinematicLockRef.current) return;

    // Commit SFX
    if (liveChainState.commitCountChanged && liveChainState.commitCount > prevCommitCountRef.current) {
      sfx.commitLockIn();
    }
    prevCommitCountRef.current = liveChainState.commitCount;

    // Map chain state to desired phase
    const { phase: desiredPhase } = chainStateToAuctionPhase(liveChainState);

    if (desiredPhase !== phase) {
      if (CINEMATIC_PHASES.has(desiredPhase)) {
        cinematicLockRef.current = true;
        const duration = CINEMATIC_DURATIONS[desiredPhase] || REPLAY_DURATIONS[desiredPhase];

        if (timerRef.current) clearTimeout(timerRef.current);
        transitionTo(desiredPhase);

        timerRef.current = setTimeout(() => {
          cinematicLockRef.current = false;
          // Chain cinematic sequences: countdown → reveal_a → reveal_b → result
          if (desiredPhase === "countdown") {
            // After countdown, check if reveals have happened
            if (liveChainState.revealCount >= 1) {
              cinematicLockRef.current = true;
              transitionTo("reveal_a");
              timerRef.current = setTimeout(() => {
                cinematicLockRef.current = false;
              }, CINEMATIC_DURATIONS["reveal_a"] || REPLAY_DURATIONS["reveal_a"]);
            }
          } else if (desiredPhase === "reveal_a" && liveChainState.revealCount >= 2) {
            cinematicLockRef.current = true;
            transitionTo("reveal_b");
            timerRef.current = setTimeout(() => {
              cinematicLockRef.current = false;
            }, CINEMATIC_DURATIONS["reveal_b"] || REPLAY_DURATIONS["reveal_b"]);
          } else if (desiredPhase === "reveal_b") {
            cinematicLockRef.current = true;
            transitionTo("result");
            timerRef.current = setTimeout(() => {
              cinematicLockRef.current = false;
            }, CINEMATIC_DURATIONS["result"] || REPLAY_DURATIONS["result"]);
          }
        }, duration);
      } else {
        transitionTo(desiredPhase);
      }
    }
  }, [isLiveMode, liveChainState, phase, transitionTo]);

  // ─── LIVE MODE: Entrance sequence timer ───────────────────────

  useEffect(() => {
    if (!isLiveMode) return;
    if (phase !== "entrance_a" && phase !== "entrance_b") return;

    const duration = CINEMATIC_DURATIONS[phase] || REPLAY_DURATIONS[phase];

    timerRef.current = setTimeout(() => {
      if (phase === "entrance_a") {
        transitionTo("entrance_b");
      } else {
        if (liveChainState) {
          const { phase: chainPhase } = chainStateToAuctionPhase(liveChainState);
          transitionTo(chainPhase);
        } else {
          transitionTo("sealed");
        }
      }
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLiveMode, phase, liveChainState, transitionTo]);

  // ─── Reset when match changes ─────────────────────────────────

  useEffect(() => {
    if (matches.length === 0) {
      setPhase("idle");
      entranceDoneRef.current = false;
      cinematicLockRef.current = false;
      prevCommitCountRef.current = 0;
      setRoundIndex(0);
    }
  }, [matches.length]);

  // ─── Start first match when data arrives (replay mode) ─────────

  useEffect(() => {
    if (isLiveMode) return;
    if (matches.length > 0 && phase === "idle") {
      transitionTo("entrance_a");
    }
  }, [matches.length, phase, transitionTo, isLiveMode]);

  // ─── phaseElapsed animation loop ─────────────────────────────

  useEffect(() => {
    const isIndefiniteWait = isLiveMode && !CINEMATIC_PHASES.has(phase) &&
      phase !== "entrance_a" && phase !== "entrance_b";

    if (isIndefiniteWait) {
      const start = Date.now();
      const tick = () => {
        const elapsed = ((Date.now() - start) % 3000) / 3000;
        setPhaseElapsed(elapsed);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animFrameRef.current);
    }

    const durations = isLiveMode ? { ...REPLAY_DURATIONS, ...CINEMATIC_DURATIONS } : REPLAY_DURATIONS;
    const duration = durations[phase] ?? REPLAY_DURATIONS[phase];
    if (duration === Infinity) {
      setPhaseElapsed(0);
      return;
    }

    const start = phaseStartTime;
    const tick = () => {
      const now = Date.now();
      const elapsed = Math.min((now - start) / duration, 1);
      setPhaseElapsed(elapsed);
      if (elapsed < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [phase, phaseStartTime, isLiveMode]);

  // ─── Compute live mode derived values ─────────────────────────

  const liveWaitingFor = isLiveMode && liveChainState
    ? chainStateToAuctionPhase(liveChainState).waitingFor
    : null;

  const chainPhaseLabel = isLiveMode && liveChainState
    ? buildAuctionChainLabel(liveChainState)
    : null;

  const durations = isLiveMode ? { ...REPLAY_DURATIONS, ...CINEMATIC_DURATIONS } : REPLAY_DURATIONS;

  return {
    phase,
    phaseElapsed,
    phaseStartTime,
    phaseDuration: durations[phase] ?? REPLAY_DURATIONS[phase],
    roundIndex,
    matchIndex,
    match,
    currentRound,
    roundWinner,
    matchWinner,
    bidA,
    bidB,
    countdownNumber,
    // Live mode fields
    isLiveMode,
    waitingFor: liveWaitingFor,
    chainPhaseLabel,
  };
}
