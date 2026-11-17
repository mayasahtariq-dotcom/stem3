"use client";
import type { League } from "@mooshala/api-client";
import { BilingualText, EmptyState, ErrorState, LeagueRow, LoadingState, StickerIcon, WoodPanel } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { leagueZone, timeLeft } from "./rules";

export interface LeagueScreenProps {
  league: League | undefined;
  loading: boolean;
  error: unknown;
  now: number;
  onRetry: () => void;
}

/** The village fair noticeboard: this week's XP, never gems. */
export function LeagueScreen(p: LeagueScreenProps) {
  const t = useBilingual("game");
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="h-full" />;
  if (p.loading || !p.league) return <LoadingState className="h-full" />;
  const l = p.league;
  if (!l.enabled) return <EmptyState message={t("leagueOff")} className="h-full" />;
  const left = timeLeft(l.week_ends_at, p.now);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-32 pt-20 laptop:max-w-4xl laptop:px-8 laptop:pb-12 laptop:pt-8">
      <WoodPanel>
        <div className="flex items-center gap-3">
          <StickerIcon name="trophy" size={40} />
          <div className="flex-1">
            <BilingualText as="h1" size="2xl" text={t("leagueTitle")} />
            <BilingualText size="sm" text={t(`tier_${l.tier}`)} />
          </div>
        </div>
        <BilingualText size="sm" text={t("leagueHint", { d: left.days, h: left.hours, up: l.promote_count })} className="mt-2" />
      </WoodPanel>
      {l.members.length === 0 ? (
        <EmptyState message={t("leagueEmpty")} />
      ) : (
        <ol className="flex flex-col gap-2" aria-label={t("leagueTitle").english} data-testid="league-board">
          {l.members.map((m) => (
            <li key={`${m.rank}-${m.name}`}>
              <LeagueRow rank={m.rank} name={m.name} xp={m.weekly_xp} xpLabel={t("weeklyXp", { n: m.weekly_xp }).english} isSelf={m.is_self} callOnly={m.call_only} callOnlyLabel={t("callOnly").english} zone={leagueZone(m.rank, l)} />
            </li>
          ))}
        </ol>
      )}
      <BilingualText size="sm" text={t("leagueFair")} className="text-stone" />
    </div>
  );
}
