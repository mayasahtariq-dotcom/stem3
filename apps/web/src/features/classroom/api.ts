"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useServices } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";

/** GET /classrooms/preview/{key} (only runs once a full key is entered). */
export function useClassPreview(key: string | null) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.classroomPreview(key ?? ""),
    queryFn: async () => unwrap(await api.GET("/classrooms/preview/{key}", { params: { path: { key: key! } } })),
    enabled: Boolean(key),
    retry: false,
    staleTime: 0,
  });
}

/** POST /classrooms/join */
export function useJoinClass() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => unwrap(await api.POST("/classrooms/join", { body: { key } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myClassrooms }),
  });
}

/** GET /classrooms (teacher's classes, for the class switcher). */
export function useTeacherClassrooms() {
  const { api } = useServices();
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: queryKeys.teacherClassrooms,
    queryFn: async () => unwrap(await api.GET("/classrooms")),
    enabled: status === "signedIn",
  });
}
