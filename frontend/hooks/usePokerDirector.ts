import { useState, useEffect, useRef, useCallback } from "react";
import { sfx } from "@/lib/sound";
import type { Match, MatchRound } from "@/lib/types";
import type { LiveGameState } from "@/hooks/useLiveGameState";

// ─── Phase Types ───────────────────────────────────────────────

export type PokerPhase =
  | "idle"
  | "entrance_a"
  | "entrance_b"
  | "deal"
  | "betting"
  | "showdown"
  | "round_result"
  | "victory"
  | "reset";

export interface PokerState {
  phase: PokerPhase;
  phaseElapsed: number;
  phaseStartTime: number;
  phaseDuration: number;
  roundIndex: number;
  matchIndex: number;
  match: Match | null;
  currentRound: MatchRound | null;
  roundWinner: "A" | "B" | "draw" | null;
  matchWinner: "A" | "B" | null;
  actionA?: string;
  actionB?: string;
  handValueA?: number;
  handValueB?: number;
  hasFold: boolean;
  bettingStep: number; // 0=A only, 1=both, 2=hold
  // ─── Live mode fields ──────────────────────────────────────────
  isLiveMode: boolean;
  waitingFor: string | null;
  chainPhaseLabel: string | null;
}

// ─── Phase Durations (ms) ──────────────────────────────────────

const REPLAY_DURATIONS: Record<PokerPhase, number> = {
  idle: Infinity,
  entrance_a: 2000,
  entrance_b: 2000,
  deal: 3000,
  betting: 5500,
  showdown: 4000,
  round_result: 3000,
  victory: 4500,
  reset: 2000,
};

// Cinematic durations for live mode — fixed-time animations
const CINEMATIC_DURATIONS: Partial<Record<PokerPhase, number>> = {
  entrance_a: 2000,
  entrance_b: 2000,
  showdown: 4000,
  round_result: 3000,
  victory: 4500,
};

// Phases that lock out chain state changes while animating
const CINEMATIC_PHASES = new Set<PokerPhase>(["showdown", "round_result", "victory"]);

// ─── Phase Transition Map (replay mode) ─────────────────────────

function getNextPhaseReplay(
  current: PokerPhase,
  roundIndex: number,
  totalRounds: number,
  hasFold: boolean
): PokerPhase {
  switch (current) {
    case "idle":
      return "entrance_a";
    case "entrance_a":
      return "entrance_b";
    case "entrance_b":
      return "deal";
    case "deal":
      return "betting";
    case "betting":
      // Skip showdown if someone folded — go straight to result
      return hasFold ? "round_result" : "showdown";
    case "showdown":
      return "round_result";
    case "round_result":
      if (roundIndex < totalRounds - 1) return "deal";
      return "victory";
    case "victory":
      return "reset";
    case "reset":
      return "entrance_a";
    default:
      return "idle";
  }
}

// ─── Live mode: map chain state → poker phase ────────────────────

function chainStateToPokerPhase(
  chainState: LiveGameState,
): { phase: PokerPhase; waitingFor: string | null } {
  if (chainState.settled) {
    return { phase: "victory", waitingFor: null };
  }

  // PokerGameV2 phases: 0=Commit, 1=Betting1, 2=Betting2, 3=Showdown, 4=Complete
  const { phaseRaw, commitCount } = chainState;

  switch (phaseRaw) {
    case 0: // Commit
      if (commitCount < 2) {
        return { phase: "deal", waitingFor: `COMMITTING HANDS... ${commitCount}/2` };
      }
      return { phase: "deal", waitingFor: "HANDS COMMITTED" };
    case 1: // Betting Round 1
      return { phase: "betting", waitingFor: "BETTING ROUND 1" };
    case 2: // Betting Round 2
      return { phase: "betting", waitingFor: "BETTING ROUND 2" };
    case 3: // Showdown
      return { phase: "showdown", waitingFor: null };
    case 4: // Complete
      return { phase: "victory", waitingFor: null };
    default:
      return { phase: "deal", waitingFor: null };
  }
}

// ─── Build chain phase label for UI ─────────────────────────────

function buildPokerChainLabel(chainState: LiveGameState): string {
  if (chainState.settled) return "MATCH COMPLETE";

  const { phaseRaw, commitCount, currentRound, totalRounds } = chainState;
  const roundLabel = currentRound !== undefined && totalRounds !== undefined
    ? `ROUND ${(currentRound || 0) + 1}`
    : "";

  // Poker: 0=Commit, 1=Bet1, 2=Bet2, 3=Showdown, 4=Complete
  switch (phaseRaw) {
    case 0:
      if (commitCount < 2) return `${roundLabel} — COMMITTING HANDS ${commitCount}/2`;
      return `${roundLabel} — HANDS LOCKED`;
    case 1: return `${roundLabel} — BETTING ROUND 1`;
    case 2: return `${roundLabel} — BETTING ROUND 2`;
    case 3: return `${roundLabel} — SHOWDOWN`;
    case 4: return "SETTLED";
    default: return chainState.phase;
  }
}

// ─── SFX Triggers ──────────────────────────────────────────────

function playSfxForPhase(phase: PokerPhase) {
  switch (phase) {
    case "entrance_a":
    case "entrance_b":
      sfx.entrance();
      break;
    case "deal":
      sfx.coin();
      break;
    case "betting":
      sfx.click();
      break;
    case "showdown":
      sfx.clash();
      break;
    case "victory":
      sfx.victoryFanfare();
      break;
  }
}

// ─── Hook ──────────────────────────────────────────────────────

export function usePokerDirector(
  matches: Match[],
  liveChainState?: LiveGameState | null,
): PokerState {
  const [phase, setPhase] = useState<PokerPhase>("idle");
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
  const prevRevealCountRef = useRef(0);
  const liveModeActiveRef = useRef(false);

  // Latch: once live mode activates, stays active until match resets
  // This prevents settlement from dropping live mode mid-cinematic
  if (liveChainState && !liveChainState.settled) {
    liveModeActiveRef.current = true;
  }
  const isLiveMode = liveModeActiveRef.current && !!liveChainState;

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

  const actionA = currentRound?.actionA;
  const actionB = currentRound?.actionB;
  const handValueA = currentRound?.handValueA;
  const handValueB = currentRound?.handValueB;
  const hasFold =
    actionA?.toLowerCase() === "fold" || actionB?.toLowerCase() === "fold";

  // Compute betting step from phaseElapsed
  const bettingStep = phase === "betting"
    ? phaseElapsed < 0.45 ? 0 : phaseElapsed < 0.9 ? 1 : 2
    : 0;

  // ─── Transition to next phase ────────────────────────────────

  const transitionTo = useCallback(
    (nextPhase: PokerPhase) => {
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
      const next = getNextPhaseReplay(phase, roundIndex, totalRounds, hasFold);

      if (phase === "round_result" && next === "deal") {
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
  }, [phase, roundIndex, totalRounds, match, hasFold, transitionTo, isLiveMode]);

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

    // Reveal SFX — plays when reveal count increases during showdown
    if (liveChainState.revealCountChanged && liveChainState.revealCount > prevRevealCountRef.current) {
      sfx.revealChirp();
    }
    prevRevealCountRef.current = liveChainState.revealCount;

    // Map chain state to desired phase
    const { phase: desiredPhase } = chainStateToPokerPhase(liveChainState);

    // Track round transitions
    if (liveChainState.currentRound !== undefined && liveChainState.currentRound > roundIndex) {
      setRoundIndex(liveChainState.currentRound);
    }

    if (desiredPhase !== phase) {
      if (CINEMATIC_PHASES.has(desiredPhase)) {
        cinematicLockRef.current = true;
        const duration = CINEMATIC_DURATIONS[desiredPhase] || REPLAY_DURATIONS[desiredPhase];

        if (timerRef.current) clearTimeout(timerRef.current);
        transitionTo(desiredPhase);

        timerRef.current = setTimeout(() => {
          cinematicLockRef.current = false;
          // After showdown → round_result
          if (desiredPhase === "showdown") {
            cinematicLockRef.current = true;
            transitionTo("round_result");
            timerRef.current = setTimeout(() => {
              cinematicLockRef.current = false;
            }, CINEMATIC_DURATIONS["round_result"] || REPLAY_DURATIONS["round_result"]);
          }
        }, duration);
      } else {
        transitionTo(desiredPhase);
      }
    }
  }, [isLiveMode, liveChainState, phase, roundIndex, transitionTo]);

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
          const { phase: chainPhase } = chainStateToPokerPhase(liveChainState);
          transitionTo(chainPhase);
        } else {
          transitionTo("deal");
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
      prevRevealCountRef.current = 0;
      liveModeActiveRef.current = false;
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
    ? chainStateToPokerPhase(liveChainState).waitingFor
    : null;

  const chainPhaseLabel = isLiveMode && liveChainState
    ? buildPokerChainLabel(liveChainState)
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
    actionA,
    actionB,
    handValueA,
    handValueB,
    hasFold,
    bettingStep,
    // Live mode fields
    isLiveMode,
    waitingFor: liveWaitingFor,
    chainPhaseLabel,
  };
}
