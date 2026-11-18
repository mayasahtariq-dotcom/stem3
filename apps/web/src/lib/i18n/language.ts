import type { LanguageMode } from "@/features/auth/types";

/** Cookie that carries the stored language mode to server rendering. */
export const LANGUAGE_COOKIE = "mooshala_lang";
export type RegionalLocale = "hi" | "kn";

export const localeFor = (mode: LanguageMode | null | undefined): RegionalLocale => (mode === "kannada" ? "kn" : "hi");
export const modeFor = (value: string | null | undefined): LanguageMode | null =>
  value === "hindi" || value === "kannada" ? value : null;

/**
 * Persists the language mode. The app language follows this stored mode,
 * never the browser's Accept-Language.
 */
export function writeLanguageCookie(mode: LanguageMode) {
  document.cookie = `${LANGUAGE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function readLanguageCookie(): LanguageMode | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE}=([^;]*)`));
  return modeFor(m?.[1]);
}

/** Set when the user picks Hindi + English or Kannada + English on this visit (lasts until the tab closes). */
const PICKED_KEY = "aaroh.languagePicked";

export function markLanguagePicked() {
  try {
    sessionStorage.setItem(PICKED_KEY, "1");
  } catch {
    /* storage blocked: the picker just shows again */
  }
}

export function languagePickedThisVisit(): boolean {
  try {
    return sessionStorage.getItem(PICKED_KEY) === "1";
  } catch {
    return false;
  }
}
