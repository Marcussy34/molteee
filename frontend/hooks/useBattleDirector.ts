import { useState, useEffect, useRef, useCallback } from "react";
import { sfx } from "@/lib/sound";
import type { Match, MatchRound } from "@/lib/types";

// ─── Phase Types ───────────────────────────────────────────────

export type BattlePhase =
  | "idle"
  | "entrance_a"
  | "entrance_b"
  | "standoff"
  | "thinking"
  | "clash"
  | "round_result"
  | "victory"
  | "reset";

export interface BattleState {
  phase: BattlePhase;
  phaseElapsed: number;       // 0..1 normalized progress within current phase
  phaseStartTime: number;     // Date.now() when phase started
  phaseDuration: number;      // ms duration of current phase
  roundIndex: number;
  matchIndex: number;
  match: Match | null;
  currentRound: MatchRound | null;
  roundWinner: "A" | "B" | "draw" | null;
  matchWinner: "A" | "B" | null;
  // Convenience: the move strings for current round
  moveA?: string;
  moveB?: string;
}

// ─── Phase Durations (ms) ──────────────────────────────────────

const PHASE_DURATIONS: Record<BattlePhase, number> = {
  idle: Infinity,
  entrance_a: 2800,     // dramatic walk-in
  entrance_b: 2800,
  standoff: 4000,       // tension build — sizing up opponent
  thinking: 5000,       // simulates commit tx → confirm → reveal tx (~5s like real chain)
  clash: 1800,          // let the impact breathe
  round_result: 3200,   // show outcome, let player read the result
  victory: 5000,        // savor the win / process the loss
  reset: 2500,          // pause between matches
};

// ─── Phase Transition Map ──────────────────────────────────────

function getNextPhase(
  current: BattlePhase,
  roundIndex: number,
  totalRounds: number
): BattlePhase {
  switch (current) {
    case "idle":
      return "entrance_a";
    case "entrance_a":
      return "entrance_b";
    case "entrance_b":
      return "standoff";
    case "standoff":
      return "thinking";
    case "thinking":
      return "clash";
    case "clash":
      return "round_result";
    case "round_result":
      // If more rounds remain, go to next thinking phase
      if (roundIndex < totalRounds - 1) return "thinking";
      // Otherwise, match is over
      return "victory";
    case "victory":
      return "reset";
    case "reset":
      return "entrance_a"; // next match starts
    default:
      return "idle";
  }
}

// ─── SFX Triggers ──────────────────────────────────────────────

function playSfxForPhase(phase: BattlePhase) {
  switch (phase) {
    case "entrance_a":
    case "entrance_b":
      sfx.entrance();
      break;
    case "standoff":
      sfx.tension();
      break;
    case "thinking":
      sfx.roundStart();
      break;
    case "clash":
      sfx.clash();
      break;
    case "victory":
      sfx.victoryFanfare();
      break;
    case "reset":
      break;
  }
}

// ─── Hook ──────────────────────────────────────────────────────

export function useBattleDirector(matches: Match[]): BattleState {
  const [phase, setPhase] = useState<BattlePhase>("idle");
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

  // Extract move strings from current round
  const moveA = currentRound?.moveA || currentRound?.actionA || currentRound?.bidA;
  const moveB = currentRound?.moveB || currentRound?.actionB || currentRound?.bidB;

  // ─── Transition to next phase ────────────────────────────────

  const transitionTo = useCallback(
    (nextPhase: BattlePhase) => {
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

      // Advance round index when transitioning from round_result to thinking
      if (phase === "round_result" && next === "thinking") {
        setRoundIndex((prev) => prev + 1);
      }

      // Advance match index on reset → entrance_a
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
    moveA,
    moveB,
  };
}
