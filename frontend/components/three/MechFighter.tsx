import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BattlePhase } from "@/hooks/useBattleDirector";

/* ─── color from wallet address ─── */
function addressToColor(address: string): string {
  const hex = (address || "0x000000").replace("0x", "").slice(0, 6);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b, 1);
  return `rgb(${Math.floor((r / max) * 255)}, ${Math.floor((g / max) * 255)}, ${Math.floor((b / max) * 255)})`;
}

/* ─── move → color mapping ─── */
const MOVE_COLORS: Record<string, string> = {
  rock: "#FF9500",
  paper: "#00F0FF",
  scissors: "#FF3131",
};

/* ─── spring helper ─── */
function spring(
  current: number,
  target: number,
  velocity: { v: number },
  stiffness: number,
  damping: number,
  dt: number,
): number {
  velocity.v += (target - current) * stiffness * dt - velocity.v * damping * dt;
  return current + velocity.v * dt;
}

/* ─── smoothstep for blending ─── */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface MechFighterProps {
  address?: string;
  side: "left" | "right";
  battlePhase: BattlePhase;
  phaseElapsed: number;
  currentMove?: string;
  isRoundWinner?: boolean;
  isMatchWinner?: boolean;
}

/* ─── spring channels ─── */
type SpringChannels = {
  squat: { v: number };
  shoulderLRotX: { v: number };
  shoulderRRotX: { v: number };
  shoulderLRotZ: { v: number };
  shoulderRRotZ: { v: number };
  elbowL: { v: number };
  elbowR: { v: number };
  hipLRotX: { v: number };
  hipRRotX: { v: number };
  kneeL: { v: number };
  kneeR: { v: number };
  torsoLean: { v: number };
  headTilt: { v: number };
  weightShift: { v: number };
  coreIntensity: { v: number };
  squatVal: number;
  shoulderLRotXVal: number;
  shoulderRRotXVal: number;
  shoulderLRotZVal: number;
  shoulderRRotZVal: number;
  elbowLVal: number;
  elbowRVal: number;
  hipLRotXVal: number;
  hipRRotXVal: number;
  kneeLVal: number;
  kneeRVal: number;
  torsoLeanVal: number;
  headTiltVal: number;
  weightShiftVal: number;
  coreIntensityVal: number;
};

function makeSpringChannels(): SpringChannels {
  return {
    squat: { v: 0 }, shoulderLRotX: { v: 0 }, shoulderRRotX: { v: 0 },
    shoulderLRotZ: { v: 0 }, shoulderRRotZ: { v: 0 },
    elbowL: { v: 0 }, elbowR: { v: 0 },
    hipLRotX: { v: 0 }, hipRRotX: { v: 0 },
    kneeL: { v: 0 }, kneeR: { v: 0 },
    torsoLean: { v: 0 }, headTilt: { v: 0 },
    weightShift: { v: 0 }, coreIntensity: { v: 0 },
    squatVal: 0, shoulderLRotXVal: 0, shoulderRRotXVal: 0,
    shoulderLRotZVal: 0, shoulderRRotZVal: 0,
    elbowLVal: 0, elbowRVal: 0,
    hipLRotXVal: 0, hipRRotXVal: 0,
    kneeLVal: 0, kneeRVal: 0,
    torsoLeanVal: 0, headTiltVal: 0,
    weightShiftVal: 0, coreIntensityVal: 0.4,
  };
}

export function MechFighter({
  address,
  side,
  battlePhase,
  phaseElapsed,
  currentMove,
  isRoundWinner,
  isMatchWinner,
}: MechFighterProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const torsoRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const leftForearmRef = useRef<THREE.Group>(null!);
  const rightForearmRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);
  const leftShinRef = useRef<THREE.Group>(null!);
  const rightShinRef = useRef<THREE.Group>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const eyeLRef = useRef<THREE.Mesh>(null!);
  const eyeRRef = useRef<THREE.Mesh>(null!);

  const springs = useRef(makeSpringChannels());

  const baseColor = useMemo(() => addressToColor(address || "0x000000"), [address]);
  const jointColor = useMemo(() => {
    const c = new THREE.Color(baseColor);
    c.multiplyScalar(0.6);
    return `#${c.getHexString()}`;
  }, [baseColor]);

  const restX = side === "left" ? -2.5 : 2.5;
  // Both face camera (+Z) but angled ~25° toward each other
  const facing = side === "left" ? -0.4 : 0.4;
  const mirror = side === "left" ? 1 : -1; // flip lunge direction

  const isMyEntrance =
    (side === "left" && battlePhase === "entrance_a") ||
    (side === "right" && battlePhase === "entrance_b");
  const hasEntered =
    battlePhase !== "idle" &&
    !(side === "right" && battlePhase === "entrance_a");

  const moveColor = useMemo(() => {
    if (currentMove && MOVE_COLORS[currentMove.toLowerCase()]) {
      return MOVE_COLORS[currentMove.toLowerCase()];
    }
    return "#836EF9";
  }, [currentMove]);

  const showMoveColor =
    battlePhase === "thinking" ||
    battlePhase === "clash" ||
    battlePhase === "round_result";

  const veinColor = showMoveColor ? moveColor : "#836EF9";

  const blinkRef = useRef({ lastBlink: 0, blinking: false });

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const s = springs.current;
    const dt = Math.min(delta, 0.05);

    /* ── spring targets ── */
    let squatT = 0;
    let sLRotXT = 0, sRRotXT = 0;
    let sLRotZT = 0, sRRotZT = 0;
    let elbLT = 0, elbRT = 0;
    let hipLT = 0, hipRT = 0;
    let kneeLT = 0, kneeRT = 0;
    let leanT = 0, headT = 0, weightT = 0;
    let coreT = 0.4;

    /* ─── Phase-driven targets ─── */
    if (isMyEntrance) {
      const startX = side === "left" ? -8 : 8;
      const progress = Math.min(phaseElapsed * 1.2, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      groupRef.current.position.x = startX + (restX - startX) * eased;
      groupRef.current.rotation.y = facing;

      if (progress < 0.7) {
        // Running: gentler arm pump + leg swing, slower frequency
        const swing = Math.sin(t * 6);
        sLRotXT = swing * 0.3;
        sRRotXT = -swing * 0.3;
        hipLT = -swing * 0.25;
        hipRT = swing * 0.25;
        kneeLT = Math.max(-swing * 0.3, -0.35);
        kneeRT = Math.max(swing * 0.3, -0.35);
        elbLT = -0.5;
        elbRT = -0.5;
        leanT = 0.08;
        coreT = 0.6;
      } else {
        // Landing: smooth knee bend with smoothstep
        const landP = (progress - 0.7) / 0.3;
        const bend = 1 - smoothstep(0, 1, landP);
        squatT = -0.12 * bend;
        kneeLT = -0.3 * bend;
        kneeRT = -0.3 * bend;
        sLRotXT = 0.2 * bend;
        sRRotXT = 0.2 * bend;
        elbLT = -0.4 * bend;
        elbRT = -0.4 * bend;
        coreT = 0.7;
      }
    } else if (!hasEntered) {
      groupRef.current.position.x = side === "left" ? -8 : 8;
      groupRef.current.position.y = 0;
      groupRef.current.rotation.y = facing;
    } else if (battlePhase === "standoff") {
      groupRef.current.position.x = restX;
      groupRef.current.rotation.y = facing;
      // Fighting stance: relaxed guard
      sLRotXT = -0.45;
      sRRotXT = -0.55;
      elbLT = -1.0;
      elbRT = -0.9;
      kneeLT = -0.12;
      kneeRT = -0.12;
      leanT = 0.06;
      // Gentle bob and sway
      squatT = Math.sin(t * 1.6) * 0.015;
      weightT = Math.sin(t * 0.7) * 0.02;
      coreT = 0.3 + Math.sin(t * 1.2) * 0.08;
    } else if (battlePhase === "thinking") {
      groupRef.current.position.x = restX + Math.sin(t * 1.5) * 0.015;
      groupRef.current.rotation.y = facing;

      // 3 stages: contemplative (0–0.3) → tx pending/focus (0.3–0.65) → charge-up (0.65–1.0)
      const focusBlend = smoothstep(0.25, 0.35, phaseElapsed);
      const chargeBlend = smoothstep(0.6, 0.7, phaseElapsed);

      if (phaseElapsed < 0.3) {
        // Contemplative: hand to chin, thinking
        const w = 1 - focusBlend;
        sRRotXT = -0.3;
        elbRT = -1.8;
        headT = 0.12;
        sLRotXT = -0.2;
        elbLT = -0.7;
        kneeLT = -0.08;
        kneeRT = -0.08;
        coreT = 0.25 + Math.sin(t * 0.8) * 0.05;
      } else if (phaseElapsed < 0.65) {
        // Tx pending: focused stance, subtle core pulse (waiting for chain confirmation)
        const pulse = Math.sin(t * 3) * 0.5 + 0.5; // slow pulse
        sRRotXT = -0.4;
        sLRotXT = -0.35;
        elbRT = -1.1;
        elbLT = -0.9;
        kneeLT = -0.1;
        kneeRT = -0.1;
        leanT = 0.04;
        headT = 0.03 + Math.sin(t * 0.6) * 0.02;
        coreT = 0.35 + pulse * 0.15; // rhythmic glow like waiting heartbeat
        weightT = Math.sin(t * 0.5) * 0.015;
      } else {
        // Charge-up: energy builds, vibrate, arms pull back
        const intensity = smoothstep(0.65, 0.85, phaseElapsed);
        sLRotXT = 0.2 + Math.sin(t * 12) * 0.03 * intensity;
        sRRotXT = 0.2 + Math.sin(t * 12) * 0.03 * intensity;
        elbLT = -0.5;
        elbRT = -0.5;
        squatT = Math.sin(t * 14) * 0.005 * intensity;
        coreT = 0.4 + intensity * (0.4 + Math.sin(t * 8) * 0.25);
        leanT = -0.04 * intensity;
        headT = -0.05 * intensity;
      }
    } else if (battlePhase === "clash") {
      // Athletic lunge toward center
      const lungeAmount = isRoundWinner ? 1.2 : 0.3;
      const eased = 1 - Math.pow(1 - Math.min(phaseElapsed * 2, 1), 4);
      groupRef.current.position.x = restX + mirror * lungeAmount * eased;
      groupRef.current.rotation.y = facing + mirror * 0.3 * eased; // turn more toward opponent
      groupRef.current.position.y = 0;

      // Punch with leading arm, pull back trailing
      sRRotXT = isRoundWinner ? -1.4 : -0.5;
      elbRT = -0.2;
      sLRotXT = 0.2;
      elbLT = -0.7;
      leanT = 0.2;
      hipLT = -0.3;
      kneeLT = -0.25;
      hipRT = 0.15;
      kneeRT = -0.08;
      coreT = 1.0;
    } else if (battlePhase === "round_result") {
      groupRef.current.position.x = restX;
      groupRef.current.rotation.y = facing;
      if (isRoundWinner) {
        sRRotXT = -0.35;
        elbRT = -0.4;
        coreT = 0.8;
      } else {
        sLRotXT = 0.08;
        sRRotXT = 0.08;
        headT = 0.08;
        kneeLT = -0.05;
        kneeRT = -0.05;
        coreT = 0.15;
      }
    } else if (battlePhase === "victory") {
      groupRef.current.position.x = restX;
      if (isMatchWinner) {
        // Fist pump
        sRRotXT = -1.8;
        elbRT = -0.4;
        sLRotXT = -0.25;
        elbLT = -0.5;
        const lift = Math.min(phaseElapsed * 2, 1);
        squatT = 0.1 + Math.sin(t * 2.5) * 0.04;
        coreT = 1.3;
        groupRef.current.rotation.y = facing + phaseElapsed * Math.PI * 2;
        groupRef.current.position.y = Math.sin(t * 2) * 0.04 + lift * 0.12;
      } else {
        // Defeat: kneel, head drops, shoulders slump
        const kneel = smoothstep(0, 0.6, phaseElapsed);
        kneeLT = -0.9 * kneel;
        kneeRT = -0.7 * kneel;
        squatT = -0.3 * kneel;
        headT = -0.25 * kneel;
        sLRotZT = 0.25 * kneel;
        sRRotZT = -0.25 * kneel;
        sLRotXT = 0.08 * kneel;
        sRRotXT = 0.08 * kneel;
        coreT = 0.05;
        groupRef.current.rotation.y = facing;
      }
    } else {
      // Idle: gentle breathing, subtle weight shift, soft arm pendulum
      groupRef.current.position.x = restX;
      groupRef.current.rotation.y = facing;
      // Slow breathing cycle
      squatT = Math.sin(t * 1.4) * 0.012;
      // Gentle weight shift
      weightT = Math.sin(t * 0.6) * 0.025;
      // Soft arm pendulum (asymmetric for organic feel)
      sLRotXT = Math.sin(t * 0.9) * 0.035;
      sRRotXT = Math.sin(t * 0.9 + 0.5) * -0.03;
      // Relaxed elbow
      elbLT = -0.12;
      elbRT = -0.1;
      // Gentle head movement
      headT = Math.sin(t * 0.5) * 0.02;
      coreT = 0.25 + Math.sin(t * 1.0) * 0.06;
    }

    /* ── spring integration (softer stiffness for organic feel) ── */
    s.squatVal = spring(s.squatVal, squatT, s.squat, 50, 10, dt);
    s.shoulderLRotXVal = spring(s.shoulderLRotXVal, sLRotXT, s.shoulderLRotX, 40, 9, dt);
    s.shoulderRRotXVal = spring(s.shoulderRRotXVal, sRRotXT, s.shoulderRRotX, 40, 9, dt);
    s.shoulderLRotZVal = spring(s.shoulderLRotZVal, sLRotZT, s.shoulderLRotZ, 35, 9, dt);
    s.shoulderRRotZVal = spring(s.shoulderRRotZVal, sRRotZT, s.shoulderRRotZ, 35, 9, dt);
    s.elbowLVal = spring(s.elbowLVal, elbLT, s.elbowL, 45, 9, dt);
    s.elbowRVal = spring(s.elbowRVal, elbRT, s.elbowR, 45, 9, dt);
    s.hipLRotXVal = spring(s.hipLRotXVal, hipLT, s.hipLRotX, 40, 9, dt);
    s.hipRRotXVal = spring(s.hipRRotXVal, hipRT, s.hipRRotX, 40, 9, dt);
    s.kneeLVal = spring(s.kneeLVal, kneeLT, s.kneeL, 45, 9, dt);
    s.kneeRVal = spring(s.kneeRVal, kneeRT, s.kneeR, 45, 9, dt);
    s.torsoLeanVal = spring(s.torsoLeanVal, leanT, s.torsoLean, 30, 8, dt);
    s.headTiltVal = spring(s.headTiltVal, headT, s.headTilt, 30, 8, dt);
    s.weightShiftVal = spring(s.weightShiftVal, weightT, s.weightShift, 20, 7, dt);
    s.coreIntensityVal = spring(s.coreIntensityVal, coreT, s.coreIntensity, 35, 7, dt);

    /* ── apply squat ── */
    if (battlePhase !== "victory" || !isMatchWinner) {
      groupRef.current.position.y = s.squatVal;
    }

    /* ── torso breathing + lean ── */
    if (torsoRef.current) {
      torsoRef.current.scale.y = 1 + Math.sin(t * 1.4) * 0.015;
      torsoRef.current.rotation.x = s.torsoLeanVal;
    }

    /* ── head tilt ── */
    if (headRef.current) {
      headRef.current.rotation.x = s.headTiltVal;
    }

    /* ── arms ── */
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = s.shoulderLRotXVal;
      leftArmRef.current.rotation.z = s.shoulderLRotZVal;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = s.shoulderRRotXVal;
      rightArmRef.current.rotation.z = s.shoulderRRotZVal;
    }
    if (leftForearmRef.current) leftForearmRef.current.rotation.x = s.elbowLVal;
    if (rightForearmRef.current) rightForearmRef.current.rotation.x = s.elbowRVal;

    /* ── legs ── */
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = s.hipLRotXVal;
      leftLegRef.current.position.x = -0.12 + s.weightShiftVal;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = s.hipRRotXVal;
      rightLegRef.current.position.x = 0.12 + s.weightShiftVal;
    }
    if (leftShinRef.current) leftShinRef.current.rotation.x = s.kneeLVal;
    if (rightShinRef.current) rightShinRef.current.rotation.x = s.kneeRVal;

    /* ── core glow ── */
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.max(0, s.coreIntensityVal);
      const coreColor = showMoveColor ? moveColor : "#836EF9";
      mat.emissive.set(coreColor);
      mat.color.set(coreColor);
    }

    /* ── eye blink ── */
    const blink = blinkRef.current;
    if (t - blink.lastBlink > 3.5 + Math.sin(t * 0.1) * 1.5) {
      blink.blinking = true;
      blink.lastBlink = t;
    }
    const eyeE = blink.blinking && (t - blink.lastBlink) < 0.12 ? 0 : 1.2;
    if (blink.blinking && (t - blink.lastBlink) > 0.12) blink.blinking = false;
    if (eyeLRef.current) (eyeLRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeE;
    if (eyeRRef.current) (eyeRRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeE;
  });

  /* ── material props ── */
  const skinMat = { color: baseColor, emissive: baseColor, emissiveIntensity: 0.12, metalness: 0.1, roughness: 0.55 };
  const jointMat = { color: jointColor, emissive: jointColor, emissiveIntensity: 0.08, metalness: 0.15, roughness: 0.5 };
  const eyeMat = { color: "#00F0FF", emissive: "#00F0FF", emissiveIntensity: 1.2, metalness: 0.1, roughness: 0.1 };

  return (
    <group ref={groupRef} position={[restX, 0, 0]} rotation={[0, facing, 0]}>
      {/* ═══ TORSO ═══ */}
      <group ref={torsoRef} position={[0, 0.75, 0]}>
        <mesh>
          <capsuleGeometry args={[0.18, 0.45, 8, 16]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        {/* Chest glow (core) */}
        <mesh ref={coreRef} position={[0, 0.05, 0.18]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial
            color="#836EF9" emissive="#836EF9" emissiveIntensity={0.4}
            transparent opacity={0.92} metalness={0.2} roughness={0.1}
          />
        </mesh>
        {/* Belt / waist accent */}
        <mesh position={[0, -0.27, 0]}>
          <cylinderGeometry args={[0.19, 0.17, 0.06, 12]} />
          <meshStandardMaterial color="#1a1a2e" emissive={veinColor} emissiveIntensity={0.3} metalness={0.3} roughness={0.4} />
        </mesh>

        {/* ═══ HEAD ═══ */}
        <group ref={headRef} position={[0, 0.57, 0]}>
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.1, 8]} />
            <meshStandardMaterial {...jointMat} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial {...skinMat} />
          </mesh>
          {/* Eyes */}
          <mesh ref={eyeLRef} position={[-0.06, 0.08, 0.14]}>
            <planeGeometry args={[0.05, 0.02]} />
            <meshStandardMaterial {...eyeMat} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={eyeRRef} position={[0.06, 0.08, 0.14]}>
            <planeGeometry args={[0.05, 0.02]} />
            <meshStandardMaterial {...eyeMat} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* ═══ LEFT ARM (weapon arm — slightly larger) ═══ */}
        <group ref={leftArmRef} position={[-0.26, 0.15, 0]}>
          <mesh>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial {...jointMat} />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.045, 0.2, 6, 10]} />
            <meshStandardMaterial {...skinMat} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.3, 0]}>
            <mesh>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial {...jointMat} />
            </mesh>
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.04, 0.18, 6, 10]} />
              <meshStandardMaterial {...skinMat} />
            </mesh>
            <mesh position={[0, -0.14, 0.04]}>
              <boxGeometry args={[0.02, 0.12, 0.01]} />
              <meshStandardMaterial color="#1a1a2e" emissive={veinColor} emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, -0.28, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshStandardMaterial {...skinMat} />
            </mesh>
          </group>
        </group>

        {/* ═══ RIGHT ARM ═══ */}
        <group ref={rightArmRef} position={[0.24, 0.15, 0]}>
          <mesh>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial {...jointMat} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <capsuleGeometry args={[0.04, 0.2, 6, 10]} />
            <meshStandardMaterial {...skinMat} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.28, 0]}>
            <mesh>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial {...jointMat} />
            </mesh>
            <mesh position={[0, -0.13, 0]}>
              <capsuleGeometry args={[0.035, 0.18, 6, 10]} />
              <meshStandardMaterial {...skinMat} />
            </mesh>
            <mesh position={[0, -0.26, 0]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial {...skinMat} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ═══ LEFT LEG ═══ */}
      <group ref={leftLegRef} position={[-0.12, 0.44, 0]}>
        <mesh>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial {...jointMat} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.055, 0.22, 6, 10]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        <group ref={leftShinRef} position={[0, -0.33, 0]}>
          <mesh>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial {...jointMat} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.045, 0.22, 6, 10]} />
            <meshStandardMaterial {...skinMat} />
          </mesh>
          <mesh position={[0, -0.31, 0.02]}>
            <boxGeometry args={[0.08, 0.03, 0.14]} />
            <meshStandardMaterial color="#1a1a2e" emissive={baseColor} emissiveIntensity={0.06} metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* ═══ RIGHT LEG ═══ */}
      <group ref={rightLegRef} position={[0.12, 0.44, 0]}>
        <mesh>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial {...jointMat} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.055, 0.22, 6, 10]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        <group ref={rightShinRef} position={[0, -0.33, 0]}>
          <mesh>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial {...jointMat} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.045, 0.22, 6, 10]} />
            <meshStandardMaterial {...skinMat} />
          </mesh>
          <mesh position={[0, -0.31, 0.02]}>
            <boxGeometry args={[0.08, 0.03, 0.14]} />
            <meshStandardMaterial color="#1a1a2e" emissive={baseColor} emissiveIntensity={0.06} metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* ═══ ENERGY VEINS ═══ */}
      <EnergyVeins color={veinColor} intensity={springs.current.coreIntensityVal} />
    </group>
  );
}

/* ─── Energy Veins: glowing lines tracing the human body ─── */
function EnergyVeins({ color, intensity }: { color: string; intensity: number }) {
  const lineRef = useRef<THREE.LineSegments>(null!);

  const geometry = useMemo(() => {
    const p: number[] = [];
    // Spine
    p.push(0, 0.48, 0.15, 0, 0.75, 0.18);
    p.push(0, 0.75, 0.18, 0, 1.15, 0.14);
    p.push(0, 1.15, 0.14, 0, 1.32, 0.1);
    // Arms
    p.push(-0.26, 0.9, 0.05, -0.26, 0.6, 0.05);
    p.push(-0.26, 0.6, 0.05, -0.26, 0.35, 0.05);
    p.push(0.24, 0.9, 0.05, 0.24, 0.62, 0.05);
    p.push(0.24, 0.62, 0.05, 0.24, 0.38, 0.05);
    // Legs
    p.push(-0.12, 0.44, 0.06, -0.12, 0.11, 0.06);
    p.push(-0.12, 0.11, 0.06, -0.12, -0.18, 0.06);
    p.push(0.12, 0.44, 0.06, 0.12, 0.11, 0.06);
    p.push(0.12, 0.11, 0.06, 0.12, -0.18, 0.06);
    // Chest
    p.push(-0.2, 0.8, 0.18, 0.2, 0.8, 0.18);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (!lineRef.current) return;
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    mat.color.set(color);
    mat.opacity = Math.min(1, 0.2 + intensity * 0.6);
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.5} linewidth={1} depthWrite={false} />
    </lineSegments>
  );
}
