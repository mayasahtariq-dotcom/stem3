"use client";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, EmptyState, ErrorState, LoadingState, ProgressBar, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { needsHelp } from "./students";
import { PageTitle, Pill, StatTile, pct } from "./shared";

export interface OverviewScreenProps {
  data: Schemas["DashboardOut"] | undefined;
  loading: boolean;
  error: unknown;
  noClasses: boolean;
  consentSaving: boolean;
  onToggleConsent: (enabled: boolean) => void;
  onOpenStudent: (id: string) => void;
  onRetry: () => void;
}

/** Class overview: this week's tiles, who needs help, weak topics, join key and school consent. */
export function OverviewScreen(p: OverviewScreenProps) {
  const t = useBilingual("teacher");
  const tri = useTri();
  if (p.noClasses) return <EmptyState message={t("empty")} className="min-h-[50vh]" />;
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.data) return <LoadingState className="min-h-[50vh]" />;
  const d = p.data;
  const help = needsHelp(d.students);
  return (
    <div className="flex flex-col gap-5">
      <PageTitle text={{ regional: d.name, english: t("overviewTitle").english }} icon="chart" />
      <section aria-label={t("thisWeek").english} className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        <StatTile icon="people" value={`${d.tiles.active_this_week}/${d.tiles.student_count}`} label={t("activeThisWeek")} />
        <StatTile icon="target" value={pct(d.tiles.accuracy)} label={t("classAccuracy")} />
        <StatTile icon="snail" value={String(d.tiles.behind)} label={t("behind")} tone={d.tiles.behind ? "warn" : "default"} />
        <StatTile icon="books" value={String(d.courses.length)} label={t("coursesAssigned")} />
      </section>

      {d.students.length === 0 ? (
        <EmptyState message={t("noStudents", { key: d.join_key })} />
      ) : (
        <div className="grid gap-5 desktop:grid-cols-2">
          <Card>
            <BilingualText as="h2" size="lg" text={t("needsHelp")} className="mb-3" />
            {help.length === 0 ? (
              <BilingualText size="sm" text={t("nobodyBehind")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {help.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => p.onOpenStudent(s.id)} className="flex min-h-11 w-full items-center gap-3 rounded-card bg-white px-3 py-2 text-left shadow-float-1 hover:bg-cloud">
                      <StickerIcon name={s.idle ? "timer" : "snail"} size={28} />
                      <span className="font-bold">{s.name}</span>
                      <span className="ml-auto flex flex-wrap justify-end gap-1">
                        {s.idle && <Pill tone="warn">{t("idleDays", { n: s.idle_days }).regional}</Pill>}
                        {s.overdue > 0 && <Pill tone="warn">{t("overdueN", { n: s.overdue }).regional}</Pill>}
                        {s.accuracy !== null && s.accuracy < 0.6 && <Pill tone="warn">{pct(s.accuracy)}</Pill>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <BilingualText as="h2" size="lg" text={t("weakTopics")} className="mb-3" />
            {d.weak_topics.length === 0 ? (
              <BilingualText size="sm" text={t("noWeakTopics")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {d.weak_topics.map((w) => (
                  <li key={w.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <BilingualText as="span" size="sm" text={tri(w.name)} />
                      <span className="ml-auto text-sm font-bold tabular-nums">{pct(w.accuracy)}</span>
                    </div>
                    <ProgressBar value={w.accuracy} tone="sun" label={`${tri(w.name).english} ${pct(w.accuracy)}`} />
                    <BilingualText size="sm" text={t("lowMastery", { n: w.low_mastery_students, attempts: w.attempts })} className="text-stone" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-5 desktop:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <BilingualText as="h2" size="lg" text={t("joinKey")} />
          <p className="font-mono text-3xl font-extrabold tracking-widest" data-testid="join-key">
            {d.join_key}
          </p>
          <BilingualText size="sm" text={t("joinKeyHint")} />
        </Card>
        <Card className="flex flex-col gap-3">
          <BilingualText as="h2" size="lg" text={t("schoolConsent")} />
          <BilingualText size="sm" text={t("schoolConsentHint")} />
          <div className="flex items-center gap-3">
            <Pill tone={d.school_consent ? "good" : "plain"}>{(d.school_consent ? t("consentOn") : t("consentOff")).regional}</Pill>
            <ChunkyButton
              size="sm"
              variant="white"
              loading={p.consentSaving}
              onClick={() => p.onToggleConsent(!d.school_consent)}
              aria-pressed={d.school_consent}
              data-testid="school-consent"
            >
              <BilingualText as="span" size="sm" text={d.school_consent ? t("turnOff") : t("turnOn")} />
            </ChunkyButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
