import { useState, useEffect, useRef, useCallback } from "react";
import { sfx } from "@/lib/sound";
import type { Match, MatchRound } from "@/lib/types";

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
}

// ─── Phase Durations (ms) ──────────────────────────────────────

const PHASE_DURATIONS: Record<AuctionPhase, number> = {
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

// ─── Phase Transition Map ──────────────────────────────────────

function getNextPhase(
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

export function useAuctionDirector(matches: Match[]): AuctionState {
  const [phase, setPhase] = useState<AuctionPhase>("idle");
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

  // ─── Phase timer: auto-advance when duration expires ─────────

  useEffect(() => {
    if (phase === "idle") return;
    if (!match) return;

    const duration = PHASE_DURATIONS[phase];
    if (duration === Infinity) return;

    timerRef.current = setTimeout(() => {
      const next = getNextPhase(phase, roundIndex, totalRounds);

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
  }, [phase, roundIndex, totalRounds, match, transitionTo]);

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
    bidA,
    bidB,
    countdownNumber,
  };
}
