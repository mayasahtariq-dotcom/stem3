"use client";
import Link from "next/link";
import { useRef } from "react";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, ErrorState, ProgressBar, StickerIcon } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { ACCEPT, formatBytes, formProblem, pageProblem, UPLOAD_RULES, type PageDraft, type UploadMeta, type UploadRun } from "./upload";
import { PageTitle, Pill } from "./shared";

export const PIPELINE_STEPS = ["queued", "reading", "chunking", "outlining", "terms", "lesson_1", "ready"] as const;

export interface UploadScreenProps {
  pages: PageDraft[];
  meta: UploadMeta;
  classes: Schemas["ClassroomOut"][];
  typed: string;
  run: UploadRun;
  pollError: unknown;
  onTyped: (text: string) => void;
  onAddTyped: () => void;
  onFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  onMeta: (m: UploadMeta) => void;
  onSubmit: () => void;
  onRetryPage: (index: number) => void;
  onRetryStart: () => void;
  onReset: () => void;
}

const SUBJECTS = [
  ["BI", "subjectBI"],
  ["CH", "subjectCH"],
  ["PH", "subjectPH"],
] as const;

/** Make a course from notes: pick pages, check them, upload with progress, then watch the AI steps. */
export function UploadScreen(p: UploadScreenProps) {
  const t = useBilingual("teacher");
  const errors = useBilingual("errors");
  const fileInput = useRef<HTMLInputElement>(null);
  const editing = p.run.phase === "editing";
  const problem = formProblem(p.pages, p.meta);
  const PAGE_PROBLEM = { wrongType: "pageWrongType", tooLarge: "pageTooLarge", emptyText: "pageEmpty" } as const;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <ChunkyButton asChild size="sm" variant="ghost" className="self-start">
        <Link href="/teacher/courses">
          <BilingualText as="span" size="sm" text={t("backToCourses")} />
        </Link>
      </ChunkyButton>
      <PageTitle text={t("uploadTitle")} icon="camera" />

      {editing && (
        <>
          <Card className="grid gap-4 tablet:grid-cols-3">
            <label className="flex flex-col gap-1 font-semibold">
              <BilingualText as="span" size="sm" text={t("subject")} />
              <select value={p.meta.subject} onChange={(e) => p.onMeta({ ...p.meta, subject: e.target.value as UploadMeta["subject"] })} className="min-h-11 rounded-button border-2 border-line bg-white px-3">
                {SUBJECTS.map(([v, k]) => (
                  <option key={v} value={v}>
                    {t(k).regional} · {t(k).english}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              <BilingualText as="span" size="sm" text={t("grade")} />
              <select value={p.meta.grade} onChange={(e) => p.onMeta({ ...p.meta, grade: Number(e.target.value) })} className="min-h-11 rounded-button border-2 border-line bg-white px-3">
                {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              <BilingualText as="span" size="sm" text={t("forClass")} />
              <select value={p.meta.classroomId ?? ""} onChange={(e) => p.onMeta({ ...p.meta, classroomId: e.target.value || null })} className="min-h-11 rounded-button border-2 border-line bg-white px-3">
                {p.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="">{t("personal").regional} · {t("personal").english}</option>
              </select>
            </label>
          </Card>

          <Card className="flex flex-col gap-4">
            <BilingualText as="h2" size="lg" text={t("addPages", { max: UPLOAD_RULES.maxPages })} />
            <BilingualText size="sm" text={t("pageRules")} className="text-stone" />
            <div className="flex flex-wrap gap-2">
              <ChunkyButton variant="white" size="sm" onClick={() => fileInput.current?.click()} disabled={p.pages.length >= UPLOAD_RULES.maxPages}>
                <StickerIcon name="image" size={20} />
                <BilingualText as="span" size="sm" text={t("addFiles")} />
              </ChunkyButton>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                data-testid="file-input"
                aria-label={t("addFiles").english}
                onChange={(e) => {
                  p.onFiles([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </div>
            <label className="flex flex-col gap-2 font-semibold">
              <BilingualText as="span" size="sm" text={t("typeNotes")} />
              <textarea value={p.typed} onChange={(e) => p.onTyped(e.target.value)} rows={4} className="rounded-card border-2 border-line bg-white p-3" data-testid="typed-notes" />
            </label>
            <ChunkyButton variant="white" size="sm" className="self-start" onClick={p.onAddTyped} disabled={!p.typed.trim() || p.pages.length >= UPLOAD_RULES.maxPages}>
              <StickerIcon name="doc" size={20} />
              <BilingualText as="span" size="sm" text={t("addTyped")} />
            </ChunkyButton>
            {p.pages.length > 0 && (
              <ol className="flex flex-col gap-2" aria-label={t("pagesList").english}>
                {p.pages.map((pg, i) => {
                  const pr = pageProblem(pg);
                  return (
                    <li key={pg.key} className={cn("flex items-center gap-3 rounded-card bg-white p-3 shadow-float-1", pr && "border-2 border-coral")}>
                      <span className="font-extrabold tabular-nums">{i + 1}</span>
                      <StickerIcon name={pg.kind === "text" ? "doc" : pg.kind === "pdf" ? "books" : "image"} size={24} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{pg.name}</span>
                      {pg.kind !== "text" && <span className="text-sm text-stone">{formatBytes(pg.size)}</span>}
                      {pr && <Pill tone="warn">{t(PAGE_PROBLEM[pr]).regional}</Pill>}
                      <button type="button" onClick={() => p.onRemove(pg.key)} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-cloud" aria-label={t("removePage", { n: i + 1 }).english}>
                        <StickerIcon name="trash" size={20} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          {p.run.error !== null && <ErrorState error={p.run.error} />}
          {problem && problem !== "noPages" && (
            <p role="alert" className="font-bold text-coral-strong">
              <BilingualText as="span" text={t(`form_${problem}`, { max: UPLOAD_RULES.maxPages })} />
            </p>
          )}
          <ChunkyButton block onClick={p.onSubmit} disabled={Boolean(problem)} data-testid="start-upload">
            <BilingualText as="span" tone="inverse" text={t("makeCourse", { n: p.pages.length })} />
          </ChunkyButton>
        </>
      )}

      {!editing && (
        <Card className="flex flex-col gap-4" aria-live="polite">
          {(p.run.phase === "creating" || p.run.phase === "uploading" || p.run.phase === "starting") && (
            <>
              <BilingualText as="h2" size="lg" text={t("uploadingPages")} />
              <ol className="flex flex-col gap-3">
                {p.run.pages.map((pg, i) => (
                  <li key={i} className="flex items-center gap-3" data-testid={`page-progress-${i}`} data-state={pg.state}>
                    <span className="w-6 font-extrabold tabular-nums">{i + 1}</span>
                    <ProgressBar value={pg.progress} tone={pg.state === "error" ? "sun" : "grass"} label={t("pageProgress", { n: i + 1 }).english} className="flex-1" />
                    {pg.state === "done" && <StickerIcon name="sparkle" size={22} label={t("pageDone").english} />}
                    {pg.state === "error" && (
                      <ChunkyButton size="sm" variant="white" onClick={() => p.onRetryPage(i)} data-testid={`retry-page-${i}`}>
                        <BilingualText as="span" size="sm" text={t("retryPage")} />
                      </ChunkyButton>
                    )}
                  </li>
                ))}
              </ol>
              {p.run.pages.some((x) => x.state === "error") && <BilingualText size="sm" text={t("pageFailedHint")} className="text-coral-strong" />}
              {p.run.error !== null && (
                <div className="flex flex-col items-start gap-2">
                  <BilingualText size="sm" text={errors(asApiError(p.run.error).code)} className="text-coral-strong" />
                  <ChunkyButton size="sm" variant="white" onClick={p.onRetryStart}>
                    <BilingualText as="span" size="sm" text={t("retryStart")} />
                  </ChunkyButton>
                </div>
              )}
            </>
          )}
          {(p.run.phase === "processing" || p.run.phase === "ready" || p.run.phase === "failed") && (
            <>
              <BilingualText as="h2" size="lg" text={p.run.phase === "ready" ? t("courseReady") : p.run.phase === "failed" ? t("courseFailed") : t("aiWorking")} />
              <ol className="flex flex-col gap-2" data-testid="pipeline-steps">
                {PIPELINE_STEPS.map((s) => {
                  const done = p.run.steps.includes(s);
                  const current = !done && p.run.phase === "processing" && PIPELINE_STEPS.indexOf(s) === p.run.steps.length;
                  return (
                    <li key={s} className={cn("flex items-center gap-3", !done && !current && "text-stone")} aria-current={current ? "step" : undefined}>
                      <StickerIcon name={done ? "sparkle" : current ? "timer" : "lock"} size={22} />
                      <BilingualText as="span" size="sm" text={t(`step_${s}`)} />
                    </li>
                  );
                })}
              </ol>
              {p.pollError !== null && p.pollError !== undefined && <BilingualText size="sm" text={errors(asApiError(p.pollError).code)} className="text-coral-strong" />}
              {p.run.phase === "failed" && (
                <>
                  <p className="rounded-card bg-coral/10 p-3 text-sm font-semibold">{p.run.pipelineError}</p>
                  <ChunkyButton variant="white" onClick={p.onReset} className="self-start">
                    <BilingualText as="span" size="sm" text={t("tryAgainUpload")} />
                  </ChunkyButton>
                </>
              )}
              {p.run.phase === "ready" && p.run.courseId && (
                <ChunkyButton asChild>
                  <Link href={p.run.firstLessonId ? `/teacher/courses/${p.run.courseId}/lessons/${p.run.firstLessonId}` : `/teacher/courses/${p.run.courseId}`} data-testid="review-new-course">
                    <BilingualText as="span" tone="inverse" text={t("reviewFirstLesson")} />
                  </Link>
                </ChunkyButton>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
