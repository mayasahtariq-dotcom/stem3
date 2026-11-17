/**
 * Pure field geometry (no three.js): the ground height, what the ground is
 * made of, and where things may stand. Shared by the terrain mesh, the props,
 * the placement editor and the fake backend's checks, so all agree.
 */

export type Ground = "grass" | "meadow" | "path" | "soil" | "sand" | "stone" | "water" | "snow";

export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Pad extends Circle {
  /** Height the pad is levelled to. */
  h: number;
}
export interface Water extends Circle {
  depth: number;
}
export interface Plot {
  x: number;
  z: number;
  w: number;
  d: number;
  /** Raised bed height. */
  h: number;
}
export interface Path {
  points: [number, number][];
  width: number;
  /** Stone paving instead of dirt. */
  stone?: boolean;
}
export interface Ridge {
  /** Mountain peaks behind the farm: centre, radius, height. */
  x: number;
  z: number;
  r: number;
  h: number;
}
export interface Stream {
  points: [number, number][];
  width: number;
  depth: number;
}

export interface FieldGeometry {
  /** Terrain square side (m). */
  size: number;
  seed: number;
  /** Rolling hills inside the farm (m). */
  rolling: number;
  /** Hills rise beyond this radius. */
  valleyRadius: number;
  rimHeight: number;
  /** Where students may place objects (circle from the origin). */
  buildRadius: number;
  /** Base ground height of the farm area. */
  baseHeight?: number;
  pads: Pad[];
  water: Water[];
  plots: Plot[];
  paths: Path[];
  ridges: Ridge[];
  streams: Stream[];
  /** Fixed structures nothing may overlap. */
  blocked: (Circle & { id: string })[];
  /** Ground palette tweak: "meadow" patches show as flowers/lighter grass. */
  meadowAmount: number;
  /** Snow caps above this height (mountains only). */
  snowLine?: number;
}

const hash = (x: number, z: number, s: number) => {
  const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function noise(x: number, z: number, seed = 0): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}

/** Fractal noise in roughly [-0.5, 0.5]. */
export function fbm(x: number, z: number, seed = 0, octaves = 4): number {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += (noise(x * f, z * f, seed + i * 13) - 0.5) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return v / norm;
}

/** Distance from a point to a polyline, and how far along it (0..1). */
export function distToPolyline(x: number, z: number, pts: [number, number][]): { d: number; t: number } {
  let best = Infinity, bestT = 0, total = 0;
  const lens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    lens.push(Math.hypot(bx - ax, bz - az));
  }
  const sum = lens.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const u = clamp01(((x - ax) * dx + (z - az) * dz) / l2);
    const d = Math.hypot(x - (ax + u * dx), z - (az + u * dz));
    if (d < best) {
      best = d;
      bestT = (total + u * lens[i]!) / sum;
    }
    total += lens[i]!;
  }
  return { d: best, t: bestT };
}

/** Ground height at (x, z) before water and pads. */
function landHeight(g: FieldGeometry, x: number, z: number): number {
  const r = Math.hypot(x, z);
  const base = g.baseHeight ?? 0;
  const rolling = fbm(x * 0.045, z * 0.045, g.seed) * g.rolling + fbm(x * 0.14, z * 0.14, g.seed + 5, 2) * g.rolling * 0.25;
  const rise = smooth(clamp01((r - g.valleyRadius) / 26));
  const hills = (fbm(x * 0.025, z * 0.025, g.seed + 9) + 0.6) * g.rimHeight * rise + rise * rise * g.rimHeight * 0.6;
  let mountains = 0;
  for (const m of g.ridges) {
    const d = Math.hypot(x - m.x, z - m.z) / m.r;
    if (d < 1) {
      const k = smooth(1 - d);
      mountains = Math.max(mountains, m.h * k * (0.82 + 0.35 * fbm(x * 0.08, z * 0.08, g.seed + 21, 3)));
    }
  }
  return base + rolling + hills + mountains;
}

export function heightAt(g: FieldGeometry, x: number, z: number): number {
  let h = landHeight(g, x, z);
  // Levelled pads under buildings blend smoothly into the land around them.
  for (const p of g.pads) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r * 1.8) {
      const k = d < p.r ? 1 : smooth(1 - (d - p.r) / (p.r * 0.8));
      h = h + (p.h - h) * k;
    }
  }
  // Paths are slightly sunken into the grass.
  for (const p of g.paths) {
    const { d } = distToPolyline(x, z, p.points);
    if (d < p.width) h -= 0.08 * smooth(1 - d / p.width);
  }
  for (const s of g.streams) {
    const { d } = distToPolyline(x, z, s.points);
    if (d < s.width * 1.6) h -= s.depth * smooth(1 - Math.min(1, d / (s.width * 1.6)));
  }
  for (const w of g.water) {
    const d = Math.hypot(x - w.x, z - w.z) / w.r;
    if (d < 1.35) h -= w.depth * smooth(clamp01((1.35 - d) / 1.35));
  }
  for (const p of g.plots) {
    if (Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2) h += p.h;
  }
  return h;
}

/** Water surface height for a pond (just below the bank). */
export function waterLevel(g: FieldGeometry, w: Water): number {
  return landHeight(g, w.x + w.r * 1.4, w.z) - w.depth * 0.38;
}

export function slopeAt(g: FieldGeometry, x: number, z: number): number {
  const e = 0.6;
  const dx = heightAt(g, x + e, z) - heightAt(g, x - e, z);
  const dz = heightAt(g, x, z + e) - heightAt(g, x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

export function inWater(g: FieldGeometry, x: number, z: number, margin = 0): boolean {
  if (g.water.some((w) => Math.hypot(x - w.x, z - w.z) < w.r + margin)) return true;
  return g.streams.some((s) => distToPolyline(x, z, s.points).d < s.width * 0.75 + margin);
}

export function onPath(g: FieldGeometry, x: number, z: number, margin = 0): boolean {
  return g.paths.some((p) => distToPolyline(x, z, p.points).d < p.width / 2 + margin);
}

export function groundAt(g: FieldGeometry, x: number, z: number): Ground {
  if (inWater(g, x, z)) return "water";
  for (const p of g.plots) if (Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2) return "soil";
  for (const p of g.paths) if (distToPolyline(x, z, p.points).d < p.width / 2) return p.stone ? "stone" : "path";
  const h = heightAt(g, x, z);
  if (g.snowLine !== undefined && h > g.snowLine) return "snow";
  if (slopeAt(g, x, z) > 0.9) return "stone";
  if (g.water.some((w) => Math.hypot(x - w.x, z - w.z) < w.r + 1.6) || inWater(g, x, z, 1.2)) return "sand";
  return noise(x * 0.16, z * 0.16, g.seed + 3) > 1 - g.meadowAmount ? "meadow" : "grass";
}
