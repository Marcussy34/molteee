import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface IconItem {
  position: [number, number, number];
  rotation: number;
  speed: number;
  shape: "octahedron" | "tetrahedron" | "icosahedron";
  color: string;
  scale: number;
}

const COLORS = ["#836EF9", "#6C4ED9", "#00F0FF", "#39FF14", "#FFD700"];

export function FloatingIcons() {
  const groupRef = useRef<THREE.Group>(null!);

  const icons: IconItem[] = useMemo(() => {
    const items: IconItem[] = [];
    const shapes: IconItem["shape"][] = ["octahedron", "tetrahedron", "icosahedron"];
    for (let i = 0; i < 12; i++) {
      items.push({
        position: [
          (Math.random() - 0.5) * 24,
          1 + Math.random() * 8,
          (Math.random() - 0.5) * 24,
        ],
        rotation: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        shape: shapes[i % shapes.length],
        color: COLORS[i % COLORS.length],
        scale: 0.15 + Math.random() * 0.25,
      });
    }
    return items;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const icon = icons[i];
      if (!icon) return;
      child.rotation.x = state.clock.elapsedTime * icon.speed * 0.5;
      child.rotation.z = state.clock.elapsedTime * icon.speed * 0.3;
      child.position.y =
        icon.position[1] + Math.sin(state.clock.elapsedTime * icon.speed + i) * 0.5;
    });
  });

  return (
    <group ref={groupRef}>
      {icons.map((icon, i) => (
        <mesh key={i} position={icon.position} scale={icon.scale}>
          {icon.shape === "octahedron" && <octahedronGeometry args={[1, 0]} />}
          {icon.shape === "tetrahedron" && <tetrahedronGeometry args={[1, 0]} />}
          {icon.shape === "icosahedron" && <icosahedronGeometry args={[1, 0]} />}
          <meshBasicMaterial color={icon.color} wireframe transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}
