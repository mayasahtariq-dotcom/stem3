import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BilingualText, ChunkyButton, GoluMascot, MeadowScene } from "@/components/ui";

export default async function NotFound() {
  const t = await getTranslations("common");
  const e = await getTranslations("_en.common");
  return (
    <MeadowScene className="flex flex-col items-center justify-center gap-6 p-6">
      <GoluMascot pose="question" size={120} />
      <BilingualText as="h1" size="xl" align="center" text={{ regional: t("notFound"), english: e("notFound") }} />
      <ChunkyButton asChild>
        <Link href="/">
          <BilingualText as="span" size="sm" align="center" tone="inverse" text={{ regional: t("goHome"), english: e("goHome") }} />
        </Link>
      </ChunkyButton>
    </MeadowScene>
  );
}
