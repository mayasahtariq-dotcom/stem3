"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PlacedObject } from "@mooshala/api-client";
import type { FieldId } from "@/lib/world/fields";

export type WorldSheet = "levels" | "store" | "inventory" | null;

interface WorldUiState {
  /** The field the student is standing in (kept on this device). */
  field: FieldId;
  sheet: WorldSheet;
  /** The object being placed or moved; `isNew` when it came from the inventory. */
  draft: (PlacedObject & { isNew: boolean }) | null;
  /** A placed object the student tapped (offers Move / Put away). */
  picked: string | null;
  setField: (f: FieldId) => void;
  openSheet: (s: WorldSheet) => void;
  startDraft: (d: PlacedObject & { isNew: boolean }) => void;
  moveDraft: (x: number, z: number) => void;
  rotateDraft: (step?: number) => void;
  cancelDraft: () => void;
  pick: (uid: string | null) => void;
}

export const useWorldUi = create<WorldUiState>()(
  persist(
    (set) => ({
      field: "starter-meadow",
      sheet: null,
      draft: null,
      picked: null,
      setField: (field) => set({ field, draft: null, picked: null, sheet: null }),
      openSheet: (sheet) => set({ sheet }),
      startDraft: (draft) => set({ draft, sheet: null, picked: null }),
      moveDraft: (x, z) => set((s) => (s.draft ? { draft: { ...s.draft, x, z } } : s)),
      rotateDraft: (step = Math.PI / 4) => set((s) => (s.draft ? { draft: { ...s.draft, rotation: (s.draft.rotation + step) % (Math.PI * 2) } } : s)),
      cancelDraft: () => set({ draft: null }),
      pick: (picked) => set({ picked }),
    }),
    { name: "mooshala-world", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ field: s.field }) },
  ),
);
