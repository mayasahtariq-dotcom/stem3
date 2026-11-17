"use client";
import type { ReactNode } from "react";
import { RoleGate } from "@/features/auth/RoleGate";
import { StudentShell } from "@/features/shell/StudentShell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="student">
      <StudentShell>{children}</StudentShell>
    </RoleGate>
  );
}
