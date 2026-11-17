"use client";
import Link from "next/link";
import type { CallSession, CallStudent, CallTwin } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, EmptyState, ErrorState, LoadingState, Pill, ProgressBar, StickerIcon } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { DAY_KEYS, formatTime, isLive, statusBlock } from "./rules";

export interface CallsScreenProps {
  students: CallStudent[] | undefined;
  loading: boolean;
  error: unknown;
  noClasses: boolean;
  selectedId: string | null;
  call: CallSession | null;
  starting: boolean;
  callError: unknown;
  twin: CallTwin | undefined;
  twinLoading: boolean;
  twinError: unknown;
  pausingId: string | null;
  /** fake mode only: the demo clock control */
  demo: { now: string | null; busy: boolean; onEvening: () => void; onReal: () => void } | null;
  onSelect: (id: string) => void;
  onCallNow: (id: string) => void;
  onTogglePause: (s: CallStudent) => void;
  onRetry: () => void;
  formatDateTime: (iso: string) => string;
}

const STATUS_TONE = { waiting_consent: "info", scheduled: "good", in_call: "good", retry_pending: "warn", not_reachable: "warn", paused: "plain", cap_reached: "plain" } as const;

/** Call console: students who learn by phone, their status, and the live call. */
export function CallsScreen(p: CallsScreenProps) {
  const t = useBilingual("calls");
  const errors = useBilingual("errors");
  const tri = useTri();
  const add = (
    <ChunkyButton asChild size="sm">
      <Link href="/teacher/calls/new" data-testid="add-call-student">
        <StickerIcon name="plus" size={20} />
        <BilingualText as="span" size="sm" tone="inverse" text={t("addStudent")} />
      </Link>
    </ChunkyButton>
  );
  if (p.noClasses) return <EmptyState message={t("noClass")} className="min-h-[50vh]" />;
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.students) return <LoadingState className="min-h-[50vh]" />;
  const selected = p.students.find((s) => s.id === p.selectedId) ?? null;
  const days = (d: number[]) => d.map((x) => t(DAY_KEYS[x] ?? "mon").regional).join(" ");
  const live = isLive(p.call?.state);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <StickerIcon name="speaker" size={36} />
        <BilingualText as="h1" size="2xl" text={t("title")} />
        <div className="ml-auto">{add}</div>
      </div>
      <BilingualText size="sm" text={t("rulesHint")} className="text-stone" />
      {p.demo && (
        <Card className="flex flex-wrap items-center gap-2 border-dashed p-3" data-testid="demo-clock">
          <StickerIcon name="timer" size={22} />
          <BilingualText as="span" size="sm" text={t("demoClock", { now: p.demo.now ? p.formatDateTime(p.demo.now) : "–" })} className="flex-1" />
          <ChunkyButton size="sm" variant="white" onClick={p.demo.onEvening} loading={p.demo.busy} data-testid="demo-evening">
            <BilingualText as="span" size="sm" text={t("demoEvening")} />
          </ChunkyButton>
          <ChunkyButton size="sm" variant="ghost" onClick={p.demo.onReal} disabled={p.demo.busy}>
            <BilingualText as="span" size="sm" text={t("demoReal")} />
          </ChunkyButton>
        </Card>
      )}
      {p.students.length === 0 ? (
        <EmptyState message={t("empty")} action={add} />
      ) : (
        <div className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2" aria-label={t("listLabel").english}>
            {p.students.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => p.onSelect(s.id)}
                  aria-pressed={s.id === p.selectedId}
                  data-testid={`call-student-${s.id}`}
                  className={cn("flex w-full flex-col gap-2 rounded-card border-2 bg-white p-3 text-left shadow-float-1", s.id === p.selectedId ? "border-grass-strong" : "border-line")}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold">{s.name}</span>
                    <span className="text-sm text-stone">···{s.phone_last4}</span>
                    <span className="ml-auto">
                      <Pill tone={STATUS_TONE[s.status]}>{t(`status_${s.status}`).regional}</Pill>
                    </span>
                  </span>
                  <span className="text-sm">
                    {formatTime(s.window.start)} – {formatTime(s.window.end)} · {days(s.days)} · {t(`lang_${s.language}`).regional}
                  </span>
                  <ProgressBar value={s.minutes_this_week / s.weekly_cap_minutes} tone="sky" label={t("minutesUsed", { n: s.minutes_this_week, cap: s.weekly_cap_minutes }).english} />
                  <BilingualText as="span" size="sm" text={t("minutesUsed", { n: s.minutes_this_week, cap: s.weekly_cap_minutes })} />
                </button>
              </li>
            ))}
          </ul>

          <Card className="flex flex-col gap-4 self-start" aria-label={t("consoleLabel").english}>
            {!selected ? (
              <BilingualText text={t("pickStudent")} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold">{selected.name}</h2>
                  <Pill tone={STATUS_TONE[selected.status]}>{t(`status_${selected.status}`).regional}</Pill>
                </div>
                <BilingualText size="sm" text={statusDetail(selected, t, p.formatDateTime)} />

                <div aria-live="polite" data-testid="call-panel" data-state={p.call?.state ?? "none"} className="rounded-card bg-sky-soft p-3">
                  {p.call ? (
                    <div className="flex items-center gap-2">
                      <StickerIcon name={p.call.state === "connected" ? "speaker" : live ? "timer" : p.call.state === "completed" ? "star" : "warn"} size={28} />
                      <BilingualText
                        text={t(`call_${p.call.state}`, { n: p.call.minutes, attempt: p.call.attempt, time: p.call.retry_at ? p.formatDateTime(p.call.retry_at) : "" })}
                      />
                    </div>
                  ) : (
                    <BilingualText size="sm" text={t("noLiveCall")} />
                  )}
                </div>

                {p.callError !== null && p.callError !== undefined && (
                  <p role="alert" className="text-sm font-bold text-coral-strong">
                    {errors(asApiError(p.callError).code).regional} · {errors(asApiError(p.callError).code).english}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const block = statusBlock(selected, live);
                    return (
                      <ChunkyButton onClick={() => p.onCallNow(selected.id)} disabled={Boolean(block) || p.starting} loading={p.starting} data-testid="call-now" title={block ? errors(block).english : undefined}>
                        <StickerIcon name="speaker" size={20} />
                        <BilingualText as="span" size="sm" tone="inverse" text={t("callNow")} />
                      </ChunkyButton>
                    );
                  })()}
                  <ChunkyButton variant="white" size="sm" onClick={() => p.onTogglePause(selected)} loading={p.pausingId === selected.id} disabled={selected.status === "in_call"} data-testid="toggle-pause">
                    <BilingualText as="span" size="sm" text={selected.status === "paused" ? t("resume") : t("pause")} />
                  </ChunkyButton>
                </div>

                <section className="flex flex-col gap-2 border-t-2 border-line pt-3" data-testid="twin">
                  <BilingualText as="h3" size="lg" text={t("twinTitle")} />
                  {p.twinError ? (
                    <BilingualText size="sm" text={t("twinFailed")} className="text-coral-strong" />
                  ) : p.twinLoading || !p.twin ? (
                    <LoadingState />
                  ) : (
                    <>
                      <BilingualText text={tri(p.twin.summary)} />
                      {p.twin.weak.length > 0 && <BilingualText size="sm" text={t("twinWeak", { topics: p.twin.weak.map((w) => tri(w).regional).join(", "), topicsEn: p.twin.weak.map((w) => w.en).join(", ") })} />}
                    </>
                  )}
                </section>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function statusDetail(s: CallStudent, t: ReturnType<typeof useBilingual>, fmt: (iso: string) => string) {
  switch (s.status) {
    case "retry_pending":
      return t("detail_retry", { time: s.next_call_at ? fmt(s.next_call_at) : "" });
    case "scheduled":
      return s.next_call_at ? t("detail_next", { time: fmt(s.next_call_at) }) : t("detail_scheduled");
    case "cap_reached":
      return t("detail_cap", { cap: s.weekly_cap_minutes });
    default:
      return t(`detail_${s.status}`);
  }
}
