import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GridFloor } from "./GridFloor";
import { Particles } from "./Particles";
import { FloatingIcons } from "./FloatingIcons";
import { CRTEffect } from "./CRTEffect";

// 6 agent addresses from data/agents.json
const AGENT_ADDRESSES = [
  "0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
];

function addressToColor(address: string): string {
  const hex = address.replace("0x", "").slice(0, 6);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b, 1);
  return `rgb(${Math.floor((r / max) * 255)}, ${Math.floor((g / max) * 255)}, ${Math.floor((b / max) * 255)})`;
}

/** Seeded pseudo-random from address index */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface WaypointWalkerProps {
  address: string;
  index: number;
}

/** A wireframe agent figure that walks between random waypoints on the grid */
function WaypointWalker({ address, index }: WaypointWalkerProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Mesh>(null!);
  const rightLegRef = useRef<THREE.Mesh>(null!);
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);

  const color = useMemo(() => addressToColor(address), [address]);

  // Generate waypoints and movement params per agent
  const { waypoints, speed } = useMemo(() => {
    const rng = seededRandom(index * 7919 + 31);
    const gridRadius = 8;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      pts.push(
        new THREE.Vector3(
          (rng() - 0.5) * gridRadius * 2,
          0,
          (rng() - 0.5) * gridRadius * 2
        )
      );
    }
    return { waypoints: pts, speed: 0.6 + rng() * 0.6 };
  }, [index]);

  const waypointIndex = useRef(0);
  const progress = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const from = waypoints[waypointIndex.current % waypoints.length];
    const to = waypoints[(waypointIndex.current + 1) % waypoints.length];

    progress.current += delta * speed * 0.3;
    if (progress.current >= 1) {
      progress.current = 0;
      waypointIndex.current++;
    }

    // Lerp position
    const x = THREE.MathUtils.lerp(from.x, to.x, progress.current);
    const z = THREE.MathUtils.lerp(from.z, to.z, progress.current);
    groupRef.current.position.set(x, 0, z);

    // Face direction of movement
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }

    // Walking animation — swing legs and arms
    const walkCycle = Math.sin(state.clock.elapsedTime * speed * 6 + index * 2);
    if (leftLegRef.current) leftLegRef.current.rotation.x = walkCycle * 0.4;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -walkCycle * 0.4;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -walkCycle * 0.3;
    if (rightArmRef.current) rightArmRef.current.rotation.x = walkCycle * 0.3;

    // Subtle bob
    groupRef.current.position.y = Math.abs(walkCycle) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Left arm */}
      <mesh ref={leftArmRef} position={[-0.45, 0.6, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Right arm */}
      <mesh ref={rightArmRef} position={[0.45, 0.6, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Left leg */}
      <mesh ref={leftLegRef} position={[-0.15, 0, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Right leg */}
      <mesh ref={rightLegRef} position={[0.15, 0, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}

export function LandingScene() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 6, 14], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#08061A"]} />
        <fog attach="fog" args={["#08061A", 15, 45]} />

        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <pointLight position={[0, 10, 0]} intensity={1.5} color="#836EF9" distance={40} />
        <pointLight position={[-8, 5, 5]} intensity={0.6} color="#00F0FF" distance={30} />
        <pointLight position={[8, 5, -5]} intensity={0.4} color="#6C4ED9" distance={25} />

        {/* Scene elements */}
        <GridFloor />
        <Particles count={350} />
        <FloatingIcons />

        {/* 6 Agent figures walking around the arena */}
        {AGENT_ADDRESSES.map((addr, i) => (
          <WaypointWalker key={addr} address={addr} index={i} />
        ))}

        {/* Post-processing */}
        <CRTEffect />

        {/* Camera controls - auto rotate, no zoom/pan */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.25}
          maxPolarAngle={Math.PI / 2.3}
          minPolarAngle={Math.PI / 4}
          target={[0, 1, 0]}
        />
      </Canvas>
    </div>
  );
}
