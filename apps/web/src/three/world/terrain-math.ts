/**
 * Pure terrain functions (no three.js), shared by the terrain mesh and by
 * object placement so props sit exactly on the ground. Unit-tested.
 */

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);

/** 2D value noise in [0, 1]. */
export function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}

export const TERRAIN_SIZE = 160;
/** The farmstead stays flat inside this radius so buildings sit level. */
export const FLAT_RADIUS = 16;
export const POND = { x: -13, z: 11, radius: 6, depth: 1.6 } as const;
export const FIELD = { x: 11, z: -7, width: 12, depth: 9 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Ground height at (x, z). */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hills =
    (valueNoise(x * 0.035, z * 0.035) - 0.5) * 9 + (valueNoise(x * 0.09 + 7, z * 0.09 - 3) - 0.5) * 2.4;
  // 0 inside the farmstead, ramping to full hills by r = FLAT_RADIUS + 22.
  const rise = smooth(clamp01((r - FLAT_RADIUS) / 22));
  const bowl = Math.max(0, hills) * rise + rise * rise * 3; // raised rim of hills around the valley
  const pondD = Math.hypot(x - POND.x, z - POND.z) / POND.radius;
  const pond = pondD < 1 ? -POND.depth * smooth(1 - pondD) : 0;
  return bowl + pond;
}

export type GroundKind = "grass" | "meadow" | "path" | "soil" | "sand";

/** What the ground looks like at (x, z): drives vertex colours. */
export function groundKind(x: number, z: number): GroundKind {
  if (Math.abs(x - FIELD.x) < FIELD.width / 2 && Math.abs(z - FIELD.z) < FIELD.depth / 2) return "soil";
  const pondD = Math.hypot(x - POND.x, z - POND.z);
  if (pondD < POND.radius + 1.2 && pondD > POND.radius - 0.6) return "sand";
  // Dirt path winding from the barn door (0, 4) towards the south edge.
  const pathX = Math.sin(z * 0.12) * 2.5;
  if (z > 3 && z < 60 && Math.abs(x - pathX) < 1.4) return "path";
  return valueNoise(x * 0.18, z * 0.18) > 0.62 ? "meadow" : "grass";
}
