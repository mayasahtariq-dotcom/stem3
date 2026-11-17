/**
 * Farm worlds: fields that unlock with XP, the Farm Store (gems), the
 * inventory and each field's saved layout. Not in the backend yet; the fake
 * backend serves it (apps/web/src/mocks/world). See docs/web/backend-handoff.md.
 */
type Tri = { en: string; hi: string; kn: string };

export interface WorldField {
  id: string;
  order: number;
  unlock_xp: number;
  unlocked: boolean;
  /** The unlock celebration has been shown. */
  celebrated: boolean;
  placed_count: number;
}

/** GET /world */
export interface WorldState {
  xp_total: number;
  gems: number;
  fields: WorldField[];
}

/** GET /world/store */
export interface StoreItem {
  id: string;
  category: "decorations" | "buildings" | "nature" | "animals" | "customisation";
  name: Tri;
  description: Tri;
  price: number;
  model: string;
  radius: number;
  owned: number;
}

/** GET /world/inventory */
export interface InventoryEntry {
  item_id: string;
  owned: number;
  /** Placed in each field. */
  placed: Record<string, number>;
}

export interface PlacedObject {
  uid: string;
  item_id: string;
  x: number;
  z: number;
  rotation: number;
}

/** GET/PUT /world/fields/{id}/layout */
export interface FieldLayout {
  field_id: string;
  version: number;
  objects: PlacedObject[];
}

/** POST /world/store/purchase (send an Idempotency-Key) */
export interface PurchaseResult {
  item_id: string;
  owned: number;
  gems: number;
}
