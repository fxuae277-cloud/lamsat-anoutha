/**
 * scannerBeep.ts — Web Audio feedback for the barcode scanner.
 * Lazily creates a single AudioContext on first user interaction so we
 * don't trigger the browser's autoplay block at page load.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor() as AudioContext; } catch { return null; }
  }
  const c = ctx;
  if (c && c.state === "suspended") {
    void c.resume().catch(() => {});
  }
  return c;
}

function tone(freq: number, durationMs: number, type: OscillatorType = "square") {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Short attack/release envelope to avoid clicks.
  const now = ac.currentTime;
  const dur = durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
  gain.gain.linearRampToValueAtTime(0.18, now + Math.max(0.01, dur - 0.01));
  gain.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function beepSuccess() { tone(800, 80, "square"); }
export function beepError()   { tone(400, 200, "sawtooth"); }
