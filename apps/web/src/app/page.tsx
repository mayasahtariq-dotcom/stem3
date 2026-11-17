"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "@/components/AuthGate";
import { useSession } from "@/lib/session";

export default function Index() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  useEffect(() => { router.replace(user ? homeFor(user.role) : "/login"); }, [user, router]);
  return null;
}
