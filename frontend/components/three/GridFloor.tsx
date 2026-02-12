import { useMemo } from "react";
import * as THREE from "three";

export function GridFloor() {
  const gridHelper = useMemo(() => {
    const size = 30;
    const divisions = 30;
    const grid = new THREE.GridHelper(size, divisions, 0x836ef9, 0x836ef9);
    (grid.material as THREE.Material).opacity = 0.12;
    (grid.material as THREE.Material).transparent = true;
    return grid;
  }, []);

  return (
    <group>
      <primitive object={gridHelper} position={[0, -0.01, 0]} />
      {/* Subtle ground plane for fog interaction */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial color="#08061A" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
