"use client";
import Link from "next/link";
import type { Material, TeacherOverview } from "@mooshala/api-client";
import { Hero } from "@/components/playful";
import { BilingualText, Card, ChunkyButton, ErrorState, LoadingState, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { MeterRow, Ring } from "./charts";
import { Pill, StatTile, pct } from "./shared";

/** Stateless: everything across the teacher's classes, above the per-class overview. */
export function AllClassesPanel({ data, loading, error, onRetry, formatTime }: { data: TeacherOverview | undefined; loading: boolean; error: unknown; onRetry: () => void; formatTime: (iso: string) => string }) {
  const t = useBilingual("allClasses");
  const tt = useBilingual("teacher");
  const tri = useTri();
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <section aria-labelledby="all-classes" className="mb-6 flex flex-col gap-4" data-testid="all-classes">
      <Hero tone="sun" pose="cool" titleAs="h2" eyebrow={t("title")} title={tt("heroTitle")} subtitle={data.classes[0] ? tt("heroJoin", { key: data.classes[0].join_key }) : undefined} />
      <span id="all-classes" className="sr-only">
        {t("title").english}
      </span>
      <div className="grid grid-cols-2 gap-3 laptop:grid-cols-4">
        <StatTile icon="school" value={String(data.class_count)} label={t("classes")} />
        <StatTile icon="people" value={String(data.student_count)} label={t("students")} />
        <StatTile icon="target" value={pct(data.accuracy)} label={t("avgScore")} />
        <StatTile icon="book" value={pct(data.completion)} label={t("completion")} />
      </div>
      <div className="grid gap-4 laptop:grid-cols-3">
        <Card className="flex flex-col gap-3 p-4">
          <BilingualText as="h3" size="lg" text={t("byClass")} />
          {data.classes.map((c) => (
            <Link key={c.id} href={`/teacher/classes/${c.id}`} className="rounded-card hover:bg-sun-soft/60">
              <MeterRow label={{ regional: c.name, english: `${c.student_count} · ${tt(`subject${c.subject}`).english}` }} value={c.accuracy} />
            </Link>
          ))}
          {data.subjects.length > 0 && <BilingualText as="h3" size="base" text={t("bySubject")} />}
          {data.subjects.map((s) => (
            <MeterRow key={s.subject} label={tt(`subject${s.subject}`)} value={s.accuracy} />
          ))}
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <Ring value={data.accuracy} label={t("avgScore").english} size={80} />
            <BilingualText as="h3" size="lg" text={t("doingWell")} />
          </div>
          {data.doing_well.length ? (
            <ul className="flex flex-col gap-2">
              {data.doing_well.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <StickerIcon name="star" size={22} />
                  <span className="flex-1 font-bold">{s.name}</span>
                  <Pill tone="good">{pct(s.accuracy)}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <BilingualText size="sm" text={t("noneYet")} />
          )}
          <BilingualText as="h3" size="lg" text={t("needsAttention")} />
          {data.needs_attention.length ? (
            <ul className="flex flex-col gap-2">
              {data.needs_attention.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <StickerIcon name="snail" size={22} />
                  <span className="flex-1 font-bold">{s.name}</span>
                  <Pill tone="warn">{s.idle ? tt("idleDays", { n: s.idle_days }).regional : pct(s.accuracy)}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <BilingualText size="sm" text={tt("nobodyBehind")} />
          )}
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <BilingualText as="h3" size="lg" text={t("recent")} />
          {data.recent.length ? (
            <ul className="flex flex-col gap-2" data-testid="recent-activity">
              {data.recent.map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded-card bg-white p-2">
                  <StickerIcon name="sprout" size={22} />
                  <div className="flex-1">
                    <BilingualText size="sm" text={t("finished", { name: r.student, lesson: tri(r.title).english })} />
                    <span className="text-xs text-stone">
                      {formatTime(r.at)} · {pct(r.accuracy)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <BilingualText size="sm" text={t("noneYet")} />
          )}
        </Card>
      </div>
    </section>
  );
}

/** Stateless: uploaded materials with file names, formats and where they stand. */
export function MaterialsPanel({ items, loading, error, onRetry, onDelete, deletingId }: { items: Material[] | undefined; loading: boolean; error: unknown; onRetry: () => void; onDelete?: (m: Material) => void; deletingId?: string | null }) {
  const t = useBilingual("materials");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <Card className="mb-6 flex flex-col gap-3 p-4" data-testid="materials">
      <div className="flex flex-wrap items-center gap-2">
        <StickerIcon name="doc" size={30} />
        <BilingualText as="h2" size="lg" text={t("title")} className="flex-1" />
        <Link href="/teacher/courses/new" className="font-bold text-sky-strong underline">
          {t("upload").regional} · {t("upload").english}
        </Link>
      </div>
      {!items?.length ? (
        <BilingualText size="sm" text={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-card border-2 border-line bg-white p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {m.files.map((f, i) => (
                  <span key={i} className="flex items-center gap-2 truncate text-sm font-bold">
                    <StickerIcon name={f.kind === "photo" ? "camera" : f.kind === "pdf" ? "doc" : "pencil"} size={20} />
                    {f.name}
                    <Pill>{t(`kind_${f.kind}`).regional}</Pill>
                  </span>
                ))}
                {m.classroom && <span className="text-xs text-stone">{m.classroom}</span>}
              </div>
              <Pill tone={m.status === "published" ? "good" : m.status === "review" ? "info" : "plain"}>
                {t(`status_${m.status}`).regional} · {t(`status_${m.status}`).english}
              </Pill>
              {m.course_id && (
                <Link href={`/teacher/courses/${m.course_id}`} className="text-sm font-bold text-sky-strong underline">
                  {t("review").regional} · {t("review").english}
                </Link>
              )}
              {onDelete && (
                <ChunkyButton size="sm" variant="ghost" loading={deletingId === m.id} onClick={() => onDelete(m)} aria-label={t("deleteFiles").english} title={t("deleteFiles").english} data-testid={`delete-upload-${m.id}`}>
                  <StickerIcon name="trash" size={18} />
                  <span className="text-sm font-bold text-coral-strong">{t("deleteFiles").regional}</span>
                </ChunkyButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
