/**
 * 3D models for the farm worlds: CC0 packs by Quaternius and Kenney,
 * converted to web GLB by scripts/world-assets (see public/models/world/CREDITS.md).
 * `h` is the real-world height (m) the model is scaled to.
 */
export interface ModelSpec {
  file: string;
  h: number;
  /** Animals get a procedural walk / graze cycle. */
  animal?: boolean;
  /** Leaves and grass sway in the wind. */
  sway?: number;
  /** Re-colour leaf cards (e.g. pink blossom). */
  leafTint?: [number, number, number];
  /** Keep the file's own size instead of scaling to `h`. */
  native?: boolean;
  /** Colour for untextured white materials. */
  tint?: string;
}

const m = (file: string, h: number, extra: Partial<ModelSpec> = {}): ModelSpec => ({ file: `/models/world/${file}.glb`, h, ...extra });

const BASE = {
  // Buildings
  barn: m("barn", 7.2),
  "barn-big": m("barn-big", 9),
  "barn-small": m("barn-small", 5.6),
  "barn-open": m("barn-open", 5),
  "chicken-coop": m("chicken-coop", 2.4),
  silo: m("silo", 10),
  "silo-house": m("silo-house", 10),
  windmill: m("windmill-tower", 12),
  "windmill-frame": m("windmill", 11),
  "water-tower": m("water-tower", 9),
  well: m("well", 2.4),
  "house-1": m("house-1", 7.5),
  "house-2": m("house-2", 6.5),
  fence: m("fence", 1.1),
  "fence-2": m("fence-2", 1.15),
  // Animals
  cow: m("cow", 1.55, { animal: true }),
  "cow-brown": m("cow-brown", 1.55, { animal: true }),
  bull: m("bull", 1.65, { animal: true }),
  horse: m("horse", 1.8, { animal: true }),
  "horse-white": m("horse-white", 1.8, { animal: true }),
  donkey: m("donkey", 1.35, { animal: true }),
  alpaca: m("alpaca", 1.7, { animal: true }),
  llama: m("llama", 1.9, { animal: true }),
  sheep: m("sheep", 1.05, { animal: true }),
  pig: m("pig", 0.85, { animal: true }),
  deer: m("deer", 1.5, { animal: true }),
  stag: m("stag", 1.9, { animal: true }),
  fox: m("fox", 0.55, { animal: true }),
  dog: m("dog", 0.7, { animal: true }),
  // Props
  bench: m("bench", 0.55),
  "k-bench": m("k-h-bench", 0.95),
  barrel: m("barrel", 0.9),
  "barrel-apples": m("barrel-apples", 0.95),
  crate: m("crate", 0.8),
  "crate-apple": m("crate-apple", 0.3),
  "crate-carrot": m("crate-carrot", 0.42),
  stall: m("stall", 2.6),
  cart: m("cart", 2.4),
  bucket: m("bucket", 0.3),
  table: m("table", 0.8),
  workbench: m("workbench", 0.9),
  lantern: m("k-lantern", 2.6),
  "fountain-k": m("k-fountain-round-detail", 1.6),
  "pot-large": m("k-pot-large", 0.8),
  obelisk: m("k-statue-obelisk", 2.2),
  "hay-bale": m("k-hay-bale", 1.1),
  "hay-bundle": m("k-hay-bale-bundled", 1),
  signpost: m("k-s-signpost", 1.6),
  "log-stack": m("k-log-stack", 0.9),
  "log-large": m("k-log-large", 0.9),
  stump: m("k-stump-round", 0.5),
  tent: m("k-tent-detailedopen", 2.4),
  campfire: m("k-campfire-stones", 0.5),
  canoe: m("k-canoe", 0.5),
  bridge: m("k-bridge-woodround", 1.6),
  "fence-gate-k": m("k-fence-gate", 1.4),
  hedge: m("k-hedge", 1.2),
  "hedge-large": m("k-hedge-large", 1.6),
  "lily-large": m("k-lily-large", 0.05),
  "lily-small": m("k-lily-small", 0.05),
  "cliff-waterfall": m("k-cliff-waterfall-rock", 10),
  "cliff-waterfall-top": m("k-cliff-waterfalltop-rock", 10),
  "cliff-large": m("k-cliff-large-rock", 12),
  // Nature
  "tree-1": m("tree-1", 7, { sway: 0.06 }),
  "tree-2": m("tree-2", 7.5, { sway: 0.06 }),
  "tree-3": m("tree-3", 9, { sway: 0.05 }),
  "tree-4": m("tree-4", 9, { sway: 0.05 }),
  "tree-5": m("tree-5", 6.5, { sway: 0.06 }),
  "pine-1": m("pine-1", 8, { sway: 0.03 }),
  "pine-2": m("pine-2", 8.5, { sway: 0.03 }),
  "pine-3": m("pine-3", 7.5, { sway: 0.03 }),
  "pine-4": m("pine-4", 11, { sway: 0.03 }),
  "pine-5": m("pine-5", 9.5, { sway: 0.03 }),
  "twisted-1": m("twisted-1", 8, { sway: 0.05 }),
  "twisted-2": m("twisted-2", 9, { sway: 0.05 }),
  "twisted-3": m("twisted-3", 8, { sway: 0.05 }),
  "blossom-1": m("tree-1", 6.5, { sway: 0.06, leafTint: [0.95, 0.55, 0.72] }),
  "blossom-2": m("tree-5", 6, { sway: 0.06, leafTint: [0.98, 0.68, 0.82] }),
  "autumn-1": m("tree-2", 7, { sway: 0.06, leafTint: [0.95, 0.55, 0.15] }),
  "golden-1": m("tree-5", 6.5, { sway: 0.06, leafTint: [0.85, 0.72, 0.2] }),
  "dead-tree": m("dead-tree", 7),
  bush: m("bush", 1.3, { sway: 0.04, tint: "#4f8f2f" }),
  "bush-flowers": m("bush-flowers", 1.3, { sway: 0.04 }),
  fern: m("fern", 0.9, { sway: 0.06 }),
  "flowers-a": m("flowers-a", 0.55, { sway: 0.08 }),
  "flowers-b": m("flowers-b", 0.65, { sway: 0.08 }),
  "flower-a": m("flower-a", 0.5, { sway: 0.08 }),
  "flower-b": m("flower-b", 0.6, { sway: 0.08 }),
  "grass-short": m("grass-short", 0.35, { sway: 0.1 }),
  "grass-tall": m("grass-tall", 0.6, { sway: 0.1 }),
  "grass-wispy": m("grass-wispy", 0.55, { sway: 0.1 }),
  clover: m("clover", 0.25, { sway: 0.05 }),
  mushroom: m("mushroom", 0.25),
  "mushroom-red": m("k-mushroom-redgroup", 0.35),
  "plant-big": m("plant-big", 1.2, { sway: 0.06 }),
  "rock-1": m("rock-1", 1.4),
  "rock-2": m("rock-2", 1.1),
  "rock-3": m("rock-3", 1.6),
  "rock-tall": m("k-rock-talla", 3),
  "pebble-1": m("pebble-1", 0.12),
  "pebble-2": m("pebble-2", 0.12),
  "pebble-3": m("pebble-3", 0.12),
  "path-stone-1": m("path-stone-1", 0.1),
  "path-stone-2": m("path-stone-2", 0.1),
  "path-stone-3": m("path-stone-3", 0.1),
} satisfies Record<string, ModelSpec>;

export const CROPS = ["wheat", "corn", "carrot", "pumpkin", "lettuce", "tomato", "watermelon", "beet", "bushberries", "apple", "orange", "rice"] as const;
export type CropId = `crop-${(typeof CROPS)[number]}-${1 | 2 | 3 | 4}`;
export type ModelId = keyof typeof BASE | CropId;

/** Crops (growth stages 1..4) keep the pack's own size. */
export const MODELS: Record<ModelId, ModelSpec> = {
  ...BASE,
  ...(Object.fromEntries(CROPS.flatMap((c) => [1, 2, 3, 4].map((s) => [`crop-${c}-${s}`, m(`crop-${c}-${s}`, 1, { sway: 0.06, native: true })]))) as Record<CropId, ModelSpec>),
};
