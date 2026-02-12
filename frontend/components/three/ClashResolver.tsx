import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Outcome = "rock_wins" | "scissors_wins" | "paper_wins" | "draw";

interface ClashResolverProps {
  moveA?: string;
  moveB?: string;
  roundWinner: "A" | "B" | "draw" | null;
  phaseElapsed: number;
}

function resolveOutcome(
  moveA?: string,
  moveB?: string,
  winner?: "A" | "B" | "draw" | null,
): Outcome {
  if (!moveA || !moveB || winner === "draw" || !winner) return "draw";
  const winnerMove = winner === "A" ? moveA.toLowerCase() : moveB.toLowerCase();
  if (winnerMove === "rock") return "rock_wins";
  if (winnerMove === "scissors") return "scissors_wins";
  if (winnerMove === "paper") return "paper_wins";
  return "draw";
}

export function ClashResolver({
  moveA,
  moveB,
  roundWinner,
  phaseElapsed,
}: ClashResolverProps) {
  const outcome = resolveOutcome(moveA, moveB, roundWinner);

  return (
    <group position={[0, 0.8, 0]}>
      {outcome === "rock_wins" && <ShatterEffect phaseElapsed={phaseElapsed} />}
      {outcome === "scissors_wins" && <SliceEffect phaseElapsed={phaseElapsed} />}
      {outcome === "paper_wins" && <WrapEffect phaseElapsed={phaseElapsed} />}
      {outcome === "draw" && <RepelEffect phaseElapsed={phaseElapsed} />}
    </group>
  );
}

/* ═══════════════════════════════════════════════════
   ROCK WINS: Scissor blades shatter into crimson shards with gravity
   ═══════════════════════════════════════════════════ */
const SHARD_COUNT = 20;

function ShatterEffect({ phaseElapsed }: { phaseElapsed: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const shardData = useMemo(() => {
    return Array.from({ length: SHARD_COUNT }, () => ({
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 1,
      vz: (Math.random() - 0.5) * 4,
      rx: Math.random() * 10 - 5,
      ry: Math.random() * 10 - 5,
      rz: Math.random() * 10 - 5,
      scale: 0.04 + Math.random() * 0.06,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = phaseElapsed; // 0..1 over round_result duration (1.3s)
    const seconds = t * 1.3; // approximate real seconds

    for (let i = 0; i < SHARD_COUNT; i++) {
      const d = shardData[i];
      // Physics: position with gravity
      dummy.position.set(
        d.vx * seconds,
        d.vy * seconds - 4.9 * seconds * seconds, // gravity
        d.vz * seconds,
      );
      // Tumble spin
      dummy.rotation.set(d.rx * seconds, d.ry * seconds, d.rz * seconds);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Fade out
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.max(0, 1 - t * 1.2);
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, SHARD_COUNT]}>
        <boxGeometry args={[1, 0.3, 0.1]} />
        <meshStandardMaterial
          color="#FF3131"
          emissive="#FF3131"
          emissiveIntensity={0.5}
          transparent
          opacity={1}
        />
      </instancedMesh>
      {/* Ember particles at center */}
      <EmberBurst color="#FF9500" count={12} phaseElapsed={phaseElapsed} />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   SCISSORS WINS: Paper shields slice apart with angular momentum
   ═══════════════════════════════════════════════════ */
function SliceEffect({ phaseElapsed }: { phaseElapsed: number }) {
  const leftRef = useRef<THREE.Group>(null!);
  const rightRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const t = phaseElapsed;
    const seconds = t * 1.3;

    // Halves tumble away in opposite directions
    if (leftRef.current) {
      leftRef.current.position.set(-seconds * 2.5, seconds * 0.5 - 2 * seconds * seconds, 0);
      leftRef.current.rotation.set(0, 0, -seconds * 4); // angular momentum
    }
    if (rightRef.current) {
      rightRef.current.position.set(seconds * 2.5, seconds * 0.5 - 2 * seconds * seconds, 0);
      rightRef.current.rotation.set(0, 0, seconds * 4);
    }
  });

  const shieldOpacity = Math.max(0, 1 - phaseElapsed * 1.5);

  return (
    <>
      {/* Left half */}
      <group ref={leftRef}>
        <mesh>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial
            color="#00F0FF"
            emissive="#00F0FF"
            emissiveIntensity={0.5}
            transparent
            opacity={shieldOpacity}
            side={THREE.DoubleSide}
            metalness={0.2}
            roughness={0.1}
          />
        </mesh>
      </group>
      {/* Right half */}
      <group ref={rightRef}>
        <mesh>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial
            color="#00F0FF"
            emissive="#00F0FF"
            emissiveIntensity={0.5}
            transparent
            opacity={shieldOpacity}
            side={THREE.DoubleSide}
            metalness={0.2}
            roughness={0.1}
          />
        </mesh>
      </group>
      {/* Slash sparks at center */}
      <SlashSparks phaseElapsed={phaseElapsed} />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   PAPER WINS: Rock sealed and sinks downward
   ═══════════════════════════════════════════════════ */
function WrapEffect({ phaseElapsed }: { phaseElapsed: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const rockRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = phaseElapsed;

    // Converge: shields spin faster as they close in
    groupRef.current.rotation.y = state.clock.elapsedTime * (3 + t * 10);

    // Rock sinks and dims
    if (rockRef.current) {
      rockRef.current.position.y = -t * 1.5;
      const scl = Math.max(0.01, 1 - t * 0.8);
      rockRef.current.scale.setScalar(scl);
      const mat = rockRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.max(0, 0.6 - t * 1.2);
      mat.opacity = Math.max(0, 1 - t * 1.2);
    }
  });

  const wrapScale = Math.max(0.01, 1 - phaseElapsed * 0.6);

  return (
    <group ref={groupRef}>
      {/* Rock being sealed */}
      <mesh ref={rockRef}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial
          color="#2A1A0A"
          emissive="#FF9500"
          emissiveIntensity={0.6}
          transparent
          opacity={1}
          wireframe
        />
      </mesh>

      {/* Converging paper shields */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        const r = 0.5 * wrapScale;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            rotation={[0, angle, 0]}
          >
            <planeGeometry args={[0.3, 0.18]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={0.7 + phaseElapsed * 0.5}
              transparent
              opacity={Math.min(1, 0.6 + phaseElapsed)}
              side={THREE.DoubleSide}
              metalness={0.2}
            roughness={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════════════
   DRAW: Both weapons repel with central spark explosion
   ═══════════════════════════════════════════════════ */
const SPARK_COUNT = 30;

function RepelEffect({ phaseElapsed }: { phaseElapsed: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const sparkData = useMemo(() => {
    return Array.from({ length: SPARK_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 2 + Math.random() * 3;
      return {
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.sin(phi) * Math.sin(theta) * speed,
        vz: Math.cos(phi) * speed,
        scale: 0.02 + Math.random() * 0.03,
      };
    });
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const seconds = phaseElapsed * 1.3;

    for (let i = 0; i < SPARK_COUNT; i++) {
      const d = sparkData[i];
      dummy.position.set(d.vx * seconds, d.vy * seconds, d.vz * seconds);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 1 - phaseElapsed * 1.5);
  });

  return (
    <>
      {/* Spark starburst */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, SPARK_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      {/* Central flash */}
      <mesh scale={[1 - phaseElapsed * 0.8, 1 - phaseElapsed * 0.8, 1 - phaseElapsed * 0.8]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={Math.max(0, 0.8 - phaseElapsed * 2)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/* ─── Shared sub-effects ─── */

function EmberBurst({
  color,
  count,
  phaseElapsed,
}: {
  color: string;
  count: number;
  phaseElapsed: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const embers = useMemo(() => {
    return Array.from({ length: count }, () => ({
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2 + 0.5,
      vz: (Math.random() - 0.5) * 2,
    }));
  }, [count]);

  useFrame(() => {
    if (!meshRef.current) return;
    const seconds = phaseElapsed * 1.3;

    for (let i = 0; i < count; i++) {
      const d = embers[i];
      dummy.position.set(d.vx * seconds, d.vy * seconds - 2 * seconds * seconds, d.vz * seconds);
      dummy.scale.setScalar(0.03);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 1 - phaseElapsed * 1.5);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
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

function SlashSparks({ phaseElapsed }: { phaseElapsed: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const SPARK = 10;

  const sparks = useMemo(() => {
    return Array.from({ length: SPARK }, () => ({
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      vz: (Math.random() - 0.5) * 1,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const seconds = phaseElapsed * 1.3;

    for (let i = 0; i < SPARK; i++) {
      const d = sparks[i];
      dummy.position.set(d.vx * seconds, d.vy * seconds, d.vz * seconds);
      dummy.scale.setScalar(0.025);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 1 - phaseElapsed * 1.8);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SPARK]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color="#FF3131"
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
