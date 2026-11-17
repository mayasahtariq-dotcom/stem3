"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Role, useSession } from "@/lib/session";

/** Waits for the stored session, then sends people to the right app for their role. */
export function AuthGate({ role, children }: { role: Role | Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useSession();
  const [ready, setReady] = useState(false);
  const roles = Array.isArray(role) ? role : [role];
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    if (!token || !user) router.replace("/login");
    else if (!roles.includes(user.role)) router.replace(homeFor(user.role));
  }, [ready, token, user, router, roles]);
  if (!ready || !token || !user || !roles.includes(user.role)) return null;
  return <>{children}</>;
}

export function homeFor(role: Role) {
  return role === "teacher" || role === "admin" ? "/teacher" : role === "parent" ? "/parent" : "/learn";
}
