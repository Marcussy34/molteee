import { useState, useCallback, useEffect } from "react";
import { setMuted as setSoundMuted, isMuted, initMuted } from "@/lib/sound";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    initMuted();
    setMuted(isMuted());
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      setSoundMuted(!prev);
      return !prev;
    });
  }, []);

  return (
    <button
      onClick={toggleMute}
      className="fixed bottom-4 right-4 z-50 rounded border border-monad-purple/30 bg-monad-deeper/80 px-3 py-1.5 font-pixel text-[8px] text-text-dim backdrop-blur-sm transition-colors hover:text-monad-purple hover:border-monad-purple/50"
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? "SOUND OFF" : "SOUND ON"}
    </button>
  );
}
