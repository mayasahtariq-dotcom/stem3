"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TopStatsBar, XPRing } from "@/components/game";
import { QuestList } from "@/components/QuestList";
import { BilingualText, Card, StickerIcon } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useStats } from "@/lib/queries";

const NAV = [["/learn", "learn", "nav.learn"], ["/quests", "quest", "nav.quests"],
             ["/league", "league", "nav.league"], ["/profile", "profile", "nav.profile"]] as const;

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate role="student"><Shell>{children}</Shell></AuthGate>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t, bi } = useT();
  const stats = useStats();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px]">
      {/* Left rail on desktop */}
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-2 border-r-2 border-line bg-white p-4 md:flex">
        <div className="mb-4 px-2 text-3xl font-black text-grass">Aaroh</div>
        {NAV.map(([href, icon, key]) => (
          <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}
            className={clsx("flex min-h-11 items-center gap-3 rounded-[12px] border-2 px-3 py-2 font-bold uppercase tracking-wide",
              path.startsWith(href) ? "border-sky/40 bg-sky/10 text-sky" : "border-transparent text-muted hover:bg-cloud")}>
            <StickerIcon name={icon} size={30} />{t(key)}</Link>))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b-2 border-line bg-white/95 backdrop-blur lg:hidden">
          {stats.data && <TopStatsBar stats={stats.data} />}
        </header>
        <main className="flex-1 px-4 pb-28 pt-4 md:pb-8">{children}</main>
      </div>

      {/* Right panel on wide screens */}
      <aside className="sticky top-0 hidden h-dvh w-80 shrink-0 space-y-4 overflow-y-auto p-4 lg:block">
        {stats.data && <>
          <Card><TopStatsBar stats={stats.data} /></Card>
          <Card className="flex items-center gap-4">
            <XPRing value={stats.data.today_xp} goal={stats.data.daily_goal} />
            <BilingualText regional={bi("learn.dailyGoal").regional} english={bi("learn.dailyGoal").english} />
          </Card>
        </>}
        <Card><h2 className="mb-3 font-bold">{t("learn.todayQuests")}</h2><QuestList compact /></Card>
      </aside>

      {/* Bottom tab bar under 768 px */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t-2 border-line bg-white py-2 md:hidden">
        {NAV.map(([href, icon, key]) => (
          <Link key={href} href={href} aria-label={t(key)} aria-current={path.startsWith(href) ? "page" : undefined}
            className={clsx("flex min-h-11 min-w-11 flex-col items-center rounded-[12px] px-3 py-1 text-xs font-bold",
              path.startsWith(href) ? "bg-sky/10 text-sky" : "text-muted")}>
            <StickerIcon name={icon} size={28} />{t(key)}</Link>))}
      </nav>
    </div>
  );
}
