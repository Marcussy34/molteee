import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SpeedLinesProps {
  /** Center point the lines radiate from */
  origin: [number, number, number];
  /** 0..1 normalized phase progress — lines fade out as this approaches 1 */
  phaseElapsed: number;
  /** Color of the speed lines */
  color?: string;
  /** Number of lines */
  count?: number;
}

export function SpeedLines({
  origin,
  phaseElapsed,
  color = "#836EF9",
  count = 40,
}: SpeedLinesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute random angles and lengths for each line
  const lineData = useMemo(() => {
    return Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      length: 0.8 + Math.random() * 1.5,
      radius: 1.5 + Math.random() * 3,
      speed: 0.5 + Math.random() * 1.5,
      yOffset: (Math.random() - 0.5) * 2,
    }));
  }, [count]);

  useFrame(() => {
    if (!meshRef.current) return;

    const opacity = Math.max(0, 1 - phaseElapsed * 1.3);

    for (let i = 0; i < count; i++) {
      const d = lineData[i];
      const r = d.radius + phaseElapsed * d.speed * 2;

      dummy.position.set(
        origin[0] + Math.cos(d.angle) * r,
        origin[1] + d.yOffset + 0.5,
        origin[2] + Math.sin(d.angle) * r
      );

      // Point away from origin
      dummy.rotation.set(0, d.angle + Math.PI / 2, 0);

      // Stretch as they fly outward
      const stretch = d.length * (0.5 + phaseElapsed * 1.5);
      dummy.scale.set(stretch, 0.02, 0.02);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update material opacity
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
