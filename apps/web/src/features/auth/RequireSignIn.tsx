"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LoadingState, MeadowScene } from "@/components/ui";
import { useAuth } from "./hooks";
import { ROUTES } from "./routing";

/** Screens that need a session but no particular role (name, join a class). */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "signedOut") router.replace(`${ROUTES.login}?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);
  if (status !== "signedIn") {
    return (
      <MeadowScene className="grid place-items-center">
        <LoadingState />
      </MeadowScene>
    );
  }
  return <>{children}</>;
}
