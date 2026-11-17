"use client";
import { LanguageScreen, useLanguageScreen } from "@/features/onboarding/LanguageScreen";

export default function LanguagePage() {
  const vm = useLanguageScreen();
  return <LanguageScreen selected={vm.selected} onChoose={vm.choose} />;
}
