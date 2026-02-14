import { useState, useEffect } from "react";

export function LoadingScreen({ onFinished }: { onFinished: () => void }) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const duration = 2000; // 2 seconds

    const tick = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const pct = Math.min(elapsed / duration, 1);
      // Ease-out curve for natural feel
      setProgress(Math.round(pct * 100));

      if (pct < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setFadeOut(true);
        setTimeout(onFinished, 600);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: "radial-gradient(ellipse at 50% 40%, #1c0f4a 0%, #0a0820 50%, #020108 100%)" }}
    >
      {/* Logo */}
      <img
        src="/Moltee_Log.png"
        alt="Moltee"
        className="w-24 h-24 mb-6 animate-pulse"
      />

      {/* Title */}
      <h1
        className="font-pixel text-2xl tracking-wider mb-8"
        style={{ color: "#836EF9", textShadow: "0 0 20px #836EF9, 0 0 40px #836EF966" }}
      >
        MOLTEEE
      </h1>

      {/* Progress bar */}
      <div className="w-64 h-2 rounded-full overflow-hidden" style={{ background: "#1a1040" }}>
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #836EF9, #00F0FF)",
            boxShadow: "0 0 10px #836EF9, 0 0 20px #00F0FF66",
          }}
        />
      </div>

      {/* Loading text */}
      <p className="font-pixel text-[10px] tracking-[0.3em] mt-4" style={{ color: "#00F0FF" }}>
        {progress < 100 ? "LOADING..." : "READY"}
      </p>
    </div>
  );
}
