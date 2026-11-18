"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/ui";
import { useAuth } from "@/features/auth/hooks";
import type { LanguageMode } from "@/features/auth/types";
import { languagePickedThisVisit, markLanguagePicked, writeLanguageCookie } from "@/lib/i18n/language";
import { useAppStore } from "@/lib/store/app-store";
import { LanguageScreen } from "./LanguageScreen";

/**
 * Wraps the sign-in screens: until the user picks Hindi + English or Kannada + English on this visit,
 * the language picker shows in their place; after the pick, the screen itself shows. (No redirect: a
 * navigation made while a page is first loading can be undone by the router.)
 */
export function LanguageFirst({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const selected = useAppStore((s) => s.draftLanguage);
  const setDraft = useAppStore((s) => s.setDraftLanguage);
  const [picked, setPicked] = useState<boolean | null>(null);   // null until we can read this visit's pick
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the pick lives in sessionStorage, readable only after mount
  useEffect(() => setPicked(languagePickedThisVisit()), []);
  if (status === "signedIn" || picked) return <>{children}</>;
  if (picked === null) return <LoadingState className="min-h-dvh" />;
  const choose = (mode: LanguageMode) => {
    setDraft(mode);
    writeLanguageCookie(mode);
    markLanguagePicked();
    setPicked(true);
    router.refresh(); // re-render in the chosen language
  };
  return <LanguageScreen selected={selected} onChoose={choose} />;
}
