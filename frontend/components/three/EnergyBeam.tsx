import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface EnergyBeamProps {
  /** Which side the winner is on */
  side: "left" | "right";
  /** 0..1 normalized phase progress */
  phaseElapsed: number;
  /** Beam color */
  color?: string;
}

// Custom shader for scrolling energy beam effect
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    // Vertical energy scroll
    float scroll = fract(vUv.y * 3.0 - uTime * 2.0);
    float energy = smoothstep(0.0, 0.1, scroll) * (1.0 - smoothstep(0.4, 0.5, scroll));

    // Fade at edges horizontally
    float edgeFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);

    // Fade at top
    float topFade = 1.0 - smoothstep(0.7, 1.0, vUv.y);

    // Core brightness
    float core = smoothstep(0.3, 0.0, abs(vUv.x - 0.5));

    float alpha = (energy * 0.5 + core * 0.6) * edgeFade * topFade * uOpacity;
    vec3 finalColor = mix(uColor, vec3(1.0), core * 0.5);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function EnergyBeam({
  side,
  phaseElapsed,
  color = "#836EF9",
}: EnergyBeamProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const x = side === "left" ? -2.5 : 2.5;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    }),
    [color]
  );

  useFrame((state) => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

    // Fade in during first 30% of phase, sustain
    const opacity = Math.min(phaseElapsed * 3, 1) * 0.7;
    materialRef.current.uniforms.uOpacity.value = opacity;

    // Grow from nothing
    if (meshRef.current) {
      const scaleY = Math.min(phaseElapsed * 2, 1);
      meshRef.current.scale.set(1, scaleY, 1);
    }
  });

  return (
    <mesh ref={meshRef} position={[x, 4, 0]}>
      <cylinderGeometry args={[0.15, 0.4, 8, 16, 1, true]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
