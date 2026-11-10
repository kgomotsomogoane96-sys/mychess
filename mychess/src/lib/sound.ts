let context: AudioContext | null = null;
export function playMoveSound(kind: "move" | "capture" | "success" | "error" = "move") {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    const ctx = context;
    if (ctx.state === "suspended") void ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = kind === "error" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(kind === "success" ? 660 : kind === "error" ? 180 : kind === "capture" ? 260 : 420, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === "success" ? 880 : 120, ctx.currentTime + .09);
    gain.gain.setValueAtTime(.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .12);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + .13);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Sound is optional when a browser blocks audio. */ }
}
