import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Simple in-scene CRT scanline effect using a fullscreen quad
 * rendered on top of the scene. This avoids needing EffectComposer.
 */
export function CRTEffect() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { viewport } = useThree();

  const material = useRef(
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.999, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float scanline = sin(vUv.y * 800.0) * 0.04;
          float flicker = 0.98 + 0.02 * sin(uTime * 8.0);
          float vignette = 1.0 - smoothstep(0.4, 1.4, length(vUv - 0.5) * 2.0);
          float alpha = (scanline + 0.02) * vignette * flicker;
          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
    })
  ).current;

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
