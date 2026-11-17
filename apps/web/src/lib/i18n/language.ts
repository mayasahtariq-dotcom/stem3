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
