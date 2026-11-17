"use client";
import type { ReactNode } from "react";
import { IconBubble, PlayStat, type Pastel } from "@/components/playful";
import { BilingualText, type StickerIconName } from "@/components/ui";
import type { BilingualString } from "@/lib/i18n/use-bilingual";

/** Page heading used by every teacher screen: a soft peach banner with a sticker bubble. */
export function PageTitle({ text, icon, action }: { text: BilingualString; icon: StickerIconName; action?: ReactNode }) {
  return (
    <div className="relative mb-4 flex flex-wrap items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#ffe2c4] via-[#fff0dc] to-[#fff8ee] p-4 shadow-[0_8px_22px_rgb(120_70_20/0.08)]">
      <IconBubble icon={icon} pastel="peach" size={34} />
      <BilingualText as="h1" size="2xl" text={text} className="[&>span:first-child]:font-extrabold" />
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

const TILE_PASTEL: Partial<Record<StickerIconName, Pastel>> = { people: "lavender", target: "sky", snail: "lemon", books: "mint", flame: "peach", star: "lemon", chart: "sky" };

export function StatTile({ icon, value, label, tone = "default" }: { icon: StickerIconName; value: string; label: BilingualString; tone?: "default" | "warn" }) {
  return <PlayStat icon={icon} value={value} label={label} pastel={TILE_PASTEL[icon] ?? "peach"} warn={tone === "warn"} />;
}

export { Pill } from "@/components/ui";

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v * 100)}%`);
