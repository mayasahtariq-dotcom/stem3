"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PlayfulPage } from "@/components/playful";
import { BilingualText, StickerIcon } from "@/components/ui";
import { useSelectedClass } from "@/features/teacher/api";
import { useClassStore } from "@/features/teacher/class-store";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { HudControls } from "./HudControls";
import { RoleBadge } from "./RoleBadge";
import { NAV, isAvailable } from "./nav";

/** Teacher shell: top bar with class switcher, then section tabs, full-width content. */
export function TeacherShell({ children }: { children: ReactNode }) {
  const n = useBilingual("nav");
  const c = useBilingual("common");
  const pathname = usePathname();
  const { classes, classId: selected } = useSelectedClass();
  const setClassId = useClassStore((s) => s.setClassId);

  return (
    <PlayfulPage tone="sun">
      <header className="sticky top-0 z-20 mx-auto max-w-[1440px] px-3 pt-3 tablet:px-5">
        <div className="rounded-[24px] glass">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-2xl font-extrabold text-[#1d6fe0]">
            <span className="grid size-11 place-items-center rounded-full bg-[#dcefff]"><StickerIcon name="sprout" size={28} /></span>
            <span className="font-display tracking-wide">{c("appName").regional}</span>
          </span>
          <RoleBadge role="teacher" />
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
            <span>{n("classSwitcher").regional}</span>
            <select
              className="min-h-11 rounded-full border-2 border-[#d7e6f7] bg-[#f5f9ff] px-4 font-semibold"
              value={selected}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!classes.data?.length}
              aria-label={n("classSwitcher").english}
            >
              {classes.isLoading && <option value="">{c("loading").regional}</option>}
              {classes.isError && <option value="">{c("somethingWrong").regional}</option>}
              {classes.data?.length === 0 && <option value="">{n("noClasses").regional}</option>}
              {classes.data?.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </label>
          <HudControls tone="plain" />
        </div>
        <nav aria-label={n("teacherNav").english} className="flex gap-2 overflow-x-auto px-3 pb-3">
          {NAV.teacher.map((item) => {
            const active = item.href === "/teacher" ? pathname === item.href : pathname.startsWith(item.href);
            const available = isAvailable(item);
            const cls = cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-bold transition-colors",
              active ? "bg-[#2f8cf0] text-white shadow-[0_4px_0_#1b62b8] [&_span]:!text-white" : "bg-[#eef5ff] text-stone hover:bg-[#dcefff]",
              !available && "cursor-not-allowed opacity-60",
            );
            const body = (
              <>
                <StickerIcon name={item.icon} size={20} />
                <BilingualText as="span" size="sm" text={n(item.label)} className="flex-row gap-1" />
              </>
            );
            return available ? (
              <Link key={item.key} href={item.href} className={cls} aria-current={active ? "page" : undefined}>
                {body}
              </Link>
            ) : (
              <span key={item.key} className={cls} role="link" aria-disabled="true" title={c("comingSoon").english}>
                {body}
                <span className="sr-only">({c("comingSoon").english})</span>
              </span>
            );
          })}
        </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] p-4 tablet:p-6">{children}</main>
    </PlayfulPage>
  );
}
