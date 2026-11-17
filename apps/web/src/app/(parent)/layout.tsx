"use client";
import type { ReactNode } from "react";
import { RoleGate } from "@/features/auth/RoleGate";
import { ParentShell } from "@/features/shell/ParentShell";

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="parent">
      <ParentShell>{children}</ParentShell>
    </RoleGate>
  );
}
