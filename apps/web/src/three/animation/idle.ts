/**
 * Idle animation curves for the farm (pure functions of time, unit-tested).
 * Scene components call these from useFrame; with reduced motion they are
 * evaluated once at t = 0 so everything rests in a natural pose.
 */

/** Eyelid scale: 1 open, 0 closed. A quick blink every `period` seconds, offset per animal. */
export function blink(t: number, period = 4.2, offset = 0): number {
  const p = (((t + offset) % period) + period) % period;
  if (p > 0.16) return 1;
  return Math.abs(Math.cos((p / 0.16) * Math.PI));
}

/** Tail swing angle in radians: a lazy swish with a short pause. */
export function tailSwing(t: number, offset = 0): number {
  const s = Math.sin((t + offset) * 2.4);
  return 0.45 * s * Math.abs(s);
}

/** Grazing: the head dips to the grass now and then (0 up, 1 down). */
export function graze(t: number, offset = 0): number {
  const p = ((t + offset) % 9) / 9;
  return p < 0.55 ? 0 : Math.sin(((p - 0.55) / 0.45) * Math.PI);
}

/** Gentle sway for grass, bushes and trees (radians). */
export function sway(t: number, x: number, z: number, strength = 0.04): number {
  return Math.sin(t * 1.3 + x * 0.35 + z * 0.21) * strength;
}

/** A point on a butterfly's looping flight around its home. */
export function butterflyPath(t: number, seed: number, radius = 2.2): [number, number, number] {
  const a = t * (0.6 + (seed % 3) * 0.15) + seed;
  return [Math.cos(a) * radius + Math.sin(a * 2.3) * 0.6, 1.2 + Math.sin(a * 3.1) * 0.35, Math.sin(a) * radius * 0.7];
}

/** Wing flap angle. */
export const flap = (t: number, seed: number) => Math.sin(t * 18 + seed) * 0.9;

/** Clouds drift east and wrap around the sky. */
export function cloudX(t: number, startX: number, speed: number, span = 160): number {
  return ((((startX + t * speed + span / 2) % span) + span) % span) - span / 2;
}

/** Bounce for the current lesson marker (0..1). */
export const bounce = (t: number) => Math.abs(Math.sin(t * 2.2));

/**
 * A butterfly's flight across the whole farm: a wide, slow Lissajous loop
 * with a bobbing height, so it wanders between the pond, barn and field.
 * Returns position offsets and the heading (radians, for rotation.y).
 */
export function wanderPath(t: number, seed: number, spanX = 16, spanZ = 12): { x: number; y: number; z: number; heading: number } {
  const w1 = 0.11 + (seed % 5) * 0.017;
  const w2 = 0.083 + (seed % 3) * 0.021;
  const p = seed * 1.91;
  const x = Math.sin(t * w1 + p) * spanX + Math.sin(t * w1 * 3.7 + p) * 1.6;
  const z = Math.sin(t * w2 + p * 1.3) * spanZ + Math.cos(t * w2 * 2.9 + p) * 1.4;
  const y = 1.6 + Math.sin(t * 0.9 + p) * 0.6 + Math.sin(t * 2.3 + p) * 0.25;
  const vx = Math.cos(t * w1 + p) * spanX * w1 + Math.cos(t * w1 * 3.7 + p) * 1.6 * w1 * 3.7;
  const vz = Math.cos(t * w2 + p * 1.3) * spanZ * w2 - Math.sin(t * w2 * 2.9 + p) * 1.4 * w2 * 2.9;
  return { x, y, z, heading: Math.atan2(vx, vz) };
}

/**
 * A soap bubble drifting up from the meadow: rises at its own speed, sways,
 * and starts again near the grass after `height` metres (never stops, no state).
 */
export function bubbleAt(t: number, seed: number, height = 16): { x: number; y: number; z: number; scale: number } {
  const speed = 0.35 + (seed % 4) * 0.08;
  const cycle = (t * speed + seed * 3.3) % height;
  const loop = Math.floor((t * speed + seed * 3.3) / height);
  const angle = seed * 2.4 + loop * 1.7;
  const radius = 4 + ((seed * 7 + loop * 5) % 14);
  return {
    // Centred behind Golu over the farmstead, so none float into the camera.
    x: -2 + Math.cos(angle) * radius + Math.sin(t * 0.7 + seed) * 0.8,
    y: 0.8 + cycle,
    z: -2 + Math.sin(angle) * radius * 0.8 + Math.cos(t * 0.55 + seed) * 0.8,
    // Pops in at the bottom and fades out near the top.
    scale: Math.min(1, cycle / 1.2) * Math.min(1, (height - cycle) / 1.5),
  };
}
