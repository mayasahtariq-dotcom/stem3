"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NOTE_LIMITS, type ClassNote, type NoteCreate } from "@mooshala/api-client";
import { useAuthStore } from "@/features/auth/auth-store";
import { useServices } from "@/lib/services";

export const noteKeys = { teacher: ["teacher", "notes"] as const, mine: ["me", "notes"] as const };
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

/** GET /teacher/notes (pending contract). */
export function useTeacherNotes() {
  const { pending } = useServices();
  return useQuery({ queryKey: noteKeys.teacher, enabled: useSignedIn(), queryFn: () => pending.get<ClassNote[]>("/teacher/notes") });
}

/** GET /me/notes: notes from every class the student is in (pending contract). */
export function useMyNotes() {
  const { pending } = useServices();
  return useQuery({ queryKey: noteKeys.mine, enabled: useSignedIn(), queryFn: () => pending.get<ClassNote[]>("/me/notes") });
}

/** POST /classrooms/{id}/notes (pending contract). */
export function useShareNote() {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, note }: { classId: string; note: NoteCreate }) => pending.post<ClassNote>(`/classrooms/${encodeURIComponent(classId)}/notes`, note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: noteKeys.teacher }),
  });
}

/** POST /notes/{id}/summary: a short summary in en/hi/kn, made once on the server. */
export function useNoteSummary(noteId: string) {
  const { pending } = useServices();
  return useMutation({
    mutationFn: () => pending.post<{ summary: { en: string; hi: string; kn: string } }>(`/notes/${encodeURIComponent(noteId)}/summary`),
  });
}

export type NoteProblem = "classMissing" | "titleMissing" | "contentMissing" | "fileTooBig";

/** Pure check for the share-notes form. */
export function noteProblem(d: { classId: string; title: string; body: string; file: { size: number } | null }): NoteProblem | null {
  if (!d.classId) return "classMissing";
  if (!d.title.trim()) return "titleMissing";
  if (d.file && d.file.size > NOTE_LIMITS.fileMaxBytes) return "fileTooBig";
  if (!d.body.trim() && !d.file) return "contentMissing";
  return null;
}

export const NOTE_ACCEPT = "image/*,application/pdf,text/plain,.txt";

/** Reads a picked file as a data: URL (the fake backend stores it as is). */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

/** Turns a data: URL into a blob: URL so a PDF or text file can open in a new tab. Other URLs pass through. */
export function openableUrl(url: string): string {
  const m = /^data:([^;,]+)?;base64,(.*)$/.exec(url);
  if (!m || typeof URL.createObjectURL !== "function") return url;
  const bytes = Uint8Array.from(atob(m[2] ?? ""), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: m[1] ?? "application/octet-stream" }));
}
