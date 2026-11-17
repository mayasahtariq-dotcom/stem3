"use client";
import { useTranslations } from "next-intl";

export interface BilingualString {
  regional: string;
  english: string;
}

type Values = Record<string, string | number>;

/**
 * Both lines of a message: the regional (Hindi or Kannada) line and English.
 * The web counterpart of the Android `bilingualStringResource`.
 */
export function useBilingual(namespace: string) {
  const regional = useTranslations(namespace);
  const english = useTranslations(`_en.${namespace}`);
  return (key: string, values?: Values): BilingualString => ({
    regional: regional(key, values),
    english: english(key, values),
  });
}
