"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { toast } from "@/components/ui/Toast";
import { queryKeys } from "@/lib/api/query-keys";
import { readLanguageCookie, writeLanguageCookie } from "@/lib/i18n/language";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";
import { useAppStore } from "@/lib/store/app-store";
import { useAuth } from "./hooks";
import { fetchProfile, saveProfile } from "./profile-api";
import { nextRouteFor, requiredRoleFor } from "./routing";
import type { Session } from "./types";

/**
 * After any successful sign-in: store the session, load the profile, adopt the
 * profile's stored language, and go to the right place (a safe `next` link,
 * the name screen for new users, or the role's home).
 */
export function usePostSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { api } = useServices();
  const { completeSignIn, signOut } = useAuth();
  // The mode picked before sign-in wins; otherwise the last one used here.
  const lastRole = useAppStore((s) => s.draftRole ?? s.lastRole);
  const t = useBilingual("login");

  return useCallback(
    async (session: Session) => {
      completeSignIn(session);
      let profile = await qc.fetchQuery({ queryKey: queryKeys.me, queryFn: () => fetchProfile(api) });
      // The language picked before sign-in (Hindi + English or Kannada + English) wins and is saved to the
      // account; with no pick on this device, adopt the account's language.
      const pickedLanguage = useAppStore.getState().draftLanguage ?? readLanguageCookie();
      if (pickedLanguage && profile.registered && profile.name && profile.roles.length && profile.languageMode !== pickedLanguage) {
        try {
          profile = await saveProfile(api, { name: profile.name, languageMode: pickedLanguage, roles: profile.roles });
          qc.setQueryData(queryKeys.me, profile);
        } catch {
          /* keep the account's language if saving fails */
        }
      }
      const mode = profile.languageMode ?? pickedLanguage;
      if (mode && mode !== readLanguageCookie()) {
        writeLanguageCookie(mode);
        router.refresh();
      }
      // The mode picked before sign-in must match the account: never open
      // another mode silently (e.g. Teacher picked, student number entered).
      const picked = useAppStore.getState().draftRole;
      if (picked && profile.registered && !profile.roles.includes(picked)) {
        await signOut();
        toast("error", t(`wrongMode_${picked}`));
        return;
      }
      toast("success", t("signedIn"));
      const next = params.get("next");
      // Only same-app paths, and only into a role the user has.
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      const needed = safeNext ? requiredRoleFor(safeNext) : null;
      if (profile.registered && safeNext && (!needed || profile.roles.includes(needed))) router.replace(safeNext);
      else router.replace(nextRouteFor(profile, lastRole));
    },
    [api, completeSignIn, lastRole, params, qc, router, signOut, t],
  );
}
