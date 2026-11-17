"use client";
import type { Quest } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, EmptyState, ErrorState, LoadingState, QuestCard, StickerIcon, WoodPanel, type StickerIconName } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { sortQuests, timeLeft } from "./rules";

export interface QuestsScreenProps {
  quests: Quest[] | undefined;
  loading: boolean;
  error: unknown;
  claimingId: string | null;
  now: number;
  onClaim: (id: string) => void;
  onRetry: () => void;
}

const KIND_ICON: Record<Quest["kind"], StickerIconName> = { answer_questions: "puzzle", combo: "flame", finish_lessons: "book", perfect_lesson: "star", earn_xp: "sparkle" };

/** The quest board on the farm: daily and weekly jobs, claimed once for gems. */
export function QuestsScreen(p: QuestsScreenProps) {
  const t = useBilingual("game");
  const tri = useTri();
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="h-full" />;
  if (p.loading || !p.quests) return <LoadingState className="h-full" />;
  const qs = sortQuests(p.quests);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-32 pt-20 laptop:max-w-4xl laptop:px-8 laptop:pb-12 laptop:pt-8">
      <WoodPanel>
        <div className="flex items-center gap-3">
          <StickerIcon name="quests" size={40} />
          <BilingualText as="h1" size="2xl" text={t("questsTitle")} />
        </div>
        <BilingualText size="sm" text={t("questsHint")} className="mt-1" />
      </WoodPanel>
      {qs.length === 0 ? (
        <EmptyState message={t("noQuests")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {qs.map((q) => {
            const left = timeLeft(q.ends_at, p.now);
            return (
              <li key={q.id} className="flex flex-col gap-2" data-testid={`quest-${q.period}-${q.kind}`} data-state={q.state}>
                <QuestCard title={tri(q.title)} progress={q.progress} goal={q.goal} progressLabel={t("questProgress", { n: q.progress, goal: q.goal }).english} icon={KIND_ICON[q.kind]} done={q.state !== "active"} />
                <div className="flex items-center gap-2 px-1">
                  <BilingualText as="span" size="sm" text={q.period === "daily" ? t("endsHours", { h: left.hours + left.days * 24 }) : t("endsDays", { d: left.days, h: left.hours })} className="flex-1 text-stone" />
                  {q.state === "complete" && (
                    <ChunkyButton size="sm" onClick={() => p.onClaim(q.id)} loading={p.claimingId === q.id} disabled={p.claimingId !== null} data-testid="claim-quest">
                      <BilingualText as="span" size="sm" tone="inverse" text={t("claim", { n: q.reward_gems })} />
                    </ChunkyButton>
                  )}
                  {q.state === "claimed" && <BilingualText as="span" size="sm" text={t("claimed")} className="font-bold text-grass-strong" />}
                  {q.state === "active" && <BilingualText as="span" size="sm" text={t("reward", { n: q.reward_gems })} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
