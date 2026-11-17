import { catalogItem } from "./catalog";
import { groundAt, heightAt, onPath, slopeAt, type FieldGeometry } from "./geometry";

export interface PlacedObject {
  /** Stable id of this placed copy. */
  uid: string;
  item_id: string;
  x: number;
  z: number;
  /** Radians around the vertical axis. */
  rotation: number;
}

export type PlacementProblem = "outside" | "water" | "path" | "steep" | "structure" | "overlap" | "unknown";

const MAX_SLOPE = 0.55;

/**
 * Can this object stand here? Objects always sit on the ground (the scene
 * reads heightAt), so floating or buried objects can't happen; this checks
 * the spot itself. Fences, paths stones and gates may touch each other so
 * students can build lines of them.
 */
export function placementProblem(g: FieldGeometry, obj: Pick<PlacedObject, "uid" | "item_id" | "x" | "z">, others: PlacedObject[]): PlacementProblem | null {
  const item = catalogItem(obj.item_id);
  if (!item) return "unknown";
  const r = item.radius;
  if (!Number.isFinite(obj.x) || !Number.isFinite(obj.z) || Math.hypot(obj.x, obj.z) + r > g.buildRadius) return "outside";
  // Sample the footprint centre and rim.
  const samples: [number, number][] = [[obj.x, obj.z]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    samples.push([obj.x + Math.cos(a) * r * 0.8, obj.z + Math.sin(a) * r * 0.8]);
  }
  if (samples.some(([x, z]) => groundAt(g, x, z) === "water")) return "water";
  if (item.id !== "stone-path" && item.id !== "gate" && onPath(g, obj.x, obj.z, Math.max(0, r * 0.6 - 0.3))) return "path";
  const hs = samples.map(([x, z]) => heightAt(g, x, z));
  if (Math.max(...hs) - Math.min(...hs) > Math.max(0.6, r * 0.7) || slopeAt(g, obj.x, obj.z) > MAX_SLOPE) return "steep";
  if (g.blocked.some((b) => Math.hypot(obj.x - b.x, obj.z - b.z) < b.r + r * 0.85)) return "structure";
  const linear = (id: string) => id === "fence" || id === "hedge" || id === "stone-path";
  for (const o of others) {
    if (o.uid === obj.uid) continue;
    const oi = catalogItem(o.item_id);
    if (!oi) continue;
    const gap = Math.hypot(obj.x - o.x, obj.z - o.z);
    const min = linear(item.id) && linear(oi.id) ? (oi.radius + r) * 0.45 : (oi.radius + r) * 0.8;
    if (gap < min) return "overlap";
  }
  return null;
}

/** Server-side layout check: known items, counts within what is owned, every spot valid. */
export function layoutProblem(g: FieldGeometry, objects: PlacedObject[], available: Record<string, number>): string | null {
  const uids = new Set<string>();
  const used: Record<string, number> = {};
  for (const o of objects) {
    if (uids.has(o.uid)) return "DUPLICATE_OBJECT";
    uids.add(o.uid);
    if (!catalogItem(o.item_id)) return "UNKNOWN_ITEM";
    used[o.item_id] = (used[o.item_id] ?? 0) + 1;
    if (used[o.item_id]! > (available[o.item_id] ?? 0)) return "NOT_OWNED";
    if (placementProblem(g, o, objects)) return "INVALID_PLACEMENT";
  }
  return null;
}

/** The nearest free spot to (x, z) where this item fits, searching outwards in a spiral. */
export function findSpot(g: FieldGeometry, itemId: string, others: PlacedObject[], x: number, z: number): { x: number; z: number } | null {
  for (let ring = 0; ring < 26; ring++) {
    const n = ring === 0 ? 1 : ring * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = { uid: "__probe", item_id: itemId, x: x + Math.cos(a) * ring * 1.2, z: z + Math.sin(a) * ring * 1.2 };
      if (!placementProblem(g, p, others)) return { x: p.x, z: p.z };
    }
  }
  return null;
}

/** How many of an item can still be placed: owned, minus what stands in other fields and in this layout. */
export function availableToPlace(owned: number, placedElsewhere: number, inLayout: number): number {
  return Math.max(0, owned - placedElsewhere - inLayout);
}
