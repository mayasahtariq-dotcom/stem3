import type { Transition, Variants } from "motion/react";
import { motion as t } from "@mooshala/tokens";

/**
 * Shared motion presets (web PRD section 6: correct pops, "Not quite" shakes
 * gently, XP floats up, the flame flickers, lessons end in confetti). Each has a
 * reduced-motion twin that only fades.
 */
const s = (ms: number) => ms / 1000;
const spring: Transition = { type: "spring", stiffness: 520, damping: 22 };

export const presets = {
  pop: { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: spring },
  shake: { animate: { x: [0, -6, 6, -6, 6, 0] }, transition: { duration: s(t.slow) } },
  float: { initial: { y: 0, opacity: 1 }, animate: { y: -36, opacity: 0 }, transition: { duration: s(t.celebrate), ease: "easeOut" } },
  flicker: { animate: { scale: [1, 1.08, 1], rotate: [0, -3, 0] }, transition: { duration: 1.6, repeat: Infinity } },
  confetti: { initial: { y: -20, opacity: 0, rotate: 0 }, animate: { y: 220, opacity: [0, 1, 1, 0], rotate: 540 }, transition: { duration: 1.4, ease: "easeIn" } },
} as const;

export type PresetName = keyof typeof presets;

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: s(t.base) } } as const;

/** Picks a preset, or a plain fade when the user prefers reduced motion. */
export function motionPreset(name: PresetName, reduced: boolean) {
  return reduced ? fade : presets[name];
}

export const screenVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: s(t.base), ease: [0.22, 1, 0.36, 1] } },
};
