"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClassInsights, Material, Schemas, TeacherOverview } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useServices } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";

const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

export const insightKeys = {
  overview: ["teacher", "overview"] as const,
  insights: (classId: string) => ["classrooms", classId, "insights"] as const,
  materials: ["teacher", "materials"] as const,
};

/** GET /teacher/overview (pending contract). */
export function useTeacherOverview() {
  const { pending } = useServices();
  return useQuery({ queryKey: insightKeys.overview, enabled: useSignedIn(), queryFn: () => pending.get<TeacherOverview>("/teacher/overview") });
}

/** GET /classrooms/{id}/insights (pending contract). */
export function useClassInsights(classId: string) {
  const { pending } = useServices();
  return useQuery({ queryKey: insightKeys.insights(classId), enabled: useSignedIn() && Boolean(classId), queryFn: () => pending.get<ClassInsights>(`/classrooms/${encodeURIComponent(classId)}/insights`) });
}

/** GET /teacher/materials (pending contract). */
export function useMaterials() {
  const { pending } = useServices();
  return useQuery({ queryKey: insightKeys.materials, enabled: useSignedIn(), queryFn: () => pending.get<Material[]>("/teacher/materials") });
}

/** DELETE /uploads/{id}: the teacher deletes files they uploaded (a course made from them stays). */
export function useDeleteUpload() {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uploadId: string) => pending.del(`/uploads/${encodeURIComponent(uploadId)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: insightKeys.materials }),
  });
}

export type NewClass = Schemas["ClassroomCreate"];

/** POST /classrooms (exists in the backend). */
export function useCreateClass() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: NewClass) => unwrap(await api.POST("/classrooms", { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.teacherClassrooms });
      void qc.invalidateQueries({ queryKey: insightKeys.overview });
    },
  });
}

/** Pure check for the new-class form. */
export function newClassProblem(c: { name: string; grade: number }): "nameMissing" | "gradeRange" | null {
  if (!c.name.trim()) return "nameMissing";
  if (!Number.isInteger(c.grade) || c.grade < 6 || c.grade > 12) return "gradeRange";
  return null;
}
