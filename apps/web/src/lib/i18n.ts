"use client";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import { type Lang, useSession } from "./session";
import type { Bi } from "./types";

export const messages = { en, hi, kn } as const;
type Values = Record<string, string | number>;

const translators = {
  en: createTranslator({ locale: "en", messages: en }),
  hi: createTranslator({ locale: "hi", messages: hi }),
  kn: createTranslator({ locale: "kn", messages: kn }),
};

function tr(lang: Lang, key: string, values?: Values): string {
  try { return (translators[lang] as unknown as (k: string, v?: Values) => string)(key, values); }
  catch { return (translators.en as unknown as (k: string, v?: Values) => string)(key, values); }
}

/** Regional line (bold) + English line, following the stored language mode. */
export function useT() {
  const lang = useSession((s) => s.lang);
  return {
    lang,
    t: (key: string, values?: Values) => tr(lang, key, values),
    en: (key: string, values?: Values) => tr("en", key, values),
    bi: (key: string, values?: Values) => ({ regional: tr(lang, key, values), english: lang === "en" ? "" : tr("en", key, values) }),
  };
}

/** Pick the right language out of content like {hi, kn, en, regional, english} or a plain string. */
export function pick(v: Bi | unknown, lang: Lang): string {
  if (v == null) return "";
  if (typeof v !== "object") return String(v);
  const o = v as Record<string, string>;
  return o[lang] ?? (lang === "en" ? o.english : o.regional) ?? o.regional ?? o.english ?? o.en ?? "";
}
export function pickEnglish(v: Bi | unknown): string {
  if (v == null || typeof v !== "object") return v == null ? "" : String(v);
  const o = v as Record<string, string>;
  return o.en ?? o.english ?? "";
}

/** Read text aloud in Hindi/Kannada/English with the browser's speech engine (Sarvam audio comes from P3). */
export function speak(text: string, lang: Lang) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : lang === "kn" ? "kn-IN" : "en-IN";
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}
