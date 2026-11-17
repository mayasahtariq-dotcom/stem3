"use client";
import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/lib/services";
import { queryKeys } from "@/lib/api/query-keys";
import { useAuthStore } from "./auth-store";
import { fetchProfile, saveProfile } from "./profile-api";
import type { LanguageMode, Role, Session } from "./types";

/** Restores a stored session once at startup. Mounted by <AppProviders>. */
export function useRestoreSession() {
  const { auth, reporter } = useServices();
  const setSession = useAuthStore((s) => s.setSession);
  useEffect(() => {
    let alive = true;
    auth
      .restore()
      .then((s) => alive && setSession(s))
      .catch((err) => {
        reporter.capture(err, { where: "restoreSession" });
        if (alive) setSession(null);
      });
    return () => {
      alive = false;
    };
  }, [auth, reporter, setSession]);
}

export function useAuth() {
  const { auth } = useServices();
  const qc = useQueryClient();
  const { status, session, setSession } = useAuthStore();

  const completeSignIn = useCallback(
    (s: Session) => {
      qc.removeQueries({ queryKey: queryKeys.me });
      setSession(s);
    },
    [qc, setSession],
  );

  const signOut = useCallback(async () => {
    await auth.signOut();
    setSession(null);
    qc.clear();
  }, [auth, qc, setSession]);

  return { status, session, completeSignIn, signOut };
}

/** The signed-in user's profile (GET /me). */
export function useProfile() {
  const { api } = useServices();
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => fetchProfile(api),
    enabled: status === "signedIn",
  });
}

/** Creates or updates the profile (PUT /me). */
export function useSaveProfile() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; languageMode: LanguageMode; roles: Role[] }) => saveProfile(api, body),
    onSuccess: (profile) => qc.setQueryData(queryKeys.me, profile),
  });
}
