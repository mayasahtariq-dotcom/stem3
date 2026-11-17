"use client";
import { useLocale } from "next-intl";
import type { BilingualString } from "./use-bilingual";

/** Course content text: the same line in English, Hindi and Kannada (backend `Tri`). */
export type Tri = { en: string; hi: string; kn: string };

export function triText(tri: Partial<Tri> | null | undefined, locale: string): BilingualString {
  const en = tri?.en ?? "";
  const regional = (locale === "kn" ? tri?.kn : tri?.hi) ?? en;
  return { regional: regional || en, english: en };
}

/** Picks the regional line for the app's language mode plus the English line. */
export function useTri() {
  const locale = useLocale();
  return (tri: Partial<Tri> | null | undefined) => triText(tri, locale);
}
