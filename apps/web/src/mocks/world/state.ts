import type { FieldLayout, InventoryEntry, PlacedObject, WorldState } from "@mooshala/api-client";
import { CATALOG, catalogItem } from "@/lib/world/catalog";
import { FIELD_GEOMETRY, FIELD_IDS, FIELD_UNLOCK_XP, type FieldId } from "@/lib/world/fields";
import { layoutProblem } from "@/lib/world/placement";
import { onFakeDbReset, registerFakeStore } from "../fake-db";
import { gameUser, gems } from "../game/state";
import { learner } from "../learning/state";

/**
 * MOCK ONLY: farm worlds. Gems are spent through the game ledger so the
 * balance is one number everywhere. Each field keeps its own layout with a
 * version number (a stale save gets LAYOUT_CONFLICT instead of overwriting).
 */
interface WorldUser {
  owned: Record<string, number>;
  layouts: Partial<Record<FieldId, { version: number; objects: PlacedObject[] }>>;
  celebrated: FieldId[];
}

let users: Map<string, WorldUser>;
const blank = (): WorldUser => ({ owned: {}, layouts: {}, celebrated: ["starter-meadow"] });

onFakeDbReset(() => {
  users = new Map();
  const asha = blank();
  // Asha already owns a bench and a flower bed, one of each placed by the pond.
  asha.owned = { "garden-bench": 1, "flower-bed": 2, "flower-pot": 1 };
  asha.layouts["starter-meadow"] = {
    version: 1,
    objects: [
      { uid: "seed-1", item_id: "garden-bench", x: -7, z: 13, rotation: 2.4 },
      { uid: "seed-2", item_id: "flower-bed", x: -9, z: 15, rotation: 0 },
    ],
  };
  users.set("u-asha", asha);
});
registerFakeStore("world", () => users, (v) => (users = v));

export function worldUser(userId: string): WorldUser {
  let w = users.get(userId);
  if (!w) {
    w = blank();
    users.set(userId, w);
  }
  return w;
}

const unlocked = (userId: string, f: FieldId) => learner(userId).xpTotal >= FIELD_UNLOCK_XP[f];

export function worldState(userId: string): WorldState {
  const w = worldUser(userId);
  return {
    xp_total: learner(userId).xpTotal,
    gems: gems(gameUser(userId)),
    fields: FIELD_IDS.map((id, order) => ({
      id,
      order,
      unlock_xp: FIELD_UNLOCK_XP[id],
      unlocked: unlocked(userId, id),
      celebrated: w.celebrated.includes(id),
      placed_count: w.layouts[id]?.objects.length ?? 0,
    })),
  };
}

export function celebrate(userId: string, f: FieldId): "FIELD_LOCKED" | null {
  if (!unlocked(userId, f)) return "FIELD_LOCKED";
  const w = worldUser(userId);
  if (!w.celebrated.includes(f)) w.celebrated.push(f);
  return null;
}

export function inventory(userId: string): InventoryEntry[] {
  const w = worldUser(userId);
  return Object.entries(w.owned)
    .filter(([, n]) => n > 0)
    .map(([item_id, owned]) => {
      const placed: Record<string, number> = {};
      for (const f of FIELD_IDS) {
        const n = w.layouts[f]?.objects.filter((o) => o.item_id === item_id).length ?? 0;
        if (n) placed[f] = n;
      }
      return { item_id, owned, placed };
    });
}

export function store(userId: string) {
  const w = worldUser(userId);
  return CATALOG.map((i) => ({ ...i, owned: w.owned[i.id] ?? 0 }));
}

export function purchase(userId: string, itemId: string): { error: "NOT_FOUND" | "NOT_ENOUGH_GEMS" } | { item_id: string; owned: number; gems: number } {
  const item = catalogItem(itemId);
  if (!item) return { error: "NOT_FOUND" };
  const g = gameUser(userId);
  if (gems(g) < item.price) return { error: "NOT_ENOUGH_GEMS" };
  g.ledger.push({ key: `world:${itemId}:${g.ledger.length}`, amount: -item.price, at: Date.now() });
  const w = worldUser(userId);
  w.owned[itemId] = (w.owned[itemId] ?? 0) + 1;
  return { item_id: itemId, owned: w.owned[itemId]!, gems: gems(g) };
}

export function layout(userId: string, f: FieldId): FieldLayout {
  const l = worldUser(userId).layouts[f];
  return { field_id: f, version: l?.version ?? 0, objects: l?.objects ?? [] };
}

export function saveLayout(userId: string, f: FieldId, version: number, objects: PlacedObject[]): { error: string } | FieldLayout {
  if (!unlocked(userId, f)) return { error: "FIELD_LOCKED" };
  const w = worldUser(userId);
  const cur = w.layouts[f];
  if ((cur?.version ?? 0) !== version) return { error: "LAYOUT_CONFLICT" };
  // What may be placed here: owned minus what other fields use.
  const available: Record<string, number> = {};
  for (const [id, n] of Object.entries(w.owned)) {
    const elsewhere = FIELD_IDS.filter((o) => o !== f).reduce((s, o) => s + (w.layouts[o]?.objects.filter((x) => x.item_id === id).length ?? 0), 0);
    available[id] = n - elsewhere;
  }
  const clean = objects.map((o) => ({ uid: String(o.uid), item_id: String(o.item_id), x: Number(o.x), z: Number(o.z), rotation: Number(o.rotation) || 0 }));
  const bad = layoutProblem(FIELD_GEOMETRY[f], clean, available);
  if (bad) return { error: bad };
  w.layouts[f] = { version: version + 1, objects: clean };
  return { field_id: f, version: version + 1, objects: clean };
}
