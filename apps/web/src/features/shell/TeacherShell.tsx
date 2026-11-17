"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
    <div className="min-h-dvh bg-cloud">
      <header className="border-b-2 border-line bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-xl font-extrabold text-grass-strong">
            <StickerIcon name="sprout" size={28} /> {c("appName").regional}
          </span>
          <RoleBadge role="teacher" />
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
            <span>{n("classSwitcher").regional}</span>
            <select
              className="min-h-11 rounded-button border-2 border-line bg-white px-3 font-semibold"
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
        <nav aria-label={n("teacherNav").english} className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4">
          {NAV.teacher.map((item) => {
            const active = item.href === "/teacher" ? pathname === item.href : pathname.startsWith(item.href);
            const available = isAvailable(item);
            const cls = cn(
              "flex min-h-11 items-center gap-2 border-b-4 px-4 font-bold",
              active ? "border-grass-strong text-ink" : "border-transparent text-stone",
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
      </header>
      <main className="mx-auto max-w-[1440px] p-4 tablet:p-6">{children}</main>
    </div>
  );
}
