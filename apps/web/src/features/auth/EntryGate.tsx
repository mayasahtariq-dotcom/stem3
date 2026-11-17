"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorState, LoadingState, MeadowScene } from "@/components/ui";
import { readLanguageCookie } from "@/lib/i18n/language";
import { useAppStore } from "@/lib/store/app-store";
import { useAuth, useProfile } from "./hooks";
import { ROUTES, nextRouteFor } from "./routing";

/** Routes "/" by state: no language yet, signed out, or signed in. */
export function EntryGate() {
  const router = useRouter();
  const { status } = useAuth();
  const profile = useProfile();
  const lastRole = useAppStore((s) => s.lastRole);

  useEffect(() => {
    if (status === "restoring") return;
    if (status === "signedOut") {
      // Signed out: always start at "who are you?" (student, teacher or parent).
      router.replace(readLanguageCookie() ? ROUTES.role : ROUTES.language);
      return;
    }
    if (profile.data) router.replace(nextRouteFor(profile.data, lastRole));
  }, [status, profile.data, lastRole, router]);

  return (
    <MeadowScene className="grid place-items-center">
      {profile.isError ? <ErrorState error={profile.error} onRetry={() => profile.refetch()} /> : <LoadingState />}
    </MeadowScene>
  );
}
