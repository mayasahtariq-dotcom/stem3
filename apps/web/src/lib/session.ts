"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Lang = "hi" | "kn" | "en";
export type Role = "student" | "teacher" | "parent" | "admin";
export interface User { id: string; role: Role; language: string; name: string }

interface SessionState {
  token: string | null;
  user: User | null;
  lang: Lang;                     // the stored language mode (never the browser's)
  sound: boolean;
  setSession: (token: string, user: User) => void;
  setLang: (lang: Lang) => void;
  toggleSound: () => void;
  logout: () => void;
}

// Storage can be blocked (private windows, school PCs); fall back to memory.
const safeStorage = createJSONStorage(() => {
  try { localStorage.setItem("__aaroh", "1"); localStorage.removeItem("__aaroh"); return localStorage; }
  catch { const m = new Map<string, string>(); return {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k) }; }
});

export const useSession = create<SessionState>()(persist((set) => ({
  token: null, user: null, lang: "hi", sound: true,
  setSession: (token, user) => set({ token, user }),
  setLang: (lang) => set({ lang }),
  toggleSound: () => set((s) => ({ sound: !s.sound })),
  logout: () => set({ token: null, user: null }),
}), { name: "aaroh-session", storage: safeStorage }));
