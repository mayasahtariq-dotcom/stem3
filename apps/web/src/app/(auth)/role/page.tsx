"use client";
import { Suspense } from "react";
import { LanguageFirst } from "@/features/onboarding/LanguageFirst";
import { RoleScreen, useRoleScreen } from "@/features/onboarding/RoleScreen";

function Role() {
  const vm = useRoleScreen();
  return <RoleScreen selected={vm.selected} opening={vm.opening} onChoose={(r) => void vm.choose(r)} />;
}

export default function RolePage() {
  return (
    <Suspense>
      <LanguageFirst>
        <Role />
      </LanguageFirst>
    </Suspense>
  );
}
