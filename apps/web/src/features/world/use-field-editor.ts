"use client";
import { useMemo } from "react";
import type { PlacedObject } from "@mooshala/api-client";
import { FIELD_GEOMETRY, type FieldId } from "@/lib/world/fields";
import { availableToPlace, findSpot, placementProblem, type PlacementProblem } from "@/lib/world/placement";
import { useFieldLayout, useInventory, useSaveLayout } from "./api";
import { useWorldUi } from "./world-store";

const START: Record<FieldId, [number, number]> = {
  "starter-meadow": [-6, 14],
  "blossom-meadow": [-6, 10],
  "golden-valley": [6, 6],
  "woodland-farm": [-6, 10],
  "mountain-paradise": [6, 8],
};

/**
 * The placement editor's logic for one field: what stands there, what can
 * still be placed, whether the draft fits, and saving the layout.
 */
export function useFieldEditor(field: FieldId, enabled = true) {
  const g = FIELD_GEOMETRY[field];
  const layout = useFieldLayout(field, enabled);
  const inventory = useInventory();
  const save = useSaveLayout(field);
  const draft = useWorldUi((s) => s.draft);
  const objects = useMemo(() => layout.data?.objects ?? [], [layout.data]);
  const visible = useMemo(() => (draft ? objects.filter((o) => o.uid !== draft.uid) : objects), [objects, draft]);
  const problem: PlacementProblem | null = draft ? placementProblem(g, draft, visible) : null;

  const available = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of inventory.data ?? []) {
      const elsewhere = Object.entries(e.placed).reduce((n, [f, c]) => (f === field ? n : n + c), 0);
      out[e.item_id] = availableToPlace(e.owned, elsewhere, objects.filter((o) => o.item_id === e.item_id).length);
    }
    return out;
  }, [inventory.data, objects, field]);

  const persist = (next: PlacedObject[], onDone?: () => void, onFail?: (e: unknown) => void) => {
    if (!layout.data) return;
    save.mutate({ version: layout.data.version, objects: next }, { onSuccess: () => onDone?.(), onError: (e) => onFail?.(e) });
  };

  return {
    layout,
    inventory,
    saving: save.isPending,
    objects: visible,
    available,
    problem,
    /** A good first spot for a new item. */
    spotFor: (itemId: string) => findSpot(g, itemId, objects, ...START[field]),
    /** Saves the draft into the layout. */
    confirm: (onDone?: () => void, onFail?: (e: unknown) => void) => {
      if (!draft || problem) return;
      const obj = { uid: draft.uid, item_id: draft.item_id, x: draft.x, z: draft.z, rotation: draft.rotation };
      persist([...objects.filter((o) => o.uid !== obj.uid), { ...obj, x: +obj.x.toFixed(2), z: +obj.z.toFixed(2), rotation: +obj.rotation.toFixed(3) }], onDone, onFail);
    },
    /** Takes a placed object back to the inventory. */
    putAway: (uid: string, onDone?: () => void, onFail?: (e: unknown) => void) => persist(objects.filter((o) => o.uid !== uid), onDone, onFail),
  };
}
