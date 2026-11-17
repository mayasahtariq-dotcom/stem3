import type { FieldGeometry } from "./geometry";

/**
 * The five farm fields. Each has its own geography (pure data); the 3D scene
 * dresses it with models. Unlock XP comes from the product owner's
 * "Meadow Levels" design (2,000 / 4,000 / 6,000 / 8,000 XP), which matches
 * the PRD's 2,000 and 8,000 XP scene milestones; see docs/decisions.md.
 */
export const FIELD_IDS = ["starter-meadow", "blossom-meadow", "golden-valley", "woodland-farm", "mountain-paradise"] as const;
export type FieldId = (typeof FIELD_IDS)[number];

export const FIELD_UNLOCK_XP: Record<FieldId, number> = {
  "starter-meadow": 0,
  "blossom-meadow": 2000,
  "golden-valley": 4000,
  "woodland-farm": 6000,
  "mountain-paradise": 8000,
};

export const isFieldId = (v: string): v is FieldId => (FIELD_IDS as readonly string[]).includes(v);

const STARTER: FieldGeometry = {
  size: 260,
  seed: 11,
  rolling: 1.6,
  valleyRadius: 34,
  rimHeight: 12,
  buildRadius: 32,
  meadowAmount: 0.35,
  pads: [
    { x: 0, z: -9, r: 7, h: 0.2 }, // barn
    { x: 17, z: -6, r: 6, h: 0.3 }, // farmhouse
    { x: -14, z: -11, r: 4.5, h: 0.2 }, // shed (lab)
    { x: -5, z: -21, r: 5, h: 0.6 }, // windmill
    { x: 13, z: 15, r: 3, h: 0.1 }, // market stall
    { x: 4, z: 19, r: 3, h: 0 }, // Golu
  ],
  water: [{ x: -15, z: 5, r: 6.5, depth: 1.8 }],
  plots: [{ x: 13, z: 4, w: 12, d: 8, h: 0.35 }],
  paths: [
    { points: [[2, 42], [3, 30], [1, 20], [-1, 10], [0, -2.5]], width: 2.6 },
    { points: [[0.5, 4], [8, 1], [14, -1], [16, -2.5]], width: 1.8 },
    { points: [[-0.5, 6], [-7, 2], [-13, -6]], width: 1.6 },
  ],
  ridges: [
    { x: -70, z: -110, r: 55, h: 42 },
    { x: 10, z: -130, r: 60, h: 55 },
    { x: 85, z: -105, r: 50, h: 38 },
  ],
  streams: [],
  blocked: [
    { id: "barn", x: 0, z: -9, r: 6.5 },
    { id: "farmhouse", x: 17, z: -6, r: 5 },
    { id: "lab", x: -14, z: -11, r: 3.6 },
    { id: "windmill", x: -5, z: -21, r: 4 },
    { id: "market", x: 13, z: 15, r: 2.4 },
    { id: "golu", x: 4, z: 19, r: 2 },
    { id: "signboard", x: 4.5, z: 8, r: 1 },
    { id: "field", x: 13, z: 4, r: 0.1 },
  ],
};

const BLOSSOM: FieldGeometry = {
  size: 260,
  seed: 23,
  rolling: 1.1,
  valleyRadius: 38,
  rimHeight: 9,
  buildRadius: 34,
  meadowAmount: 0.6,
  pads: [
    { x: 0, z: -4, r: 6, h: 0.4 }, // fountain plaza
    { x: -16, z: -14, r: 6, h: 0.5 }, // cottage
    { x: 16, z: -14, r: 4, h: 0.4 }, // greenhouse barn
    { x: 18, z: 10, r: 4, h: 0.2 }, // beehives
  ],
  water: [{ x: 14, z: -26, r: 5, depth: 1.4 }],
  plots: [
    { x: -12, z: 6, w: 9, d: 5, h: 0.4 },
    { x: -12, z: 14, w: 9, d: 5, h: 0.4 },
    { x: 8, z: 18, w: 7, d: 5, h: 0.4 },
  ],
  paths: [
    { points: [[0, 42], [0, 24], [0, 3]], width: 2.4, stone: true },
    { points: [[-5, -4], [-10, -9], [-15, -11]], width: 1.8, stone: true },
    { points: [[5, -4], [11, -9], [15, -12]], width: 1.8, stone: true },
    { points: [[4, 2], [12, 6], [17, 9]], width: 1.6 },
  ],
  ridges: [
    { x: -90, z: -95, r: 60, h: 30 },
    { x: 60, z: -120, r: 70, h: 36 },
  ],
  streams: [{ points: [[-60, -30], [-30, -26], [-22, -30], [-8, -32], [10, -28], [14, -26]], width: 2.2, depth: 1.1 }],
  blocked: [
    { id: "fountain", x: 0, z: -4, r: 3.2 },
    { id: "cottage", x: -16, z: -14, r: 4.5 },
    { id: "greenhouse", x: 16, z: -14, r: 3.6 },
    { id: "beehives", x: 18, z: 10, r: 2.6 },
  ],
};

const GOLDEN: FieldGeometry = {
  size: 280,
  seed: 37,
  rolling: 2.4,
  valleyRadius: 42,
  rimHeight: 14,
  buildRadius: 38,
  meadowAmount: 0.15,
  pads: [
    { x: -2, z: -16, r: 8, h: 0.8 }, // big barn
    { x: 12, z: -18, r: 4, h: 1 }, // silos
    { x: -24, z: -24, r: 4, h: 4.2 }, // windmill on the hill
    { x: -30, z: -12, r: 4, h: 3.4 }, // second windmill
    { x: 22, z: 6, r: 4, h: 0.6 }, // farmhouse
  ],
  water: [{ x: 28, z: 24, r: 4, depth: 1.2 }],
  plots: [
    { x: -14, z: 4, w: 14, d: 10, h: 0.3 },
    { x: 4, z: 6, w: 12, d: 10, h: 0.3 },
    { x: -14, z: 18, w: 14, d: 8, h: 0.3 },
    { x: 4, z: 20, w: 12, d: 8, h: 0.3 },
    { x: 24, z: -8, w: 8, d: 8, h: 0.3 },
  ],
  paths: [
    { points: [[-4.5, 44], [-4.5, 11], [-3, -9]], width: 2.6 },
    { points: [[-4.5, 12], [12, 12], [22, 9]], width: 2 },
    { points: [[-4, -6], [-18, -18], [-24, -21]], width: 1.8 },
  ],
  ridges: [
    { x: -40, z: -40, r: 30, h: 10 },
    { x: 0, z: -140, r: 75, h: 48 },
    { x: 100, z: -90, r: 50, h: 34 },
  ],
  streams: [],
  blocked: [
    { id: "barn", x: -2, z: -16, r: 7 },
    { id: "silos", x: 12, z: -18, r: 3.6 },
    { id: "windmill-1", x: -24, z: -24, r: 3.5 },
    { id: "windmill-2", x: -30, z: -12, r: 3.5 },
    { id: "farmhouse", x: 22, z: 6, r: 4 },
  ],
};

const WOODLAND: FieldGeometry = {
  size: 260,
  seed: 41,
  rolling: 2.2,
  valleyRadius: 30,
  rimHeight: 16,
  buildRadius: 28,
  meadowAmount: 0.3,
  pads: [
    { x: 10, z: -12, r: 5, h: 0.8 }, // log cabin
    { x: -12, z: 12, r: 3, h: 0.4 }, // campfire clearing
  ],
  water: [{ x: -10, z: -10, r: 8, depth: 2 }],
  plots: [{ x: 14, z: 8, w: 7, d: 5, h: 0.35 }],
  paths: [
    { points: [[0, 40], [2, 26], [-3, 16], [2, 6], [4, -2], [8, -7]], width: 1.8 },
    { points: [[-3, 16], [-9, 13]], width: 1.4 },
  ],
  ridges: [
    { x: -60, z: -80, r: 50, h: 30 },
    { x: 50, z: -90, r: 60, h: 34 },
  ],
  streams: [{ points: [[-60, 6], [-30, 2], [-17, -5], [-10, -10], [-2, -2], [4, 4], [24, 10], [60, 16]], width: 2.4, depth: 1.2 }],
  blocked: [
    { id: "cabin", x: 10, z: -12, r: 4.5 },
    { id: "campfire", x: -12, z: 12, r: 2 },
    { id: "bridge", x: 3.2, z: 2.6, r: 2.2 },
  ],
};

const MOUNTAIN: FieldGeometry = {
  size: 300,
  seed: 53,
  rolling: 2.8,
  valleyRadius: 26,
  rimHeight: 22,
  buildRadius: 30,
  baseHeight: 0,
  meadowAmount: 0.4,
  snowLine: 34,
  pads: [
    { x: 0, z: 0, r: 9, h: 0.5 }, // lower terrace
    { x: -14, z: -14, r: 7, h: 3.5 }, // middle terrace (barn)
    { x: 14, z: -16, r: 6, h: 6 }, // upper terrace (chalet)
    { x: 20, z: 10, r: 3.5, h: 2.5 }, // viewpoint
  ],
  water: [{ x: -4, z: -26, r: 5, depth: 1.4 }],
  plots: [{ x: -2, z: 8, w: 10, d: 5, h: 0.3 }],
  paths: [
    { points: [[0, 40], [0, 18], [0, 4]], width: 2.2, stone: true },
    { points: [[-3, -3], [-10, -10], [-13, -12]], width: 1.8, stone: true },
    { points: [[4, -3], [10, -10], [13, -13]], width: 1.8, stone: true },
    { points: [[5, 4], [14, 8], [19, 10]], width: 1.4 },
  ],
  ridges: [
    { x: -40, z: -70, r: 45, h: 58 },
    { x: 20, z: -95, r: 55, h: 75 },
    { x: 80, z: -60, r: 45, h: 52 },
    { x: -85, z: -20, r: 40, h: 40 },
  ],
  streams: [{ points: [[-4, -30], [-8, -18], [-22, 0], [-28, 20], [-36, 50]], width: 2, depth: 1 }],
  blocked: [
    { id: "barn", x: -14, z: -14, r: 5.5 },
    { id: "chalet", x: 14, z: -16, r: 4.5 },
    { id: "viewpoint", x: 20, z: 10, r: 2 },
    { id: "waterfall", x: -4, z: -32, r: 5 },
  ],
};

export const FIELD_GEOMETRY: Record<FieldId, FieldGeometry> = {
  "starter-meadow": STARTER,
  "blossom-meadow": BLOSSOM,
  "golden-valley": GOLDEN,
  "woodland-farm": WOODLAND,
  "mountain-paradise": MOUNTAIN,
};

export const fieldsUnlockedAt = (xp: number): FieldId[] => FIELD_IDS.filter((f) => xp >= FIELD_UNLOCK_XP[f]);
export function nextField(xp: number): { id: FieldId; xp: number } | null {
  const f = FIELD_IDS.find((id) => xp < FIELD_UNLOCK_XP[id]);
  return f ? { id: f, xp: FIELD_UNLOCK_XP[f] } : null;
}
