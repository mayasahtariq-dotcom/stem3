"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ErrorState, LoadingState } from "@/components/ui";
import { useAppStore } from "@/lib/store/app-store";
import { useAuth, useProfile } from "./hooks";
import { ROUTES, nextRouteFor } from "./routing";
import type { Role } from "./types";

/**
 * Client-side role guard for a route group. Signed-out users go to login; users
 * without the role go to their own home. The backend enforces roles too (RLS
 * and NOT_A_TEACHER-style errors), so this is UX, not security.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const profile = useProfile();
  const setLastRole = useAppStore((s) => s.setLastRole);
  const lastRole = useAppStore((s) => s.lastRole);

  const allowed = Boolean(profile.data?.registered && profile.data.roles.includes(role));

  useEffect(() => {
    if (status === "signedOut") router.replace(`${ROUTES.login}?next=${encodeURIComponent(pathname)}`);
    else if (profile.data && !allowed) router.replace(nextRouteFor(profile.data, lastRole));
  }, [status, profile.data, allowed, router, pathname, lastRole]);

  useEffect(() => {
    if (allowed) setLastRole(role);
  }, [allowed, role, setLastRole]);

  if (profile.isError) return <ErrorState className="min-h-dvh" error={profile.error} onRetry={() => profile.refetch()} />;
  if (!allowed) return <LoadingState className="min-h-dvh" />;
  return <>{children}</>;
}
