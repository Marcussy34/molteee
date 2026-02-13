import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BattlePhase } from "@/hooks/useBattleDirector";

interface MoveWeaponProps {
  move: string;
  side: "left" | "right";
  battlePhase: BattlePhase;
  phaseElapsed: number;
  isWinner?: boolean;
}

export function MoveWeapon({
  move,
  side,
  battlePhase,
  phaseElapsed,
  isWinner,
}: MoveWeaponProps) {
  const normalized = move?.toLowerCase();
  if (!normalized || !["rock", "paper", "scissors"].includes(normalized)) return null;

  const armX = side === "left" ? -3.05 : 3.05;
  const armY = 0.45;

  // Lifecycle scale: charge up during thinking, hold during clash
  let scale = 0;
  if (battlePhase === "thinking") {
    scale = Math.min(phaseElapsed * 1.6, 1); // grow over ~60% of thinking phase
  } else if (battlePhase === "clash" || battlePhase === "round_result") {
    scale = 1;
  }

  if (scale <= 0.01) return null;

  return (
    <group position={[armX, armY, 0]} scale={[scale, scale, scale]}>
      {normalized === "rock" && (
        <RockManifest phaseElapsed={phaseElapsed} battlePhase={battlePhase} />
      )}
      {normalized === "paper" && (
        <PaperManifest phaseElapsed={phaseElapsed} battlePhase={battlePhase} />
      )}
      {normalized === "scissors" && (
        <ScissorsManifest phaseElapsed={phaseElapsed} battlePhase={battlePhase} />
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════════════
   ROCK — Obsidian gauntlet with magma cracks + debris ring
   ═══════════════════════════════════════════════════ */
function RockManifest({
  phaseElapsed,
  battlePhase,
}: {
  phaseElapsed: number;
  battlePhase: BattlePhase;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const debrisRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const DEBRIS_COUNT = 8;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Slow heavy rotation
    groupRef.current.rotation.y = t * 0.8;
    groupRef.current.rotation.x = Math.sin(t * 0.5) * 0.15;

    // Core emissive pulse (magma cracks)
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.3;
    }

    // Orbiting debris ring
    if (debrisRef.current) {
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const angle = (i / DEBRIS_COUNT) * Math.PI * 2 + t * 1.2;
        const r = 0.55;
        dummy.position.set(Math.cos(angle) * r, Math.sin(t * 2 + i) * 0.08, Math.sin(angle) * r);
        dummy.rotation.set(t * 2 + i, t + i * 0.5, 0);
        dummy.scale.setScalar(0.06 + Math.sin(i * 1.7) * 0.02);
        dummy.updateMatrix();
        debrisRef.current.setMatrixAt(i, dummy.matrix);
      }
      debrisRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main obsidian icosahedron — solid rock */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial
          color="#2A1A0A"
          emissive="#FF9500"
          emissiveIntensity={0.6}
          roughness={0.9}
          metalness={0.3}
        />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial
          color="#FF9500"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Orbiting debris */}
      <instancedMesh ref={debrisRef} args={[undefined, undefined, DEBRIS_COUNT]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#4A3520"
          emissive="#FF9500"
          emissiveIntensity={0.3}
          roughness={0.8}
          metalness={0.3}
        />
      </instancedMesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════
   PAPER — Razor shields orbiting with ribbon trails
   ═══════════════════════════════════════════════════ */
function PaperManifest({
  phaseElapsed,
  battlePhase,
}: {
  phaseElapsed: number;
  battlePhase: BattlePhase;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const shieldsRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Fast orbital rotation
    if (shieldsRef.current) {
      shieldsRef.current.rotation.y = t * 3.5;
      shieldsRef.current.rotation.x = Math.sin(t * 1.5) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={shieldsRef}>
        {[0, 1, 2].map((i) => {
          const angle = (i / 3) * Math.PI * 2;
          const r = 0.4;
          return (
            <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
              {/* Razor shield plane — solid glowing panel */}
              <mesh rotation={[0, angle + Math.PI / 2, Math.PI / 6]}>
                <planeGeometry args={[0.35, 0.18]} />
                <meshStandardMaterial
                  color="#00F0FF"
                  emissive="#00F0FF"
                  emissiveIntensity={0.7}
                  transparent
                  opacity={0.85}
                  side={THREE.DoubleSide}
                  metalness={0.2}
                  roughness={0.1}
                />
              </mesh>
              {/* Ribbon trail */}
              <mesh rotation={[0, angle, 0]}>
                <boxGeometry args={[0.25, 0.01, 0.01]} />
                <meshBasicMaterial
                  color="#00F0FF"
                  transparent
                  opacity={0.4}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Central wind distortion glow */}
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial
          color="#00F0FF"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════
   SCISSORS — Laser blades in X-formation with heat shimmer
   ═══════════════════════════════════════════════════ */
function ScissorsManifest({
  phaseElapsed,
  battlePhase,
}: {
  phaseElapsed: number;
  battlePhase: BattlePhase;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const blade1Ref = useRef<THREE.Mesh>(null!);
  const blade2Ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Scissor-snip idle animation
    const snipAngle = Math.sin(t * 4) * 0.15;

    if (blade1Ref.current) {
      blade1Ref.current.rotation.z = 0.3 + snipAngle;
      const mat = blade1Ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.7 + Math.sin(t * 6) * 0.3;
    }
    if (blade2Ref.current) {
      blade2Ref.current.rotation.z = -0.3 - snipAngle;
      const mat = blade2Ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.7 + Math.sin(t * 6 + 1) * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Blade 1 */}
      <mesh ref={blade1Ref} position={[0, 0.15, 0]}>
        <boxGeometry args={[0.06, 0.55, 0.03]} />
        <meshStandardMaterial
          color="#FF3131"
          emissive="#FF3131"
          emissiveIntensity={0.7}
        />
      </mesh>
      {/* Blade 2 */}
      <mesh ref={blade2Ref} position={[0, -0.15, 0]}>
        <boxGeometry args={[0.06, 0.55, 0.03]} />
        <meshStandardMaterial
          color="#FF3131"
          emissive="#FF3131"
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* Blade tip point lights */}
      <pointLight position={[0, 0.4, 0]} color="#FF3131" intensity={0.5} distance={2} />
      <pointLight position={[0, -0.4, 0]} color="#FF3131" intensity={0.5} distance={2} />

      {/* Center heat glow */}
      <mesh>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial
          color="#FF6050"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
