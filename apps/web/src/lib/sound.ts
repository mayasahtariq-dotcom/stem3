"use client";
import { useSession } from "./session";

// Short synthesized sounds (no files to download on slow links). Never played before a user gesture:
// they only fire after the learner taps Check or finishes a lesson.
let ctx: AudioContext | null = null;
export function playSound(kind: "correct" | "wrong" | "finish" | "pot") {
  if (!useSession.getState().sound) return;
  try {
    ctx ??= new AudioContext();
    const notes = { correct: [660, 880], wrong: [300, 220], finish: [523, 659, 784, 1046], pot: [784, 988, 1175] }[kind];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = kind === "wrong" ? "triangle" : "sine"; o.frequency.value = f;
      const t0 = ctx!.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(ctx!.destination); o.start(t0); o.stop(t0 + 0.2);
    });
  } catch { /* audio unavailable */ }
}
