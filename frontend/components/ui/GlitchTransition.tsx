import { useRouter } from "next/router";
import { useState, useEffect } from "react";

/** Brief glitch flash on page transitions */
export function GlitchTransition() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onStart() {
      setVisible(true);
    }
    function onEnd() {
      setTimeout(() => setVisible(false), 150);
    }

    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onEnd);
    router.events.on("routeChangeError", onEnd);

    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onEnd);
      router.events.off("routeChangeError", onEnd);
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none"
      style={{
        background: "linear-gradient(180deg, transparent 48%, #836EF944 50%, transparent 52%)",
        animation: "glitch-flash 0.15s linear",
      }}
    >
      <style jsx>{`
        @keyframes glitch-flash {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
