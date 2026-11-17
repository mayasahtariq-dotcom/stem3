"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useServices } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";

/** Server state for the student core. Only documented backend endpoints. */
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

/** GET /me/home */
export function useHome() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.home,
    enabled: useSignedIn(),
    queryFn: async () => {
      const home = unwrap(await api.GET("/me/home"));
      qc.setQueryData(queryKeys.stats, home.stats);
      return home;
    },
  });
}

/** GET /me/stats (XP, daily goal, hearts, streak; the server computes all of it). */
export function useStats() {
  const { api } = useServices();
  return useQuery({ queryKey: queryKeys.stats, enabled: useSignedIn(), queryFn: async () => unwrap(await api.GET("/me/stats")), refetchInterval: 60_000 });
}

/** GET /courses/{id}/path */
export function usePath(courseId: string | null | undefined) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.path(courseId ?? ""),
    enabled: useSignedIn() && Boolean(courseId),
    queryFn: async () => unwrap(await api.GET("/courses/{course_id}/path", { params: { path: { course_id: courseId! } } })),
  });
}

/** PUT /me/daily-goal */
export function useSetDailyGoal() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Schemas["DailyGoalIn"]["goal"]) => unwrap(await api.PUT("/me/daily-goal", { body: { goal } })),
    onSuccess: (stats) => {
      qc.setQueryData(queryKeys.stats, stats);
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

/** GET /courses/{id}/terms */
export function useTerms(courseId: string | null | undefined) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.terms(courseId ?? ""),
    enabled: useSignedIn() && Boolean(courseId),
    queryFn: async () => unwrap(await api.GET("/courses/{course_id}/terms", { params: { path: { course_id: courseId! } } })),
  });
}

/** PUT/DELETE /me/saved-terms/{course_id}/{key}, optimistic. */
export function useToggleSavedTerm(courseId: string) {
  const { api } = useServices();
  const qc = useQueryClient();
  const key = queryKeys.terms(courseId);
  return useMutation({
    mutationFn: async ({ term, save }: { term: string; save: boolean }) => {
      const params = { path: { course_id: courseId, key: term } };
      if (save) unwrap(await api.PUT("/me/saved-terms/{course_id}/{key}", { params }));
      else unwrap(await api.DELETE("/me/saved-terms/{course_id}/{key}", { params }));
    },
    onMutate: async ({ term, save }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Schemas["TermOut"][]>(key);
      qc.setQueryData<Schemas["TermOut"][]>(key, (old) => old?.map((t) => (t.key === term ? { ...t, saved: save } : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
  });
}

/** POST /doubts */
export function useAskDoubt() {
  const { api } = useServices();
  return useMutation({ mutationFn: async (body: Schemas["DoubtIn"]) => unwrap(await api.POST("/doubts", { body })) });
}

/** POST /audio: a URL to the spoken line, or "" when the server has no voice for it. */
export function useAudio() {
  const { api } = useServices();
  return useMutation({ mutationFn: async (body: Schemas["AudioIn"]) => unwrap(await api.POST("/audio", { body })) });
}
