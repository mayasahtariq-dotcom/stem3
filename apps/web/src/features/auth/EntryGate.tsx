"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorState, LoadingState, MeadowScene } from "@/components/ui";
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
      // Signed out: pick the language first (Hindi + English or Kannada + English), then "who are you?".
      router.replace(ROUTES.language);
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
