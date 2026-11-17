import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LanguageMode, Role } from "@/features/auth/types";

/**
 * Shared top-level client state. Server data (profile, classes, game numbers)
 * never lives here: it belongs to TanStack Query. This holds only device-level
 * choices that must survive reloads.
 */
export interface AppState {
  /** Chosen during onboarding, before the profile exists. */
  draftLanguage: LanguageMode | null;
  draftRole: Role | null;
  /** The role last used on this device (docs/decisions.md M1: stored on device). */
  lastRole: Role | null;
  soundMuted: boolean;
  setDraftLanguage: (l: LanguageMode) => void;
  setDraftRole: (r: Role) => void;
  setLastRole: (r: Role) => void;
  toggleSound: () => void;
  resetOnboarding: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      draftLanguage: null,
      draftRole: null,
      lastRole: null,
      soundMuted: false,
      setDraftLanguage: (draftLanguage) => set({ draftLanguage }),
      setDraftRole: (draftRole) => set({ draftRole }),
      setLastRole: (lastRole) => set({ lastRole }),
      toggleSound: () => set((s) => ({ soundMuted: !s.soundMuted })),
      resetOnboarding: () => set({ draftRole: null }),
    }),
    {
      name: "mooshala.app",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ draftLanguage, draftRole, lastRole, soundMuted }) => ({ draftLanguage, draftRole, lastRole, soundMuted }),
    },
  ),
);
