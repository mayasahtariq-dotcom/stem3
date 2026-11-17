"use client";
import type { GameStats, Schemas } from "@mooshala/api-client";
import {
  BilingualText,
  Card,
  ErrorState,
  GoluMascot,
  LoadingState,
  StickerIcon,
  XPRing,
  type StickerIconName,
} from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";

export const DAILY_GOALS = [30, 50, 100] as const;

export interface ProfileScreenProps {
  name: string;
  stats: Schemas["StatsOut"] | undefined;
  statsError: unknown;
  game: GameStats | undefined;
  savingGoal: number | null;
  onGoal: (g: (typeof DAILY_GOALS)[number]) => void;
  onRetry: () => void;
  formatTime: (iso: string) => string;
  /** Phase 4 adds badges and Golu's growth here. */
  children?: React.ReactNode;
}

/** The student's backpack: numbers from the server, the daily goal picker, gems and freezes. */
export function ProfileScreen(p: ProfileScreenProps) {
  const t = useBilingual("profile");
  if (p.statsError)
    return <ErrorState error={p.statsError} onRetry={p.onRetry} className="h-full" />;
  if (!p.stats) return <LoadingState className="h-full" />;
  const s = p.stats;
  const tiles: { icon: StickerIconName; value: string; label: ReturnType<typeof t> }[] = [
    { icon: "star", value: String(s.xp_total), label: t("xpTotal") },
    { icon: "flame", value: String(s.streak), label: t("streak") },
    { icon: "trophy", value: String(s.longest_streak), label: t("longest") },
    { icon: "heart", value: `${s.hearts}/${s.max_hearts}`, label: t("hearts") },
  ];
  if (p.game)
    tiles.push(
      { icon: "sparkle", value: String(p.game.gems), label: t("gems") },
      { icon: "calendar", value: `${p.game.freezes}/${p.game.max_freezes}`, label: t("freezes") },
    );
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-32 pt-20 laptop:max-w-4xl laptop:px-8 laptop:pb-12 laptop:pt-8">
      <header className="flex items-center gap-3">
        <GoluMascot pose="cool" size={80} />
        <div>
          <h1 className="text-2xl font-extrabold">{p.name}</h1>
          <BilingualText size="sm" text={t("subtitle")} />
        </div>
      </header>
      <ul className="grid grid-cols-2 gap-3 tablet:grid-cols-3">
        {tiles.map((x) => (
          <li key={x.label.english}>
            <Card className="flex items-center gap-3 p-3">
              <StickerIcon name={x.icon} size={32} />
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tabular-nums">{x.value}</span>
                <span>
                  <BilingualText as="span" size="sm" text={x.label} />
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {s.refill_at && (
        <BilingualText size="sm" text={t("nextHeart", { time: p.formatTime(s.refill_at) })} />
      )}
      <section aria-labelledby="goal-h" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <XPRing
            value={s.xp_today}
            goal={s.daily_goal}
            label={t("today", { xp: s.xp_today, goal: s.daily_goal }).english}
          />
          <div>
            <BilingualText as="h2" size="lg" text={t("dailyGoal")} />
            <span id="goal-h" className="sr-only">
              {t("dailyGoal").english}
            </span>
            <BilingualText size="sm" text={t("today", { xp: s.xp_today, goal: s.daily_goal })} />
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label={t("dailyGoal").english}
          className="grid grid-cols-3 gap-2"
        >
          {DAILY_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={s.daily_goal === g}
              disabled={p.savingGoal !== null}
              onClick={() => p.onGoal(g)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-card border-2 border-b-4 font-bold",
                s.daily_goal === g
                  ? "border-grass-strong bg-[#ecf8e4]"
                  : "border-line bg-white hover:bg-cream",
                p.savingGoal === g && "opacity-60",
              )}
            >
              <span className="text-lg tabular-nums">{g} XP</span>
              <span className="text-xs font-medium text-stone">{t(`goal${g}`).regional}</span>
            </button>
          ))}
        </div>
      </section>
      {p.children}
    </div>
  );
}
