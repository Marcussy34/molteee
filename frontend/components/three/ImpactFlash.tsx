import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── Move-specific flash colors ─── */
const MOVE_FLASH_COLORS: Record<string, string> = {
  rock: "#FF9500",     // amber
  paper: "#00F0FF",    // cyan
  scissors: "#FF3131", // crimson
};

interface ImpactFlashProps {
  /** 0..1 normalized phase progress */
  phaseElapsed: number;
  /** Position of the flash */
  position?: [number, number, number];
  /** Winning move — determines flash color */
  winnerMove?: string;
}

export function ImpactFlash({
  phaseElapsed,
  position = [0, 0.8, 0],
  winnerMove,
}: ImpactFlashProps) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const flashRef = useRef<THREE.Mesh>(null!);

  const flashColor = useMemo(() => {
    if (winnerMove && MOVE_FLASH_COLORS[winnerMove.toLowerCase()]) {
      return MOVE_FLASH_COLORS[winnerMove.toLowerCase()];
    }
    return "#FFFFFF"; // draw: white starburst
  }, [winnerMove]);

  const isRock = winnerMove?.toLowerCase() === "rock";
  const isScissors = winnerMove?.toLowerCase() === "scissors";

  useFrame(() => {
    // Expanding ring — punchy timing: 0.15s peak → 0.4s fade
    if (ringRef.current) {
      const scale = phaseElapsed * 4;
      ringRef.current.scale.set(scale, scale, scale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - phaseElapsed * 1.5);
    }

    // Center flash sphere
    if (flashRef.current) {
      const flashScale = 0.5 + phaseElapsed * 2;
      flashRef.current.scale.set(flashScale, flashScale, flashScale);
      const mat = flashRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - phaseElapsed * 2);
    }
  });

  return (
    <group position={position}>
      {/* Primary expanding ring — move-colored */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial
          color={flashColor}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center flash glow — move-colored */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          color={flashColor}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary ring (delayed) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[
        Math.max(0, phaseElapsed - 0.15) * 5,
        Math.max(0, phaseElapsed - 0.15) * 5,
        1,
      ]}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial
          color="#836EF9"
          transparent
          opacity={Math.max(0, 0.8 - phaseElapsed * 2)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ═══ SCISSORS WIN: Crimson X slash-lines ═══ */}
      {isScissors && (
        <>
          <mesh rotation={[0, 0, Math.PI / 4]} scale={[0.02, 3 * Math.min(phaseElapsed * 4, 1), 0.02]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#FF3131"
              transparent
              opacity={Math.max(0, 0.9 - phaseElapsed * 2)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]} scale={[0.02, 3 * Math.min(phaseElapsed * 4, 1), 0.02]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#FF3131"
              transparent
              opacity={Math.max(0, 0.9 - phaseElapsed * 2)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* ═══ ROCK WIN: Ground-crack particle burst ═══ */}
      {isRock && <GroundCrack phaseElapsed={phaseElapsed} />}
    </group>
  );
}

/* ─── Ground-shatter particles for Rock wins ─── */
function GroundCrack({ phaseElapsed }: { phaseElapsed: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const COUNT = 10;

  const shards = useMemo(() => {
    return Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
      vy: 0.5 + Math.random() * 1.5,
      rx: Math.random() * 8,
      rz: Math.random() * 8,
      scale: 0.05 + Math.random() * 0.08,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const seconds = phaseElapsed * 1.0;

    for (let i = 0; i < COUNT; i++) {
      const d = shards[i];
      dummy.position.set(
        d.x * seconds * 2,
        -0.8 + d.vy * seconds - 4.9 * seconds * seconds,
        d.z * seconds * 2,
      );
      dummy.rotation.set(d.rx * seconds, 0, d.rz * seconds);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.max(0, 1 - phaseElapsed * 1.5);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 0.4, 1]} />
      <meshStandardMaterial
        color="#FF9500"
        emissive="#FF9500"
        emissiveIntensity={0.4}
        transparent
        opacity={1}
      />
    </instancedMesh>
  );
}
