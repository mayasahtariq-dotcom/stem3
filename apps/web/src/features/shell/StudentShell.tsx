"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BilingualText, GemCounter, GoluMascot, HeartMeter, StickerIcon, StreakFlame, XPRing } from "@/components/ui";
import { useGameStats } from "@/features/game/api";
import { useStats } from "@/features/learning/api";
import { useProfile } from "@/features/auth/hooks";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { HudControls } from "./HudControls";
import { RoleBadge } from "./RoleBadge";
import { NAV, isAvailable } from "./nav";

/**
 * Student shell. On phones and tablets the 3D farm fills the viewport and UI
 * floats over it as a game HUD (top) and a wooden signpost dock (bottom). On
 * laptops and desktops it becomes a website: a fixed top bar with the brand,
 * section links and stats, and the page below it. No dashboard sidebar.
 */
export function StudentShell({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const n = useBilingual("nav");
  const c = useBilingual("common");
  const pathname = usePathname();
  const h = useBilingual("hud");
  const stats = useStats();
  const game = useGameStats();
  // The lesson player is full screen: no HUD or dock over the questions.
  const immersive = pathname.startsWith("/farm/lesson/");
  if (immersive) return <div className="relative h-dvh w-full overflow-hidden bg-white">{children}</div>;
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-sky-soft">
      <main className="absolute inset-0 laptop:top-[72px]">{children}</main>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 tablet:p-4 laptop:pointer-events-auto laptop:h-[72px] laptop:items-center laptop:gap-6 laptop:border-b-2 laptop:border-line laptop:bg-white laptop:px-6 laptop:py-0">
        <div className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-4 shadow-float-1 laptop:shadow-none">
          <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-sun-soft">
            <GoluMascot pose="wave" size={40} animated={false} />
          </span>
          <span className="hidden max-w-[30vw] truncate font-bold tablet:inline laptop:hidden">{profile.data?.name ?? ""}</span>
          <span className="hidden text-xl font-extrabold text-grass-strong laptop:inline">{c("appName").regional}</span>
          <RoleBadge role="student" className="ml-1" />
        </div>
        <nav aria-label={n("studentNav").english} className="hidden flex-1 laptop:block">
          <ul className="flex items-center gap-1">
            {NAV.student.filter(isAvailable).map((item) => {
              const active = pathname === item.href;
              const label = n(item.label);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full px-3 font-bold hover:bg-sun-soft",
                      active ? "bg-sun-soft text-ink" : "text-ink/80",
                    )}
                  >
                    <StickerIcon name={item.icon} size={22} />
                    <span className="font-regional">{label.regional}</span>
                    <span className="text-sm font-medium text-stone" lang="en">
                      {label.english}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          {stats.data && (
            <>
              <XPRing value={stats.data.xp_today} goal={stats.data.daily_goal} size={44} label={h("xpToday", { xp: stats.data.xp_today, goal: stats.data.daily_goal }).english} className="hidden tablet:inline-grid" />
              <StreakFlame value={stats.data.streak} active={stats.data.streak > 0} label={h("streak", { n: stats.data.streak }).english} />
              <HeartMeter value={stats.data.hearts} max={stats.data.max_hearts} label={h("hearts", { n: stats.data.hearts, max: stats.data.max_hearts }).english} />
            </>
          )}
          {game.data && <GemCounter value={game.data.gems} label={h("gems", { n: game.data.gems }).english} />}
          <HudControls />
        </div>
      </header>

      <nav aria-label={n("studentNav").english} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center laptop:hidden p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <ul className="wood-grain pointer-events-auto flex gap-1 rounded-panel p-1.5 [box-shadow:0_6px_0_var(--color-wood-dark),var(--shadow-float-2)]">
          {NAV.student.map((item) => {
            const active = pathname === item.href;
            const available = isAvailable(item);
            const label = n(item.label);
            const body = (
              <>
                <StickerIcon name={item.icon} size={28} className={available ? undefined : "opacity-50 grayscale"} />
                <span className="font-regional text-xs font-bold leading-tight">{label.regional}</span>
                {!available && <span className="sr-only">({c("comingSoon").english})</span>}
              </>
            );
            const cls = cn(
              "flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-card px-2 tablet:min-w-20",
              active ? "bg-parchment text-ink shadow-[var(--shadow-inset)]" : "text-white [text-shadow:0_1px_0_rgb(0_0_0/0.4)]",
              available ? "hover:bg-white/15" : "cursor-not-allowed",
            );
            return (
              <li key={item.key}>
                {available ? (
                  <Link href={item.href} aria-current={active ? "page" : undefined} aria-label={label.english} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <span role="link" aria-disabled="true" aria-label={`${label.english} (${c("comingSoon").english})`} title={c("comingSoon").regional} className={cls}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <BilingualText className="sr-only" text={c("appName")} />
    </div>
  );
}
