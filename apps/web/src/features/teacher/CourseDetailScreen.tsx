"use client";
import Link from "next/link";
import { useState } from "react";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, Dialog, EmptyState, ErrorState, LoadingState, StickerIcon, TextField } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { PageTitle, Pill } from "./shared";

export interface CourseDetailScreenProps {
  course: Schemas["CourseOut"] | undefined;
  loading: boolean;
  error: unknown;
  classes: Schemas["ClassroomOut"][];
  publishingId: string | null;
  assigning: boolean;
  renaming: boolean;
  onPublish: (lessonId: string) => void;
  onAssign: (classroomIds: string[], dueAt: string | null) => void;
  onRename: (title: string) => void;
  onRetry: () => void;
}

export function CourseDetailScreen(p: CourseDetailScreenProps) {
  const t = useBilingual("teacher");
  const c = useBilingual("common");
  const tri = useTri();
  const [assignOpen, setAssignOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.course) return <LoadingState className="min-h-[50vh]" />;
  const k = p.course;
  const lessons = k.units.flatMap((u) => u.lessons);
  const flagged = lessons.reduce((n, l) => n + l.flagged_count, 0);
  const assignedNames = p.classes.filter((x) => k.assigned_classroom_ids.includes(x.id)).map((x) => x.name);
  return (
    <div className="flex flex-col gap-5">
      <ChunkyButton asChild size="sm" variant="ghost" className="self-start">
        <Link href="/teacher/courses">
          <BilingualText as="span" size="sm" text={t("backToCourses")} />
        </Link>
      </ChunkyButton>
      {editing ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) {
              p.onRename(title.trim());
              setEditing(false);
            }
          }}
        >
          <div className="min-w-64 flex-1">
            <TextField label={t("courseTitle")} value={title} onChange={(e) => setTitle(e.target.value)} size="md" error={title.trim() ? null : t("titleRequired")} />
          </div>
          <ChunkyButton type="submit" size="sm" disabled={!title.trim()} loading={p.renaming}>
            <BilingualText as="span" size="sm" tone="inverse" text={c("save")} />
          </ChunkyButton>
          <ChunkyButton size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <BilingualText as="span" size="sm" text={c("cancel")} />
          </ChunkyButton>
        </form>
      ) : (
        <PageTitle
          text={tri(k.title)}
          icon="books"
          action={
            <ChunkyButton
              size="sm"
              variant="white"
              onClick={() => {
                setTitle(tri(k.title).english);
                setEditing(true);
              }}
            >
              <StickerIcon name="pencil" size={18} />
              <BilingualText as="span" size="sm" text={t("rename")} />
            </ChunkyButton>
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={k.status === "published" ? "good" : "info"}>{(k.status === "published" ? t("statusPublished") : t("statusDraft")).regional}</Pill>
        <Pill>{t("gradeN", { n: k.grade }).regional}</Pill>
        <Pill>{t("questionsN", { n: k.question_count }).regional}</Pill>
        {k.edited_count > 0 && <Pill tone="info">{t("editedN", { n: k.edited_count }).regional}</Pill>}
        {flagged > 0 && <Pill tone="warn">{t("flaggedN", { n: flagged }).regional}</Pill>}
      </div>
      <Card className="flex flex-wrap items-center gap-3">
        <StickerIcon name="school" size={30} />
        <BilingualText
          size="sm"
          text={assignedNames.length ? t("assignedTo", { classes: assignedNames.join(", ") }) : t("notAssigned")}
          className="flex-1"
        />
        {!k.is_personal && (
          <ChunkyButton size="sm" variant="white" onClick={() => setAssignOpen(true)} disabled={!p.classes.length} data-testid="assign-course">
            <BilingualText as="span" size="sm" text={t("assign")} />
          </ChunkyButton>
        )}
      </Card>
      {lessons.length === 0 ? (
        <EmptyState message={t("noLessons")} />
      ) : (
        k.units.map((u) => (
          <section key={u.id} className="flex flex-col gap-2">
            <BilingualText as="h2" size="lg" text={tri(u.title)} />
            <ul className="flex flex-col gap-2">
              {u.lessons.map((l) => {
                const ready = l.generation_status === "ready";
                return (
                  <li key={l.id}>
                    <Card className="flex flex-wrap items-center gap-3 p-4" data-testid={`lesson-row-${l.id}`}>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-sun-soft font-extrabold">{l.position}</span>
                      <div className="min-w-48 flex-1">
                        <BilingualText size="base" text={tri(l.title)} />
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Pill>{t("questionsN", { n: l.question_count }).regional}</Pill>
                          {!ready && <Pill tone="info">{t("generating").regional}</Pill>}
                          {l.flagged_count > 0 && <Pill tone="warn">{t("flaggedN", { n: l.flagged_count }).regional}</Pill>}
                          {l.published && <Pill tone="good">{t("statusPublished").regional}</Pill>}
                        </div>
                      </div>
                      <ChunkyButton asChild size="sm" variant="white">
                        <Link href={`/teacher/courses/${k.id}/lessons/${l.id}`}>
                          <BilingualText as="span" size="sm" text={t("review")} />
                        </Link>
                      </ChunkyButton>
                      {!l.published && (
                        <ChunkyButton
                          size="sm"
                          disabled={!ready || l.flagged_count > 0 || l.question_count === 0 || p.publishingId !== null}
                          loading={p.publishingId === l.id}
                          onClick={() => p.onPublish(l.id)}
                          title={l.flagged_count > 0 ? t("reviewFlaggedFirst").english : undefined}
                        >
                          <BilingualText as="span" size="sm" tone="inverse" text={t("publish")} />
                        </ChunkyButton>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <Dialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title={t("assignTitle")}
        description={t("assignHint")}
        actions={
          <>
            <ChunkyButton variant="ghost" size="sm" onClick={() => setAssignOpen(false)}>
              <BilingualText as="span" size="sm" text={c("cancel")} />
            </ChunkyButton>
            <ChunkyButton
              size="sm"
              disabled={!picked.length}
              loading={p.assigning}
              onClick={() => {
                p.onAssign(picked, due ? new Date(`${due}T23:59:00+05:30`).toISOString() : null);
                setAssignOpen(false);
              }}
              data-testid="confirm-assign"
            >
              <BilingualText as="span" size="sm" tone="inverse" text={t("assign")} />
            </ChunkyButton>
          </>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t("assignTitle").english}</legend>
          {p.classes.map((cl) => (
            <label key={cl.id} className="flex min-h-11 items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={picked.includes(cl.id)}
                onChange={(e) => setPicked((x) => (e.target.checked ? [...x, cl.id] : x.filter((i) => i !== cl.id)))}
              />
              {cl.name}
            </label>
          ))}
        </fieldset>
        <label className="mt-3 flex flex-col gap-1 font-semibold">
          <BilingualText as="span" size="sm" text={t("dueDate")} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="min-h-11 rounded-button border-2 border-line bg-white px-3" />
        </label>
      </Dialog>
    </div>
  );
}
