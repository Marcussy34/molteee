import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GridFloor } from "./GridFloor";
import { Particles } from "./Particles";
import { CRTEffect } from "./CRTEffect";

function addressToColor(address: string): string {
  const hex = (address || "0x000000").replace("0x", "").slice(0, 6);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b, 1);
  return `rgb(${Math.floor((r / max) * 255)}, ${Math.floor((g / max) * 255)}, ${Math.floor((b / max) * 255)})`;
}

interface FighterProps {
  address?: string;
  side: "left" | "right";
  isActive: boolean;
  currentMove?: string;
  isWinner?: boolean;
}

function Fighter({ address, side, isActive, currentMove, isWinner }: FighterProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);

  const color = useMemo(() => addressToColor(address || "0x000000"), [address]);
  const xPos = side === "left" ? -2.5 : 2.5;
  const facing = side === "left" ? 0 : Math.PI;

  useFrame((state) => {
    if (!groupRef.current) return;

    // Idle bounce
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;

    // Attack animation when move is active
    if (isActive && currentMove) {
      const punch = Math.sin(state.clock.elapsedTime * 8) * 0.6;
      if (rightArmRef.current) rightArmRef.current.rotation.x = punch;
    } else {
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x *= 0.9;
      }
    }

    // Celebrate on win
    if (isWinner) {
      if (leftArmRef.current) leftArmRef.current.rotation.z = -Math.PI * 0.6;
      if (rightArmRef.current) rightArmRef.current.rotation.z = Math.PI * 0.6;
    } else {
      if (leftArmRef.current) leftArmRef.current.rotation.z = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.z = 0;
    }
  });

  return (
    <group ref={groupRef} position={[xPos, 0, 0]} rotation={[0, facing, 0]}>
      {/* Body */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.45]} />
        <meshStandardMaterial color={color} wireframe emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color={color} wireframe emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Left arm */}
      <mesh ref={leftArmRef} position={[-0.55, 0.7, 0]}>
        <boxGeometry args={[0.18, 0.65, 0.18]} />
        <meshStandardMaterial color={color} wireframe emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Right arm */}
      <mesh ref={rightArmRef} position={[0.55, 0.7, 0]}>
        <boxGeometry args={[0.18, 0.65, 0.18]} />
        <meshStandardMaterial color={color} wireframe emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Left leg */}
      <mesh position={[-0.18, 0, 0]}>
        <boxGeometry args={[0.22, 0.55, 0.22]} />
        <meshStandardMaterial color={color} wireframe emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.18, 0, 0]}>
        <boxGeometry args={[0.22, 0.55, 0.22]} />
        <meshStandardMaterial color={color} wireframe emissive={color} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

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

interface ArenaSceneProps {
  playerA?: string;
  playerB?: string;
  isActive: boolean;
  moveA?: string;
  moveB?: string;
  winner?: "A" | "B" | null;
}

export function ArenaScene({ playerA, playerB, isActive, moveA, moveB, winner }: ArenaSceneProps) {
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
      <Particles count={150} />
      <ArenaRing />

      <Fighter
        address={playerA}
        side="left"
        isActive={isActive}
        currentMove={moveA}
        isWinner={winner === "A"}
      />
      <Fighter
        address={playerB}
        side="right"
        isActive={isActive}
        currentMove={moveB}
        isWinner={winner === "B"}
      />

      <CRTEffect />
    </Canvas>
  );
}
