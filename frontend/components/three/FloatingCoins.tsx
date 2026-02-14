import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

interface CoinData {
  x: number;
  y: number;
  z: number;
  bobSpeed: number;
  bobAmp: number;
  spinSpeed: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  driftSpeed: number;
  driftAmp: number;
  phase: number;
  scale: number;
}

function Coin({ data }: { data: CoinData }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, "/Moltee_Log.png");

  const materials = useMemo(() => {
    const faceMat = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.7,
      roughness: 0.2,
      emissive: new THREE.Color("#836EF9"),
      emissiveIntensity: 0.15,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c9a800"),
      metalness: 0.9,
      roughness: 0.15,
      emissive: new THREE.Color("#836EF9"),
      emissiveIntensity: 0.1,
    });
    // [+x, -x, +y, -y, +z (front face), -z (back face)]
    // For a cylinder: [side, top, bottom]
    return [edgeMat, faceMat, faceMat];
  }, [texture]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const p = data.phase;

    // Full 3D tumble rotation on all axes
    meshRef.current.rotation.x = t * data.spinSpeed * 0.7 + Math.sin(t * data.wobbleSpeed + p) * data.wobbleAmp;
    meshRef.current.rotation.y = t * data.spinSpeed + Math.cos(t * data.wobbleSpeed * 0.6 + p * 1.3) * data.wobbleAmp;
    meshRef.current.rotation.z = t * data.spinSpeed * 0.4 + Math.sin(t * data.wobbleSpeed * 0.8 + p * 0.7) * data.wobbleAmp * 0.5;

    // Bob up and down
    meshRef.current.position.y =
      data.y + Math.sin(t * data.bobSpeed + p) * data.bobAmp;

    // Gentle horizontal drift
    meshRef.current.position.x =
      data.x + Math.sin(t * data.driftSpeed + p * 2) * data.driftAmp;
    meshRef.current.position.z =
      data.z + Math.cos(t * data.driftSpeed * 0.8 + p) * data.driftAmp * 0.5;
  });

  return (
    <mesh
      ref={meshRef}
      position={[data.x, data.y, data.z]}
      scale={data.scale}
    >
      <cylinderGeometry args={[1, 1, 0.12, 32]} />
      {materials.map((mat, i) => (
        <primitive key={i} object={mat} attach={`material-${i}`} />
      ))}
    </mesh>
  );
}

function CoinsScene() {
  const coins: CoinData[] = useMemo(() => {
    const items: CoinData[] = [];
    // Left side coins
    items.push(
      { x: -3.5, y: 0.5,  z: 0,    bobSpeed: 0.4, bobAmp: 0.3, spinSpeed: 0.35, wobbleSpeed: 0.6, wobbleAmp: 0.2,  driftSpeed: 0.25, driftAmp: 0.15, phase: 0,   scale: 0.7 },
      { x: -2.8, y: -1.0, z: 0.5,  bobSpeed: 0.5, bobAmp: 0.25, spinSpeed: -0.4, wobbleSpeed: 0.5, wobbleAmp: 0.25, driftSpeed: 0.3,  driftAmp: 0.12, phase: 1.5, scale: 0.5 },
      { x: -4.0, y: 1.8,  z: -0.3, bobSpeed: 0.35, bobAmp: 0.35, spinSpeed: 0.3, wobbleSpeed: 0.45, wobbleAmp: 0.18, driftSpeed: 0.2,  driftAmp: 0.18, phase: 3.0, scale: 0.55 },
    );
    // Right side coins
    items.push(
      { x: 3.5,  y: 0.2,  z: 0,    bobSpeed: 0.45, bobAmp: 0.28, spinSpeed: -0.35, wobbleSpeed: 0.55, wobbleAmp: 0.22, driftSpeed: 0.28, driftAmp: 0.14, phase: 0.8, scale: 0.7 },
      { x: 2.8,  y: -0.8, z: 0.4,  bobSpeed: 0.38, bobAmp: 0.3, spinSpeed: 0.45, wobbleSpeed: 0.5, wobbleAmp: 0.2,  driftSpeed: 0.22, driftAmp: 0.16, phase: 2.2, scale: 0.5 },
      { x: 4.0,  y: 1.5,  z: -0.2, bobSpeed: 0.5, bobAmp: 0.25, spinSpeed: -0.3, wobbleSpeed: 0.6, wobbleAmp: 0.15, driftSpeed: 0.3,  driftAmp: 0.12, phase: 4.0, scale: 0.55 },
    );
    return items;
  }, []);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[-4, 3, 3]} intensity={1.2} color="#836EF9" distance={15} />
      <pointLight position={[4, 3, 3]} intensity={1.2} color="#00F0FF" distance={15} />
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#ffffff" distance={10} />
      {coins.map((coin, i) => (
        <Coin key={i} data={coin} />
      ))}
    </>
  );
}

export function FloatingCoins() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ pointerEvents: "none" }}
    >
      <CoinsScene />
    </Canvas>
  );
}
