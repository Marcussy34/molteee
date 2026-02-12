// Lightweight chiptune sound system using Web Audio API
// No external dependencies needed

let audioCtx: AudioContext | null = null;
let _muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.08
) {
  if (_muted || typeof window === "undefined") return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

/** Play a short burst of white noise (whoosh/impact texture) */
function playNoiseBurst(duration: number, volume: number) {
  if (_muted || typeof window === "undefined") return;
  try {
    const ctx = getCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decay envelope
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch {
    // Audio not available
  }
}

export const sfx = {
  /** Coin insert — descending arpeggio */
  coin() {
    playTone(988, 0.08, "square", 0.06);
    setTimeout(() => playTone(1319, 0.08, "square", 0.06), 80);
    setTimeout(() => playTone(1568, 0.12, "square", 0.06), 160);
  },

  /** Navigation click */
  click() {
    playTone(660, 0.04, "square", 0.04);
  },

  /** Button hover */
  hover() {
    playTone(440, 0.02, "square", 0.02);
  },

  /** Win fanfare — ascending */
  win() {
    playTone(523, 0.1, "square", 0.05);
    setTimeout(() => playTone(659, 0.1, "square", 0.05), 100);
    setTimeout(() => playTone(784, 0.1, "square", 0.05), 200);
    setTimeout(() => playTone(1047, 0.2, "square", 0.06), 300);
  },

  /** Loss — descending wah */
  lose() {
    playTone(440, 0.15, "sawtooth", 0.04);
    setTimeout(() => playTone(370, 0.15, "sawtooth", 0.04), 150);
    setTimeout(() => playTone(311, 0.25, "sawtooth", 0.04), 300);
  },

  /** Page transition glitch */
  glitch() {
    playTone(150, 0.06, "sawtooth", 0.03);
    setTimeout(() => playTone(80, 0.04, "square", 0.03), 40);
  },

  /** Round start beep */
  roundStart() {
    playTone(880, 0.06, "square", 0.04);
  },

  /** Dramatic entrance whoosh — rising frequency sweep */
  entrance() {
    playTone(100, 0.3, "sine", 0.04);
    playTone(200, 0.25, "sine", 0.03);
    setTimeout(() => playTone(400, 0.15, "sine", 0.04), 100);
    setTimeout(() => playTone(800, 0.1, "sine", 0.03), 200);
    playNoiseBurst(0.25, 0.03);
  },

  /** Clash impact — sub-bass thud + high crack */
  clash() {
    playTone(60, 0.3, "sine", 0.08);
    playTone(2000, 0.04, "square", 0.05);
    setTimeout(() => playTone(40, 0.4, "sine", 0.04), 50);
    setTimeout(() => playTone(120, 0.1, "square", 0.03), 80);
  },

  /** Thinking tension — detuned low drone */
  tension() {
    playTone(110, 1.0, "sawtooth", 0.015);
    playTone(113, 1.0, "sawtooth", 0.015);
  },

  /** Victory fanfare — extended ascending arpeggio */
  victoryFanfare() {
    playTone(523, 0.12, "square", 0.05);
    setTimeout(() => playTone(659, 0.12, "square", 0.05), 120);
    setTimeout(() => playTone(784, 0.12, "square", 0.05), 240);
    setTimeout(() => playTone(1047, 0.25, "square", 0.06), 360);
    setTimeout(() => playTone(1319, 0.4, "square", 0.06), 550);
  },

  /** Defeat — extended descending sawtooth */
  defeatSound() {
    playTone(440, 0.15, "sawtooth", 0.04);
    setTimeout(() => playTone(370, 0.15, "sawtooth", 0.04), 150);
    setTimeout(() => playTone(311, 0.2, "sawtooth", 0.04), 300);
    setTimeout(() => playTone(220, 0.4, "sawtooth", 0.03), 500);
  },
};

export function isMuted() {
  return _muted;
}

export function setMuted(muted: boolean) {
  _muted = muted;
  if (typeof window !== "undefined") {
    localStorage.setItem("molteee-muted", muted ? "1" : "0");
  }
}

export function initMuted() {
  if (typeof window !== "undefined") {
    _muted = localStorage.getItem("molteee-muted") === "1";
  }
}
