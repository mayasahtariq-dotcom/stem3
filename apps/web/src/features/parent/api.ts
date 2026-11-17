"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useServices } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";

/** Parent mode (backend/app/routers/parents.py). */
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

/** Link codes are six characters from an alphabet without look-alikes. */
export const normalizeCode = (raw: string) => raw.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
export const isFullCode = (code: string) => code.length === 6;

export function useChildren() {
  const { api } = useServices();
  return useQuery({ queryKey: queryKeys.parent.children, enabled: useSignedIn(), queryFn: async () => unwrap(await api.GET("/parent/children")) });
}

export function useChildDashboard(childId: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.parent.child(childId),
    enabled: useSignedIn() && Boolean(childId),
    queryFn: async () => unwrap(await api.GET("/parent/children/{child_id}/dashboard", { params: { path: { child_id: childId } } })),
  });
}

/** GET /parent/link/{code}: who the code belongs to, before linking. */
export function useLinkPreview(code: string | null) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.parent.preview(code ?? ""),
    enabled: useSignedIn() && Boolean(code),
    retry: false,
    staleTime: 0,
    queryFn: async () => unwrap(await api.GET("/parent/link/{code}", { params: { path: { code: code! } } })),
  });
}

export function useLinkChild() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => unwrap(await api.POST("/parent/link", { body: { code } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.parent.children }),
  });
}

function useChildMutation<T>(fn: (childId: string) => Promise<T>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_out, childId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.children });
      void qc.invalidateQueries({ queryKey: queryKeys.parent.child(childId) });
    },
  });
}

export function useApproveConsent() {
  const { api } = useServices();
  return useChildMutation(async (id) => unwrap(await api.POST("/parent/children/{child_id}/consent", { params: { path: { child_id: id } } })));
}

export function useRevokeConsent() {
  const { api } = useServices();
  return useChildMutation(async (id) => unwrap(await api.POST("/parent/children/{child_id}/revoke-consent", { params: { path: { child_id: id } } })));
}

export function useUnlinkChild() {
  const { api } = useServices();
  return useChildMutation(async (id) => {
    unwrap(await api.DELETE("/parent/children/{child_id}", { params: { path: { child_id: id } } }));
    return id;
  });
}

export function useRequestDeletion() {
  const { api } = useServices();
  return useChildMutation(async (id): Promise<Schemas["DeletionOut"]> => unwrap(await api.POST("/parent/children/{child_id}/deletion", { params: { path: { child_id: id } } })));
}

// ---- student side ----

export function useMyParents() {
  const { api } = useServices();
  return useQuery({ queryKey: queryKeys.myParents, enabled: useSignedIn(), queryFn: async () => unwrap(await api.GET("/me/parents")) });
}

export function useCreateLinkCode() {
  const { api } = useServices();
  return useMutation({ mutationFn: async () => unwrap(await api.POST("/me/link-code")) });
}

export function useRemoveParent() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await api.DELETE("/me/parents/{parent_id}", { params: { path: { parent_id: id } } }));
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myParents }),
  });
}
