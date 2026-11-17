"use client";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, ErrorState, LoadingState, ProgressBar, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { PageTitle, Pill, StatTile, pct } from "./shared";

export interface StudentDetailScreenProps {
  data: Schemas["StudentDetailOut"] | undefined;
  loading: boolean;
  error: unknown;
  onBack: () => void;
  onRetry: () => void;
  formatDate: (iso: string) => string;
}

const TREND_TONE = { improving: "good", steady: "info", needs_practice: "warn" } as const;

export function StudentDetailScreen(p: StudentDetailScreenProps) {
  const t = useBilingual("teacher");
  const tri = useTri();
  const back = (
    <ChunkyButton size="sm" variant="ghost" onClick={p.onBack}>
      <BilingualText as="span" size="sm" text={t("backToStudents")} />
    </ChunkyButton>
  );
  if (p.error) return <div>{back}<ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[40vh]" /></div>;
  if (p.loading || !p.data) return <LoadingState className="min-h-[50vh]" />;
  const d = p.data;
  const trend = (d.trend in TREND_TONE ? d.trend : "steady") as keyof typeof TREND_TONE;
  return (
    <div className="flex flex-col gap-5">
      {back}
      <PageTitle text={{ regional: d.name, english: d.name }} icon="backpack" action={<Pill tone={TREND_TONE[trend]}>{t(`trend_${trend}`).regional}</Pill>} />
      <section className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        <StatTile icon="flame" value={String(d.streak)} label={t("colStreak")} />
        <StatTile icon="book" value={String(d.lessons_completed)} label={t("lessonsDone")} />
        <StatTile icon="calendar" value={d.last_active ? p.formatDate(d.last_active) : "–"} label={t("lastActive")} />
        <StatTile icon="timer" value={d.usual_hour === null ? "–" : `${d.usual_hour}:00`} label={t("usualTime")} />
      </section>
      <div className="grid gap-5 desktop:grid-cols-2">
        <Card>
          <BilingualText as="h2" size="lg" text={t("lessonResults")} className="mb-3" />
          {d.lessons.length === 0 ? (
            <BilingualText size="sm" text={t("noLessonsYet")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {d.lessons.map((l) => (
                <li key={l.lesson_id} className="flex items-center gap-3">
                  <StickerIcon name={l.completed ? "star" : "lock"} size={22} />
                  <BilingualText as="span" size="sm" text={tri(l.title)} />
                  <span className="ml-auto font-bold tabular-nums">{l.completed ? pct(l.accuracy) : "–"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-4">
          <div>
            <BilingualText as="h2" size="lg" text={t("weakestConcepts")} className="mb-3" />
            {d.weakest.length === 0 ? (
              <BilingualText size="sm" text={t("noWeakTopics")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {d.weakest.map((w, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <div className="flex items-baseline">
                      <BilingualText as="span" size="sm" text={tri(w.name)} />
                      <span className="ml-auto text-sm font-bold tabular-nums">{pct(w.mastery)}</span>
                    </div>
                    <ProgressBar value={w.mastery} tone="sun" label={`${tri(w.name).english} ${pct(w.mastery)}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <BilingualText as="h2" size="lg" text={t("confusions")} className="mb-2" />
            {d.confusions.length === 0 ? (
              <BilingualText size="sm" text={t("noConfusions")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.confusions.map((c, i) => (
                  <li key={i}>
                    <BilingualText
                      size="sm"
                      text={t("confusedWith", { expected: tri(c.expected).regional, chosen: tri(c.chosen).regional, expectedEn: tri(c.expected).english, chosenEn: tri(c.chosen).english, n: c.count })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
