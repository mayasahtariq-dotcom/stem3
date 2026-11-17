"use client";
import { Suspense } from "react";
import { RoleScreen, useRoleScreen } from "@/features/onboarding/RoleScreen";

function Role() {
  const vm = useRoleScreen();
  return <RoleScreen selected={vm.selected} opening={vm.opening} onChoose={(r) => void vm.choose(r)} />;
}

export default function RolePage() {
  return (
    <Suspense>
      <Role />
    </Suspense>
  );
}
