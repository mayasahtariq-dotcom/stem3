"use client";
import type { ReactNode } from "react";
import { RoleGate } from "@/features/auth/RoleGate";
import { TeacherShell } from "@/features/shell/TeacherShell";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="teacher">
      <TeacherShell>{children}</TeacherShell>
    </RoleGate>
  );
}
