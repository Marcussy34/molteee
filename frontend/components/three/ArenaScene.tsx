import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GridFloor } from "./GridFloor";
import { Particles } from "./Particles";
import { CRTEffect } from "./CRTEffect";
import { CameraDirector } from "./CameraDirector";
import { SpeedLines } from "./SpeedLines";
import { ImpactFlash } from "./ImpactFlash";
import { EnergyBeam } from "./EnergyBeam";
import { MechFighter } from "./MechFighter";
import { MoveWeapon } from "./MoveWeapon";
import { ClashResolver } from "./ClashResolver";
import type { BattleState } from "@/hooks/useBattleDirector";

/** Pulsing ring on the arena floor */
function ArenaRing() {
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!ringRef.current) return;
    const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
    ringRef.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <ringGeometry args={[3.5, 3.8, 64]} />
      <meshBasicMaterial color="#836EF9" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Resolve winning move for impact flash color */
function getWinnerMove(
  moveA?: string,
  moveB?: string,
  roundWinner?: "A" | "B" | "draw" | null,
): string | undefined {
  if (!roundWinner || roundWinner === "draw") return undefined;
  return roundWinner === "A" ? moveA : moveB;
}

interface ArenaSceneProps {
  battleState: BattleState;
}

export function ArenaScene({ battleState }: ArenaSceneProps) {
  const { phase, phaseElapsed, match, matchWinner, roundWinner, moveA, moveB } = battleState;

  // Only reveal moves at clash or after — keeps suspense until the reveal moment
  const revealedMoveA = phase === "clash" || phase === "round_result" || phase === "victory" ? moveA : undefined;
  const revealedMoveB = phase === "clash" || phase === "round_result" || phase === "victory" ? moveB : undefined;

  const showWeapons = phase === "clash" || phase === "round_result";
  const winnerMove = getWinnerMove(revealedMoveA, revealedMoveB, roundWinner);

  return (
    <Canvas
      camera={{ position: [0, 4, 8], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#08061A"]} />
      <fog attach="fog" args={["#08061A", 12, 35]} />

      <ambientLight intensity={0.2} />
      <pointLight position={[0, 8, 0]} intensity={2} color="#836EF9" distance={30} />
      <pointLight position={[-5, 4, 3]} intensity={0.8} color="#00F0FF" distance={20} />
      <pointLight position={[5, 4, -3]} intensity={0.5} color="#6C4ED9" distance={20} />

      <GridFloor />
      <Particles count={150} battlePhase={phase} />
      <ArenaRing />

      {/* ═══ HIGH-FIDELITY HERO MODELS ═══ */}
      <MechFighter
        address={match?.playerA.address}
        side="left"
        battlePhase={phase}
        phaseElapsed={phaseElapsed}
        currentMove={revealedMoveA}
        isRoundWinner={roundWinner === "A"}
        isMatchWinner={matchWinner === "A"}
      />
      <MechFighter
        address={match?.playerB.address}
        side="right"
        battlePhase={phase}
        phaseElapsed={phaseElapsed}
        currentMove={revealedMoveB}
        isRoundWinner={roundWinner === "B"}
        isMatchWinner={matchWinner === "B"}
      />

      {/* ═══ FINAL SMASH MANIFESTATIONS — only at clash/round_result ═══ */}
      {showWeapons && revealedMoveA && (
        <MoveWeapon
          move={revealedMoveA}
          side="left"
          battlePhase={phase}
          phaseElapsed={phaseElapsed}
          isWinner={roundWinner === "A"}
        />
      )}
      {showWeapons && revealedMoveB && (
        <MoveWeapon
          move={revealedMoveB}
          side="right"
          battlePhase={phase}
          phaseElapsed={phaseElapsed}
          isWinner={roundWinner === "B"}
        />
      )}

      {/* ═══ CINEMATIC CLASH RESOLUTION ═══ */}
      {phase === "round_result" && (
        <ClashResolver
          moveA={revealedMoveA}
          moveB={revealedMoveB}
          roundWinner={roundWinner}
          phaseElapsed={phaseElapsed}
        />
      )}

      {/* VFX: Speed lines during entrances */}
      {phase === "entrance_a" && (
        <SpeedLines origin={[-2.5, 0, 0]} phaseElapsed={phaseElapsed} color="#00F0FF" />
      )}
      {phase === "entrance_b" && (
        <SpeedLines origin={[2.5, 0, 0]} phaseElapsed={phaseElapsed} color="#FF3131" />
      )}

      {/* VFX: Move-colored impact flash + center speed lines during clash */}
      {phase === "clash" && (
        <>
          <ImpactFlash phaseElapsed={phaseElapsed} winnerMove={winnerMove} />
          <SpeedLines origin={[0, 0.8, 0]} phaseElapsed={phaseElapsed} color="#FFD700" count={50} />
        </>
      )}

      {/* VFX: Energy beam on winner during victory */}
      {phase === "victory" && matchWinner && (
        <EnergyBeam
          side={matchWinner === "A" ? "left" : "right"}
          phaseElapsed={phaseElapsed}
        />
      )}

      <CameraDirector
        battlePhase={phase}
        phaseElapsed={phaseElapsed}
        roundWinner={battleState.roundWinner}
        matchWinner={matchWinner}
        roundIndex={battleState.roundIndex}
      />

      <CRTEffect intensity={phase === "clash" ? 1.3 : phase === "victory" ? 1.2 : 1.0} />
    </Canvas>
  );
}
