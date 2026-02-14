import { useState, useEffect, useRef, useCallback } from "react";
import { sfx } from "@/lib/sound";
import type { Match, MatchRound } from "@/lib/types";
import type { LiveGameState, RoundHistoryEntry } from "@/hooks/useLiveGameState";

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
  // ─── Live mode fields ──────────────────────────────────────────
  isLiveMode: boolean;
  commitCount: number;        // 0, 1, or 2
  revealCount: number;        // 0, 1, or 2
  waitingFor: string | null;  // Human-readable wait description
  chainPhaseLabel: string | null; // e.g. "COMMITTING MOVES — 1/2 LOCKED IN"
  roundHistory: RoundHistoryEntry[];
}

// ─── Phase Durations (ms) — used for replay mode ────────────────

const REPLAY_DURATIONS: Record<BattlePhase, number> = {
  idle: Infinity,
  entrance_a: 2800,     // dramatic walk-in
  entrance_b: 2800,
  standoff: 4000,       // tension build — sizing up opponent
  thinking: 5000,       // simulates commit tx → confirm → reveal tx
  clash: 1800,          // let the impact breathe
  round_result: 3200,   // show outcome, let player read the result
  victory: 5000,        // savor the win / process the loss
  reset: 2500,          // pause between matches
};

// ─── Cinematic durations for live mode (fixed-time animations) ───

const CINEMATIC_DURATIONS: Partial<Record<BattlePhase, number>> = {
  entrance_a: 2800,
  entrance_b: 2800,
  thinking: 1500,       // Brief transition between commit → reveal
  clash: 1800,          // Impact animation with actual moves
  round_result: 3200,   // Show outcome
  victory: 5000,        // Winner celebration
};

// Phases that lock out chain state changes while animating
const CINEMATIC_PHASES = new Set<BattlePhase>(["clash", "round_result", "victory"]);

// ─── Phase Transition Map (replay mode — unchanged) ─────────────

function getNextPhaseReplay(
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

// ─── Live mode: map chain state → director phase ─────────────────

function chainStateToPhase(
  chainState: LiveGameState,
): { phase: BattlePhase; waitingFor: string | null } {
  // Game settled → victory
  if (chainState.settled) {
    return { phase: "victory", waitingFor: null };
  }

  const { phaseRaw, commitCount, revealCount } = chainState;

  // RPS phases: 0=Commit, 1=Reveal, 2=Complete (no Idle — contract starts at Commit)
  if (chainState.gameType === "rps") {
    switch (phaseRaw) {
      case 0: // Commit phase
        if (commitCount === 0) {
          return { phase: "standoff", waitingFor: "CHOOSING MOVES..." };
        }
        if (commitCount === 1) {
          return { phase: "standoff", waitingFor: "1/2 LOCKED IN" };
        }
        // commitCount === 2 but still in commit phase — brief transition
        return { phase: "thinking", waitingFor: "MOVES LOCKED — TRANSITIONING..." };
      case 1: // Reveal phase
        if (revealCount < 2) {
          return { phase: "thinking", waitingFor: `WAITING FOR REVEALS... ${revealCount}/2` };
        }
        // Both revealed — time for clash
        return { phase: "clash", waitingFor: null };
      case 2: // Complete
        return { phase: "victory", waitingFor: null };
      default:
        return { phase: "standoff", waitingFor: null };
    }
  }

  // Fallback for non-RPS (poker/auction handled by their own directors)
  return { phase: "standoff", waitingFor: null };
}

// ─── Build chain phase label for UI ─────────────────────────────

function buildChainPhaseLabel(chainState: LiveGameState): string {
  if (chainState.settled) return "MATCH COMPLETE";

  const { phaseRaw, commitCount, revealCount, currentRound, totalRounds } = chainState;
  const roundLabel = currentRound !== undefined && totalRounds !== undefined
    ? `ROUND ${(currentRound || 0) + 1}`
    : "";

  if (chainState.gameType === "rps") {
    // RPS: 0=Commit, 1=Reveal, 2=Complete
    switch (phaseRaw) {
      case 0:
        if (commitCount === 0) return `${roundLabel} — CHOOSING MOVES...`;
        if (commitCount === 1) return `${roundLabel} — 1/2 LOCKED IN`;
        return `${roundLabel} — BOTH LOCKED IN`;
      case 1:
        if (revealCount === 0) return `${roundLabel} — WAITING FOR REVEALS...`;
        if (revealCount === 1) return `${roundLabel} — 1/2 REVEALED`;
        return `${roundLabel} — REVEALING!`;
      case 2: return "COMPLETE";
      default: return chainState.phase;
    }
  }

  return chainState.phase;
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

export function useBattleDirector(
  matches: Match[],
  liveChainState?: LiveGameState | null,
): BattleState {
  const [phase, setPhase] = useState<BattlePhase>("idle");
  const [phaseStartTime, setPhaseStartTime] = useState(Date.now());
  const [roundIndex, setRoundIndex] = useState(0);
  const [matchIndex, setMatchIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);

  // ─── Live mode state ──────────────────────────────────────────
  // Cinematic lock prevents chain state from interrupting fixed-duration animations
  const cinematicLockRef = useRef(false);
  const entranceDoneRef = useRef(false);
  // Track chain state changes to trigger SFX
  const prevCommitCountRef = useRef(0);
  const prevRevealCountRef = useRef(0);
  // Track chain round and settlement for round-transition detection
  const prevChainRoundRef = useRef<number | null>(null);
  const prevSettledRef = useRef(false);
  // Latch: once live mode activates, stays active until match resets.
  // Prevents settlement from causing a jarring switch to replay mode mid-animation.
  const liveModeActiveRef = useRef(false);

  // Activate latch when we see an unsettled chain state
  if (liveChainState && !liveChainState.settled) {
    liveModeActiveRef.current = true;
  }
  // isLiveMode stays true even after settlement so the director can handle
  // the final clash → round_result → victory cinematic sequence
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

  // ─── REPLAY MODE: Phase timer (original fixed-timeline behavior) ────

  useEffect(() => {
    // Only run in replay mode
    if (isLiveMode) return;
    if (phase === "idle") return;
    if (!match) return;

    const duration = REPLAY_DURATIONS[phase];
    if (duration === Infinity) return;

    timerRef.current = setTimeout(() => {
      const next = getNextPhaseReplay(phase, roundIndex, totalRounds);

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
  }, [phase, roundIndex, totalRounds, match, transitionTo, isLiveMode]);

  // ─── LIVE MODE: React to chain state changes ──────────────────
  // Key insight: the RPS contract auto-advances currentRound after both reveals,
  // so the 2s poll almost never catches the transient revealCount === 2 state.
  // Instead, we detect when currentRound jumps forward between polls and force
  // the clash → round_result cinematic using roundHistory data (actual moves).

  useEffect(() => {
    if (!isLiveMode || !liveChainState) return;

    // Play entrance once when first entering live mode
    if (!entranceDoneRef.current && phase === "idle") {
      entranceDoneRef.current = true;
      transitionTo("entrance_a");
      return;
    }

    // If entrance animations are still playing, let them finish
    if (phase === "entrance_a" || phase === "entrance_b") return;

    // If in a cinematic phase, don't interrupt — the timer will handle it
    if (cinematicLockRef.current) return;

    // ─── Round transition detection ────────────────────────────────
    const chainRound = liveChainState.currentRound ?? 0;

    // Initialize tracking refs on first observation (no transition trigger)
    if (prevChainRoundRef.current === null) {
      prevChainRoundRef.current = chainRound;
      prevSettledRef.current = liveChainState.settled;
    }

    // Detect round advancement (chain moved to next round = previous round completed)
    const roundAdvanced = chainRound > prevChainRoundRef.current;
    // Detect game settlement (game just finished)
    const justSettled = liveChainState.settled && !prevSettledRef.current;

    if (roundAdvanced || justSettled) {
      // The round that just completed is the previous chain round
      const completedRound = prevChainRoundRef.current;

      // Keep roundIndex at the completed round so match.rounds[completedRound]
      // has the actual moves from roundHistory for the clash animation
      setRoundIndex(completedRound);

      // Update refs immediately to prevent re-triggering on next render
      prevChainRoundRef.current = chainRound;
      prevSettledRef.current = liveChainState.settled;

      // Start clash cinematic with actual moves from the completed round
      cinematicLockRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      transitionTo("clash");

      const clashDur = CINEMATIC_DURATIONS["clash"] || REPLAY_DURATIONS["clash"];
      const resultDur = CINEMATIC_DURATIONS["round_result"] || REPLAY_DURATIONS["round_result"];

      timerRef.current = setTimeout(() => {
        // After clash → show round result
        transitionTo("round_result");

        timerRef.current = setTimeout(() => {
          cinematicLockRef.current = false;

          if (liveChainState.settled) {
            // Game over — show victory animation
            cinematicLockRef.current = true;
            transitionTo("victory");
            timerRef.current = setTimeout(() => {
              cinematicLockRef.current = false;
            }, CINEMATIC_DURATIONS["victory"] || REPLAY_DURATIONS["victory"]);
          } else {
            // More rounds — advance roundIndex to current chain round
            setRoundIndex(chainRound);
            // Next useEffect cycle will map chain state → director phase
          }
        }, resultDur);
      }, clashDur);

      return; // Skip normal chain state mapping this cycle
    }

    // ─── Normal chain state mapping (no round transition) ──────────
    // Update tracking refs
    prevChainRoundRef.current = chainRound;
    prevSettledRef.current = liveChainState.settled;

    // Commit/reveal count change SFX
    if (liveChainState.commitCountChanged && liveChainState.commitCount > prevCommitCountRef.current) {
      sfx.commitLockIn();
    }
    if (liveChainState.revealCountChanged && liveChainState.revealCount > prevRevealCountRef.current) {
      sfx.revealChirp();
    }
    prevCommitCountRef.current = liveChainState.commitCount;
    prevRevealCountRef.current = liveChainState.revealCount;

    // Map chain state to desired phase
    const { phase: desiredPhase } = chainStateToPhase(liveChainState);

    // Only transition if phase actually changed
    if (desiredPhase !== phase) {
      // Start cinematic lock for fixed-duration animation phases
      if (CINEMATIC_PHASES.has(desiredPhase)) {
        cinematicLockRef.current = true;
        const duration = CINEMATIC_DURATIONS[desiredPhase] || REPLAY_DURATIONS[desiredPhase];

        // Clear any existing timer
        if (timerRef.current) clearTimeout(timerRef.current);

        transitionTo(desiredPhase);

        // After cinematic completes, unlock and let chain state drive next phase
        timerRef.current = setTimeout(() => {
          cinematicLockRef.current = false;

          // After clash → show round_result (also cinematic)
          if (desiredPhase === "clash") {
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
  // Entrance phases use fixed timing even in live mode

  useEffect(() => {
    if (!isLiveMode) return;
    if (phase !== "entrance_a" && phase !== "entrance_b") return;

    const duration = CINEMATIC_DURATIONS[phase] || REPLAY_DURATIONS[phase];

    timerRef.current = setTimeout(() => {
      if (phase === "entrance_a") {
        transitionTo("entrance_b");
      } else {
        // After entrance_b, jump to chain-determined phase
        if (liveChainState) {
          const { phase: chainPhase } = chainStateToPhase(liveChainState);
          transitionTo(chainPhase);
        } else {
          transitionTo("standoff");
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
      prevChainRoundRef.current = null;
      prevSettledRef.current = false;
      liveModeActiveRef.current = false;
      setRoundIndex(0);
    }
  }, [matches.length]);

  // ─── Start first match when data arrives (replay mode) ─────────

  useEffect(() => {
    if (isLiveMode) return; // Live mode handles its own entrance
    if (matches.length > 0 && phase === "idle") {
      transitionTo("entrance_a");
    }
  }, [matches.length, phase, transitionTo, isLiveMode]);

  // ─── phaseElapsed animation loop ─────────────────────────────

  useEffect(() => {
    // In live mode, indefinite-wait phases (standoff, thinking when waiting) don't progress
    const isIndefiniteWait = isLiveMode && !CINEMATIC_PHASES.has(phase) &&
      phase !== "entrance_a" && phase !== "entrance_b";

    if (isIndefiniteWait) {
      // For indefinite phases in live mode, pulse phaseElapsed as a looping 0→1→0 wave
      // so animations can pulse without completing
      const start = Date.now();
      const tick = () => {
        const elapsed = ((Date.now() - start) % 3000) / 3000; // 3s loop
        setPhaseElapsed(elapsed);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animFrameRef.current);
    }

    // Fixed-duration phases (replay mode or cinematic phases in live mode)
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

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, phaseStartTime, isLiveMode]);

  // ─── Compute live mode derived values ─────────────────────────

  const liveWaitingFor = isLiveMode && liveChainState
    ? chainStateToPhase(liveChainState).waitingFor
    : null;

  const chainPhaseLabel = isLiveMode && liveChainState
    ? buildChainPhaseLabel(liveChainState)
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
    moveA,
    moveB,
    // Live mode fields
    isLiveMode,
    commitCount: liveChainState?.commitCount ?? 0,
    revealCount: liveChainState?.revealCount ?? 0,
    waitingFor: liveWaitingFor,
    chainPhaseLabel,
    roundHistory: liveChainState?.roundHistory ?? [],
  };
}
