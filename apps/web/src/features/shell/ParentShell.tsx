"use client";
import type { ReactNode } from "react";
import { PlayfulPage } from "@/components/playful";
import { StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { HudControls } from "./HudControls";
import { RoleBadge } from "./RoleBadge";

/** Parent shell: one readable column, phone first. */
export function ParentShell({ children }: { children: ReactNode }) {
  const c = useBilingual("common");
  return (
    <PlayfulPage tone="lavender">
      <header className="sticky top-0 z-10 mx-auto max-w-xl px-3 pt-3 laptop:max-w-4xl">
        <div className="flex items-center justify-between rounded-[24px] bg-white/95 px-4 py-2 shadow-[0_8px_24px_rgb(80_60_160/0.10)] backdrop-blur">
          <span className="flex items-center gap-2 text-xl font-extrabold text-[#6a4bf0]">
            <span className="grid size-10 place-items-center rounded-full bg-[#ece6ff]"><StickerIcon name="sprout" size={26} /></span>
            <span className="font-display tracking-wide">{c("appName").regional}</span>
          </span>
          <RoleBadge role="parent" className="mr-auto ml-3" />
          <HudControls tone="plain" />
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 laptop:max-w-4xl">{children}</main>
    </PlayfulPage>
  );
}
