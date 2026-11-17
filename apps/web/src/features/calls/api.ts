"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CALL_PATHS, type CallSession, type CallStudent, type CallStudentCreate, type CallStudentPatch, type CallTwin } from "@mooshala/api-client";
import { useServices } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";
import { isLive, shownCall } from "./rules";

/**
 * Call-mode hooks. These endpoints are named in the web spec but NOT built by
 * the backend yet; in fake mode MSW serves them from src/mocks/calls. With
 * real services they fail and the console shows its error state.
 */
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

/** Query keys for call mode (kept here so the feature stays self-contained). */
export const callKeys = {
  list: (classId: string) => ["calls", "list", classId] as const,
  call: (id: string) => ["calls", "call", id] as const,
  twin: (id: string) => ["calls", "twin", id] as const,
};

/** How often the console asks the server about a live call. */
export const CALL_POLL_MS = 1000;

export function useCallStudents(classId: string) {
  const { pending } = useServices();
  return useQuery({
    queryKey: callKeys.list(classId),
    enabled: useSignedIn() && Boolean(classId),
    queryFn: () => pending.get<CallStudent[]>(CALL_PATHS.list(classId)),
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useAddCallStudent(classId: string) {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallStudentCreate) => pending.post<CallStudent>(CALL_PATHS.create(classId), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: callKeys.list(classId) }),
  });
}

export function usePatchCallStudent(classId: string) {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CallStudentPatch }) => pending.patch<CallStudent>(CALL_PATHS.patch(id), patch),
    onSuccess: (s) => qc.setQueryData<CallStudent[]>(callKeys.list(classId), (list) => list?.map((x) => (x.id === s.id ? s : x))),
  });
}

export function useTwin(id: string | null) {
  const { pending } = useServices();
  return useQuery({ queryKey: callKeys.twin(id ?? ""), enabled: useSignedIn() && Boolean(id), queryFn: () => pending.get<CallTwin>(CALL_PATHS.twin(id!)), retry: false });
}

/**
 * Starts and follows one call. "Call now" is sent once (the button locks and
 * a second tap is ignored while a request or a live call exists); the state
 * shown is only ever what the server last reported, polled every second
 * while the call is live.
 */
export function useLiveCall(classId: string, studentId: string | null) {
  const { pending } = useServices();
  const qc = useQueryClient();
  const [shown, setShown] = useState<CallSession | null>(null);
  const start = useMutation({ mutationFn: (id: string) => pending.post<CallSession>(CALL_PATHS.callNow(id)) });
  const active = shown && shown.call_student_id === studentId ? shown : null;
  const poll = useQuery({
    queryKey: callKeys.call(studentId ?? ""),
    enabled: Boolean(studentId) && isLive(active?.state),
    refetchInterval: CALL_POLL_MS,
    queryFn: async () => {
      const data = await pending.get<CallSession>(CALL_PATHS.call(studentId!));
      setShown((prev) => shownCall(prev, data));
      if (!isLive(data.state)) {
        void qc.invalidateQueries({ queryKey: callKeys.list(classId) });
        void qc.invalidateQueries({ queryKey: callKeys.twin(data.call_student_id) });
      }
      return data;
    },
    retry: false,
  });

  return {
    call: active,
    starting: start.isPending,
    startError: start.error,
    pollError: poll.error,
    callNow: (id: string, onError: (e: unknown) => void) => {
      if (start.isPending || isLive(active?.state)) return;
      start.mutate(id, {
        onSuccess: (session) => {
          qc.removeQueries({ queryKey: callKeys.call(id) });
          setShown(session);
          void qc.invalidateQueries({ queryKey: callKeys.list(classId) });
        },
        onError,
      });
    },
  };
}

/** Demo-only (fake mode): move the fake server clock to 6 pm or back. */
export function useDemoClock(classId: string) {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: "evening" | "real") => pending.put<{ now: string }>("/__demo/clock", { preset }),
    onSuccess: () => qc.invalidateQueries({ queryKey: callKeys.list(classId) }),
  });
}
