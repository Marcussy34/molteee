import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CRTEffectProps {
  /** Intensity multiplier. 1.0 = normal, 2.0 = heavy scanlines during clash */
  intensity?: number;
}

/**
 * Simple in-scene CRT scanline effect using a fullscreen quad
 * rendered on top of the scene. This avoids needing EffectComposer.
 */
export function CRTEffect({ intensity = 1.0 }: CRTEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { viewport } = useThree();
  const currentIntensity = useRef(1.0);

  const material = useRef(
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
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
        uniform float uIntensity;
        void main() {
          float scanline = sin(vUv.y * 800.0) * 0.04 * uIntensity;
          float flicker = 0.98 + 0.02 * sin(uTime * 8.0) * uIntensity;
          float vignette = 1.0 - smoothstep(0.4, 1.4, length(vUv - 0.5) * 2.0);
          float alpha = (scanline + 0.02) * vignette * flicker;
          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
    })
  ).current;

  useFrame((state, delta) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    // Smooth lerp toward target intensity
    currentIntensity.current += (intensity - currentIntensity.current) * (1 - Math.exp(-8 * delta));
    material.uniforms.uIntensity.value = currentIntensity.current;
  });

  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
