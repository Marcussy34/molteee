import { useState, useEffect, useRef, useCallback } from "react";
import { sfx } from "@/lib/sound";
import type { Match, MatchRound } from "@/lib/types";

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
}

// ─── Phase Durations (ms) ──────────────────────────────────────

const PHASE_DURATIONS: Record<PokerPhase, number> = {
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

// ─── Phase Transition Map ──────────────────────────────────────

function getNextPhase(
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

export function usePokerDirector(matches: Match[]): PokerState {
  const [phase, setPhase] = useState<PokerPhase>("idle");
  const [phaseStartTime, setPhaseStartTime] = useState(Date.now());
  const [roundIndex, setRoundIndex] = useState(0);
  const [matchIndex, setMatchIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);

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

  // ─── Phase timer: auto-advance when duration expires ─────────

  useEffect(() => {
    if (phase === "idle") return;
    if (!match) return;

    const duration = PHASE_DURATIONS[phase];
    if (duration === Infinity) return;

    timerRef.current = setTimeout(() => {
      const next = getNextPhase(phase, roundIndex, totalRounds, hasFold);

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
  }, [phase, roundIndex, totalRounds, match, hasFold, transitionTo]);

  // ─── Start first match when data arrives ─────────────────────

  useEffect(() => {
    if (matches.length > 0 && phase === "idle") {
      transitionTo("entrance_a");
    }
  }, [matches.length, phase, transitionTo]);

  // ─── phaseElapsed animation loop ─────────────────────────────

  useEffect(() => {
    const duration = PHASE_DURATIONS[phase];
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

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, phaseStartTime]);

  return {
    phase,
    phaseElapsed,
    phaseStartTime,
    phaseDuration: PHASE_DURATIONS[phase],
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
  };
}
