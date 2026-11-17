"use client";
import type { ReactNode } from "react";
import { BilingualText, Card, StickerIcon, type StickerIconName } from "@/components/ui";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";

/** Page heading used by every teacher screen. */
export function PageTitle({ text, icon, action }: { text: BilingualString; icon: StickerIconName; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <StickerIcon name={icon} size={36} />
      <BilingualText as="h1" size="2xl" text={text} />
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export function StatTile({ icon, value, label, tone = "default" }: { icon: StickerIconName; value: string; label: BilingualString; tone?: "default" | "warn" }) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", tone === "warn" && "border-coral bg-coral/10")}>
      <StickerIcon name={icon} size={36} />
      <div>
        <p className="text-2xl font-extrabold tabular-nums">{value}</p>
        <BilingualText size="sm" text={label} />
      </div>
    </Card>
  );
}

export { Pill } from "@/components/ui";

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v * 100)}%`);
