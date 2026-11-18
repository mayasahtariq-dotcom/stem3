"use client";
import { Suspense } from "react";
import { LanguageScreen, useLanguageScreen } from "@/features/onboarding/LanguageScreen";

function Language() {
  const vm = useLanguageScreen();
  return <LanguageScreen selected={vm.selected} onChoose={vm.choose} />;
}

export default function LanguagePage() {
  return (
    <Suspense>
      <Language />
    </Suspense>
  );
}
