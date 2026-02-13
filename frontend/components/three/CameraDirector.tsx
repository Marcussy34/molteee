import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { BattlePhase } from "@/hooks/useBattleDirector";

interface CameraDirectorProps {
  battlePhase: BattlePhase;
  phaseElapsed: number;
  roundWinner?: "A" | "B" | "draw" | null;
  matchWinner?: "A" | "B" | null;
  roundIndex: number;
}

// ─── Camera target configs per phase ───────────────────────────

interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
}

const LEFT_X = -2.5;
const RIGHT_X = 2.5;
const FIGHTER_Y = 0.8;

function getCameraTarget(
  phase: BattlePhase,
  elapsed: number,
  roundWinner: "A" | "B" | "draw" | null,
  matchWinner: "A" | "B" | null,
  roundIndex: number
): CameraTarget {
  switch (phase) {
    case "entrance_a":
      // Low-angle hero shot on Fighter A
      return {
        position: new THREE.Vector3(-3.5, 0.4, 2.5),
        lookAt: new THREE.Vector3(LEFT_X, FIGHTER_Y, 0),
        fov: 40,
      };

    case "entrance_b":
      // Low-angle hero shot on Fighter B
      return {
        position: new THREE.Vector3(3.5, 0.4, 2.5),
        lookAt: new THREE.Vector3(RIGHT_X, FIGHTER_Y, 0),
        fov: 40,
      };

    case "standoff": {
      // Wide shot slowly dollying in
      const z = 12 - elapsed * 5; // 12 → 7
      const y = 3 - elapsed * 0.5; // 3 → 2.5
      return {
        position: new THREE.Vector3(0, y, z),
        lookAt: new THREE.Vector3(0, FIGHTER_Y, 0),
        fov: 50 - elapsed * 5, // 50 → 45
      };
    }

    case "thinking": {
      // Dutch-angle close-up, alternating sides per round
      const focusSide = roundIndex % 2 === 0 ? -1 : 1; // alternate which fighter
      const fighterX = focusSide === -1 ? LEFT_X : RIGHT_X;
      return {
        position: new THREE.Vector3(fighterX + focusSide * 0.7, 1.5, 1.8),
        lookAt: new THREE.Vector3(fighterX, 1.3, 0),
        fov: 35,
      };
    }

    case "clash": {
      // Gentle arc — subtle drift, no violent orbit
      const baseAngle = 0.15; // start slightly off-center
      const arc = elapsed * 0.35; // ~20° total sweep (was 180°)
      const angle = baseAngle + arc;
      const radius = 5.5; // further back for stability
      const y = 1.8 - elapsed * 0.3; // slight drop for drama
      return {
        position: new THREE.Vector3(
          Math.sin(angle) * radius,
          y,
          Math.cos(angle) * radius
        ),
        lookAt: new THREE.Vector3(0, FIGHTER_Y, 0),
        fov: 48,
      };
    }

    case "round_result": {
      // Medium shot drifting toward round winner
      const winSide = roundWinner === "A" ? -1 : roundWinner === "B" ? 1 : 0;
      return {
        position: new THREE.Vector3(winSide * 1, 2, 6),
        lookAt: new THREE.Vector3(winSide * -1, FIGHTER_Y, 0),
        fov: 48,
      };
    }

    case "victory": {
      // Low-angle crane rising on match winner
      const side = matchWinner === "A" ? -1 : 1;
      const winnerX = matchWinner === "A" ? LEFT_X : RIGHT_X;
      const y = 0.3 + elapsed * 1.7; // 0.3 → 2.0
      return {
        position: new THREE.Vector3(winnerX + side * 0.5, y, 3),
        lookAt: new THREE.Vector3(winnerX, FIGHTER_Y + 0.3, 0),
        fov: 42,
      };
    }

    case "reset":
    case "idle":
    default:
      // Default overview
      return {
        position: new THREE.Vector3(0, 4, 8),
        lookAt: new THREE.Vector3(0, FIGHTER_Y, 0),
        fov: 50,
      };
  }
}

// ─── Component ─────────────────────────────────────────────────

export function CameraDirector({
  battlePhase,
  phaseElapsed,
  roundWinner,
  matchWinner,
  roundIndex,
}: CameraDirectorProps) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 4, 8));
  const currentLookAt = useRef(new THREE.Vector3(0, FIGHTER_Y, 0));
  const currentFov = useRef(50);
  const shakeOffset = useRef(new THREE.Vector3());

  useFrame((_state, delta) => {
    const target = getCameraTarget(
      battlePhase,
      phaseElapsed,
      roundWinner ?? null,
      matchWinner ?? null,
      roundIndex
    );

    // Smooth interpolation — gentle damping for comfortable viewing
    const dampFactor = battlePhase === "clash" ? 4 : 6;
    const t = 1 - Math.exp(-dampFactor * delta);

    currentPos.current.lerp(target.position, t);
    currentLookAt.current.lerp(target.lookAt, t);
    currentFov.current = THREE.MathUtils.lerp(currentFov.current, target.fov, t);

    // Minimal screen shake during clash — just a subtle rumble
    if (battlePhase === "clash") {
      const intensity = 0.015 * (1 - phaseElapsed); // very subtle, decays fast
      shakeOffset.current.set(
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity * 0.3,
        0
      );
    } else {
      shakeOffset.current.multiplyScalar(0.9);
    }

    // Apply to camera
    camera.position.copy(currentPos.current).add(shakeOffset.current);
    camera.lookAt(currentLookAt.current);

    // Apply FOV
    if ("fov" in camera) {
      (camera as THREE.PerspectiveCamera).fov = currentFov.current;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }

    // Dutch angle during thinking phase
    if (battlePhase === "thinking") {
      const tiltAngle = 0.15; // ~8.5 degrees
      camera.up.set(Math.sin(tiltAngle), Math.cos(tiltAngle), 0);
    } else {
      // Smoothly return to upright
      camera.up.lerp(new THREE.Vector3(0, 1, 0), t);
    }
  });

  return null;
}
