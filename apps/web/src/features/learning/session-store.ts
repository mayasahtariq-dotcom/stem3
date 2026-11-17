"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SessionState } from "./session";

/**
 * Lesson sessions in progress, saved on the device so a closed tab, a
 * refresh or a lost connection resumes at the same question. Only the
 * session's position is stored; the server keeps every graded answer.
 */
export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Saved {
  courseId: string;
  title: { en: string; hi: string; kn: string };
  session: SessionState;
  savedAt: number;
}

interface LessonSessionsState {
  sessions: Record<string, Saved>;
  save: (s: Saved) => void;
  clear: (lessonId: string) => void;
  /** A resumable session, or null when none or older than a day. */
  resumable: (lessonId: string, now?: number) => Saved | null;
  latest: (now?: number) => Saved | null;
}

const fresh = (s: Saved | undefined, now: number) => (s && now - s.savedAt < RESUME_WINDOW_MS && s.session.phase !== "done" ? s : null);

export const useLessonSessions = create<LessonSessionsState>()(
  persist(
    (set, get) => ({
      sessions: {},
      save: (s) => set((st) => ({ sessions: { ...st.sessions, [s.session.lessonId]: s } })),
      clear: (id) => set((st) => ({ sessions: Object.fromEntries(Object.entries(st.sessions).filter(([k]) => k !== id)) })),
      resumable: (id, now = Date.now()) => fresh(get().sessions[id], now),
      latest: (now = Date.now()) =>
        Object.values(get().sessions)
          .filter((s) => fresh(s, now))
          .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null,
    }),
    {
      name: "mooshala.lessons",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ sessions: s.sessions }),
    },
  ),
);
