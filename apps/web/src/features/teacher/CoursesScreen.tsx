"use client";
import Link from "next/link";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, EmptyState, ErrorState, LoadingState, ProgressBar, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { PageTitle, Pill } from "./shared";

export interface CoursesScreenProps {
  courses: Schemas["CourseSummary"][] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

const SUBJECT_ICON = { BI: "leaf", CH: "flask", PH: "calc" } as const;

export function CoursesScreen(p: CoursesScreenProps) {
  const t = useBilingual("teacher");
  const tri = useTri();
  const newButton = (
    <ChunkyButton asChild size="sm">
      <Link href="/teacher/courses/new" data-testid="new-course">
        <StickerIcon name="plus" size={20} />
        <BilingualText as="span" size="sm" tone="inverse" text={t("newCourse")} />
      </Link>
    </ChunkyButton>
  );
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.courses) return <LoadingState className="min-h-[50vh]" />;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle text={t("coursesTitle")} icon="books" action={newButton} />
      {p.courses.length === 0 ? (
        <EmptyState message={t("noCourses")} action={newButton} />
      ) : (
        <ul className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {p.courses.map((c) => (
            <li key={c.id}>
              <Link href={`/teacher/courses/${c.id}`} className="block h-full rounded-card focus-visible:outline-4">
                <Card className="flex h-full flex-col gap-3 hover:bg-white">
                  <div className="flex items-start gap-3">
                    <StickerIcon name={SUBJECT_ICON[c.subject as keyof typeof SUBJECT_ICON] ?? "book"} size={36} />
                    <BilingualText as="h2" size="lg" text={tri(c.title)} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Pill tone={c.status === "published" ? "good" : "info"}>{(c.status === "published" ? t("statusPublished") : t("statusDraft")).regional}</Pill>
                    <Pill>{t("gradeN", { n: c.grade }).regional}</Pill>
                    {c.is_personal && <Pill>{t("personal").regional}</Pill>}
                    {c.ai_made && <Pill tone="info">{t("aiMade").regional}</Pill>}
                  </div>
                  <ProgressBar value={c.lesson_count ? c.published_count / c.lesson_count : 0} label={t("publishedOf", { n: c.published_count, total: c.lesson_count }).english} />
                  <BilingualText size="sm" text={t("publishedOf", { n: c.published_count, total: c.lesson_count })} />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
