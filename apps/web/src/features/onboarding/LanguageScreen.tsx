"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { StickerIcon } from "@/components/ui";
import type { LanguageMode } from "@/features/auth/types";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { markLanguagePicked, writeLanguageCookie } from "@/lib/i18n/language";
import { useAppStore } from "@/lib/store/app-store";
import { ROUTES } from "@/features/auth/routing";
import { AuthFrame, ChoiceCard } from "./AuthFrame";

/** View-model: stores the choice (device + cookie for server rendering) and moves on. */
export function useLanguageScreen() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const selected = useAppStore((s) => s.draftLanguage);
  const setDraft = useAppStore((s) => s.setDraftLanguage);
  return {
    selected,
    choose(mode: LanguageMode) {
      setDraft(mode);
      writeLanguageCookie(mode);
      markLanguagePicked();
      // back to the sign-in screen that sent us here (same-app paths only), else "who are you?"
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.role);
      router.refresh(); // re-render server components in the chosen language
    },
  };
}

export function LanguageScreen({ selected, onChoose }: { selected: LanguageMode | null; onChoose: (m: LanguageMode) => void }) {
  const t = useBilingual("language");
  const name = (key: "hindi" | "kannada") => ({ regional: t(key).regional, english: key === "hindi" ? "Hindi" : "Kannada" });
  return (
    <AuthFrame title={t("title")} subtitle={t("subtitle")} golu={{ pose: "wave", says: t("title") }}>
      <div className="flex flex-col gap-3">
        <ChoiceCard text={name("hindi")} icon={<StickerIcon name="book" size={36} />} onClick={() => onChoose("hindi")} selected={selected === "hindi"} />
        <ChoiceCard text={name("kannada")} icon={<StickerIcon name="books" size={36} />} onClick={() => onChoose("kannada")} selected={selected === "kannada"} />
      </div>
    </AuthFrame>
  );
}
