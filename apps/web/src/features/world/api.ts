"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FieldLayout, InventoryEntry, PlacedObject, PurchaseResult, StoreItem, WorldState } from "@mooshala/api-client";
import { useAuthStore } from "@/features/auth/auth-store";
import { useServices } from "@/lib/services";
import type { FieldId } from "@/lib/world/fields";

/**
 * Farm world hooks: fields, the Farm Store, the inventory and per-field
 * layouts. Not in the backend yet (fake backend: src/mocks/world).
 */
export const worldKeys = {
  world: ["world"] as const,
  store: ["world", "store"] as const,
  inventory: ["world", "inventory"] as const,
  layout: (f: string) => ["world", "layout", f] as const,
};
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

export function useWorld() {
  const { pending } = useServices();
  return useQuery({ queryKey: worldKeys.world, enabled: useSignedIn(), queryFn: () => pending.get<WorldState>("/world"), retry: false });
}

export function useStoreItems() {
  const { pending } = useServices();
  return useQuery({ queryKey: worldKeys.store, enabled: useSignedIn(), queryFn: () => pending.get<StoreItem[]>("/world/store"), retry: false });
}

export function useInventory() {
  const { pending } = useServices();
  return useQuery({ queryKey: worldKeys.inventory, enabled: useSignedIn(), queryFn: () => pending.get<InventoryEntry[]>("/world/inventory"), retry: false });
}

export function useFieldLayout(field: FieldId, enabled = true) {
  const { pending } = useServices();
  return useQuery({ queryKey: worldKeys.layout(field), enabled: useSignedIn() && enabled, queryFn: () => pending.get<FieldLayout>(`/world/fields/${field}/layout`), retry: false });
}

const newKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);

/** Buys one item. Each purchase carries its own Idempotency-Key, so a retried request never charges twice. */
export function usePurchase() {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, key = newKey() }: { itemId: string; key?: string }) => pending.post<PurchaseResult>("/world/store/purchase", { item_id: itemId }, { "Idempotency-Key": key }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["world"] });
      void qc.invalidateQueries({ queryKey: ["game"] });
    },
  });
}

/** Saves a field's whole layout against the version it was loaded at (409 LAYOUT_CONFLICT if it changed elsewhere). */
export function useSaveLayout(field: FieldId) {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ version, objects }: { version: number; objects: PlacedObject[] }) => pending.put<FieldLayout>(`/world/fields/${field}/layout`, { version, objects }),
    onSuccess: (layout) => {
      qc.setQueryData(worldKeys.layout(field), layout);
      void qc.invalidateQueries({ queryKey: worldKeys.inventory });
      void qc.invalidateQueries({ queryKey: worldKeys.world });
    },
    onError: () => void qc.invalidateQueries({ queryKey: worldKeys.layout(field) }),
  });
}

export function useCelebrateField() {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (field: string) => pending.post<WorldState>(`/world/fields/${field}/celebrate`),
    onSuccess: (w) => qc.setQueryData(worldKeys.world, w),
  });
}
