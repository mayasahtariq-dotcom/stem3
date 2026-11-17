"use client";
import type { ReactNode } from "react";
import { StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { HudControls } from "./HudControls";
import { RoleBadge } from "./RoleBadge";

/** Parent shell: one readable column, phone first. */
export function ParentShell({ children }: { children: ReactNode }) {
  const c = useBilingual("common");
  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-white/95">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2 laptop:max-w-4xl">
          <span className="flex items-center gap-2 text-lg font-extrabold text-grass-strong">
            <StickerIcon name="sprout" size={26} /> {c("appName").regional}
          </span>
          <RoleBadge role="parent" className="mr-auto ml-3" />
          <HudControls tone="plain" />
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 laptop:max-w-4xl">{children}</main>
    </div>
  );
}
