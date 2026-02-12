import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BattlePhase } from "@/hooks/useBattleDirector";

interface ParticlesProps {
  count?: number;
  battlePhase?: BattlePhase;
}

export function Particles({ count = 350, battlePhase }: ParticlesProps) {
  const meshRef = useRef<THREE.Points>(null!);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      spd[i] = 0.02 + Math.random() * 0.06;
    }
    return { positions: pos, speeds: spd };
  }, [count]);

  useFrame(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Speed multiplier based on battle phase
    const speedMult = battlePhase === "clash" ? 3.0 : battlePhase === "victory" ? 0.5 : 1.0;

    for (let i = 0; i < count; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      const z = arr[i * 3 + 2];

      if (battlePhase === "clash") {
        // Burst outward from center
        const dx = x || 0.01;
        const dz = z || 0.01;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        arr[i * 3] += (dx / dist) * speeds[i] * speedMult;
        arr[i * 3 + 1] += speeds[i] * speedMult;
        arr[i * 3 + 2] += (dz / dist) * speeds[i] * speedMult;
      } else if (battlePhase === "victory") {
        // Gentle drift upward
        arr[i * 3 + 1] += speeds[i] * speedMult;
      } else {
        // Normal upward drift
        arr[i * 3 + 1] += speeds[i];
      }

      // Reset particle when it drifts too high or too far
      if (arr[i * 3 + 1] > 20 || Math.abs(arr[i * 3]) > 25) {
        arr[i * 3] = (Math.random() - 0.5) * 40;
        arr[i * 3 + 1] = -1;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#836EF9"
        size={battlePhase === "clash" ? 0.1 : 0.06}
        transparent
        opacity={battlePhase === "clash" ? 0.8 : 0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
