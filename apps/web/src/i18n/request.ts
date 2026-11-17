import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LANGUAGE_COOKIE, localeFor, modeFor } from "@/lib/i18n/language";

/**
 * next-intl without locale routing: the regional locale comes from the stored
 * language mode cookie (Hindi until one is chosen). English messages ride along
 * under `_en` so every BilingualText can show both lines.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = localeFor(modeFor(store.get(LANGUAGE_COOKIE)?.value));
  const [regional, english] = await Promise.all([
    import(`../../messages/${locale}.json`).then((m) => m.default),
    import(`../../messages/en.json`).then((m) => m.default),
  ]);
  return { locale, messages: { ...regional, _en: english }, timeZone: "Asia/Kolkata" };
});
