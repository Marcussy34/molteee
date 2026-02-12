import { useMemo } from "react";

const MOVE_COLORS: Record<string, string> = {
  rock: "#FF9500",
  paper: "#00F0FF",
  scissors: "#FF3131",
};

/* ── SVG hand signs ── */
function RockIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* closed fist */}
      <path
        d="M20 44 C20 44 16 40 16 32 C16 24 20 18 24 16 C26 15 28 15 30 16 L30 14 C30 11 33 9 36 10 C38 10.5 39 12 39 14 L39 15 C41 14 44 15 44 18 L44 20 C46 19 48 20 48 23 L48 36 C48 42 44 46 38 48 L26 48 C22 48 20 46 20 44Z"
        fill={color}
        opacity={0.9}
      />
      <path
        d="M20 44 C20 44 16 40 16 32 C16 24 20 18 24 16 C26 15 28 15 30 16 L30 14 C30 11 33 9 36 10 C38 10.5 39 12 39 14 L39 15 C41 14 44 15 44 18 L44 20 C46 19 48 20 48 23 L48 36 C48 42 44 46 38 48 L26 48 C22 48 20 46 20 44Z"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </svg>
  );
}

function PaperIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* open palm */}
      <path
        d="M22 48 C22 48 18 44 18 38 L18 28 C18 26 19 25 20 25 C21 25 22 26 22 28 L22 22 L22 14 C22 12 23 11 24.5 11 C26 11 27 12 27 14 L27 24 L27 12 C27 10 28 9 29.5 9 C31 9 32 10 32 12 L32 24 L32 13 C32 11 33 10 34.5 10 C36 10 37 11 37 13 L37 26 L37 18 C37 16 38 15 39.5 15 C41 15 42 16 42 18 L42 38 C42 44 38 48 32 48 Z"
        fill={color}
        opacity={0.9}
      />
      <path
        d="M22 48 C22 48 18 44 18 38 L18 28 C18 26 19 25 20 25 C21 25 22 26 22 28 L22 22 L22 14 C22 12 23 11 24.5 11 C26 11 27 12 27 14 L27 24 L27 12 C27 10 28 9 29.5 9 C31 9 32 10 32 12 L32 24 L32 13 C32 11 33 10 34.5 10 C36 10 37 11 37 13 L37 26 L37 18 C37 16 38 15 39.5 15 C41 15 42 16 42 18 L42 38 C42 44 38 48 32 48 Z"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </svg>
  );
}

function ScissorsIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* V-sign / peace */}
      <path
        d="M20 48 C20 48 16 44 16 38 L16 32 C16 30 17 29 18 29 C19 29 20 30 20 32 L20 28 L24 10 C24.5 8 26 7 27.5 7.5 C29 8 29.5 10 29 12 L26 26 L32 10 C32.5 8 34 7 35.5 7.5 C37 8 37.5 10 37 12 L33 28 L37 24 C37 22 38 21 39.5 21 C41 21 42 22 42 24 L42 38 C42 44 38 48 32 48 Z"
        fill={color}
        opacity={0.9}
      />
      <path
        d="M20 48 C20 48 16 44 16 38 L16 32 C16 30 17 29 18 29 C19 29 20 30 20 32 L20 28 L24 10 C24.5 8 26 7 27.5 7.5 C29 8 29.5 10 29 12 L26 26 L32 10 C32.5 8 34 7 35.5 7.5 C37 8 37.5 10 37 12 L33 28 L37 24 C37 22 38 21 39.5 21 C41 21 42 22 42 24 L42 38 C42 44 38 48 32 48 Z"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </svg>
  );
}

const ICONS: Record<string, React.FC<{ color: string }>> = {
  rock: RockIcon,
  paper: PaperIcon,
  scissors: ScissorsIcon,
};

export interface MoveRevealPopupProps {
  move?: string;
  side: "left" | "right";
  visible: boolean;
  phaseElapsed: number;
}

export function MoveRevealPopup({ move, side, visible, phaseElapsed }: MoveRevealPopupProps) {
  if (!visible || !move) return null;

  const key = move.toLowerCase();
  const color = MOVE_COLORS[key] || "#836EF9";
  const Icon = ICONS[key];

  // Animation phases driven by phaseElapsed
  let scale = 1;
  let opacity = 1;
  let translateY = 0;

  if (phaseElapsed < 0.15) {
    // Pop in: 0→0.15
    const p = phaseElapsed / 0.15;
    const eased = 1 - Math.pow(1 - p, 3);
    scale = 0.3 + eased * 0.85; // overshoot handled by CSS
    opacity = Math.min(1, p * 2);
  } else if (phaseElapsed < 0.4) {
    // Hold: settle to 1.0
    scale = 1.0;
    opacity = 1;
  } else {
    // Fade out: 0.4→0.6
    const p = Math.min((phaseElapsed - 0.4) / 0.2, 1);
    scale = 1 - p * 0.15;
    opacity = 1 - p;
    translateY = -p * 10;
  }

  const left = side === "left" ? "22%" : "78%";

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top: "50%",
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
        opacity,
        zIndex: 20,
        transition: phaseElapsed < 0.15 ? "transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 80,
          height: 80,
          background: "rgba(10, 10, 20, 0.85)",
          border: `3px solid ${color}`,
          boxShadow: `0 0 20px ${color}66, 0 0 40px ${color}33, inset 0 0 15px ${color}22`,
        }}
      >
        {Icon && <Icon color={color} />}
      </div>
      <div
        className="text-center mt-1 font-pixel"
        style={{
          fontSize: 10,
          color,
          textShadow: `0 0 8px ${color}`,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {key}
      </div>
    </div>
  );
}
