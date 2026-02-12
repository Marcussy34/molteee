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
  const primaryRef = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const secondaryRef = useRef<THREE.Mesh>(null!);

  const flashColor = useMemo(() => {
    if (winnerMove && MOVE_FLASH_COLORS[winnerMove.toLowerCase()]) {
      return MOVE_FLASH_COLORS[winnerMove.toLowerCase()];
    }
    return "#FFFFFF";
  }, [winnerMove]);

  const isRock = winnerMove?.toLowerCase() === "rock";
  const isScissors = winnerMove?.toLowerCase() === "scissors";

  useFrame(() => {
    // Primary expanding shockwave sphere
    if (primaryRef.current) {
      const scale = 0.2 + phaseElapsed * 3.5;
      primaryRef.current.scale.set(scale, scale, scale);
      const mat = primaryRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.6 - phaseElapsed * 0.9);
    }

    // Bright core flash
    if (coreRef.current) {
      const flashScale = 0.3 + phaseElapsed * 1.5;
      coreRef.current.scale.set(flashScale, flashScale, flashScale);
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 - phaseElapsed * 2);
    }

    // Secondary delayed glow
    if (secondaryRef.current) {
      const delay = Math.max(0, phaseElapsed - 0.1);
      const scale = 0.1 + delay * 4;
      secondaryRef.current.scale.set(scale, scale, scale);
      const mat = secondaryRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.4 - delay * 0.8);
    }
  });

  return (
    <group position={position}>
      {/* Primary expanding shockwave — soft sphere glow */}
      <mesh ref={primaryRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={flashColor}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Bright core flash — white-hot center */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary delayed glow — move-colored */}
      <mesh ref={secondaryRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#836EF9"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ═══ SCISSORS WIN: Soft crimson slash trails ═══ */}
      {isScissors && (
        <>
          <mesh rotation={[0, 0, Math.PI / 4]} scale={[0.04, 3 * Math.min(phaseElapsed * 4, 1), 0.04]}>
            <cylinderGeometry args={[1, 0.3, 1, 12]} />
            <meshBasicMaterial
              color="#FF3131"
              transparent
              opacity={Math.max(0, 0.8 - phaseElapsed * 2)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]} scale={[0.04, 3 * Math.min(phaseElapsed * 4, 1), 0.04]}>
            <cylinderGeometry args={[1, 0.3, 1, 12]} />
            <meshBasicMaterial
              color="#FF3131"
              transparent
              opacity={Math.max(0, 0.8 - phaseElapsed * 2)}
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
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#FF9500"
        emissive="#FF9500"
        emissiveIntensity={0.4}
        transparent
        opacity={1}
        roughness={0.5}
        metalness={0.2}
      />
    </instancedMesh>
  );
}
