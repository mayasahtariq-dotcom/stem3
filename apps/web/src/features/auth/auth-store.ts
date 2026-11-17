import { create } from "zustand";
import type { Session } from "./types";

export type AuthStatus = "restoring" | "signedOut" | "signedIn";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  setSession: (s: Session | null) => void;
}

/** In-memory auth state; the gateway owns persistence. */
export const useAuthStore = create<AuthState>()((set) => ({
  status: "restoring",
  session: null,
  setSession: (session) => set({ session, status: session ? "signedIn" : "signedOut" }),
}));
