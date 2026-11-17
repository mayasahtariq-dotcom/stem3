"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import type { ClassNote, Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, EmptyState, ErrorState, LoadingState, StickerIcon, TextField } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { NOTE_ACCEPT, noteProblem, openableUrl, type NoteProblem } from "./api";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function FileLink({ file }: { file: NonNullable<ClassNote["file"]> }) {
  const t = useBilingual("notes");
  const open = () => {
    const u = openableUrl(file.url);
    window.open(u, "_blank", "noopener");
    if (u.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(u), 60_000);
  };
  const isImage = file.type.startsWith("image/");
  return (
    <div className="flex flex-col gap-2">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL, not a static asset
        <img src={file.url} alt={file.name} className="max-h-96 w-full rounded-card border-2 border-line bg-white object-contain" />
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-card border-2 border-line bg-white p-2">
        <StickerIcon name={isImage ? "image" : "doc"} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{file.name}</span>
        <ChunkyButton type="button" size="sm" variant="white" onClick={open} data-testid="note-open">
          <BilingualText as="span" text={t("open")} />
        </ChunkyButton>
        <ChunkyButton asChild size="sm" variant="ghost">
          <a href={file.url} download={file.name}>
            <BilingualText as="span" text={t("download")} />
          </a>
        </ChunkyButton>
      </div>
    </div>
  );
}

export function NoteCard({ note, showClass = true }: { note: ClassNote; showClass?: boolean }) {
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="note-card">
      <div className="flex items-start gap-3">
        <StickerIcon name="books" size={32} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold">{note.title}</h3>
          <p className="text-sm text-stone">
            {[note.teacher_name, showClass ? note.classroom : null, fmtDate(note.created_at)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {note.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{note.body}</p>}
      {note.file && <FileLink file={note.file} />}
    </Card>
  );
}

function NotesList({ notes, empty, showClass }: { notes: ClassNote[]; empty: React.ReactNode; showClass?: boolean }) {
  if (!notes.length) return <>{empty}</>;
  return (
    <ul className="flex flex-col gap-4" data-testid="notes-list">
      {notes.map((n) => (
        <li key={n.id}>
          <NoteCard note={n} showClass={showClass} />
        </li>
      ))}
    </ul>
  );
}

export interface NoteDraft {
  classId: string;
  title: string;
  body: string;
  file: File | null;
}

export interface TeacherNotesScreenProps {
  classes: Schemas["ClassroomOut"][] | undefined;
  notes: ClassNote[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  defaultClassId?: string;
  sharing?: boolean;
  /** Resolves true when the note was shared, so the form can clear. */
  onShare: (draft: NoteDraft) => Promise<boolean>;
}

/** Stateless (form fields aside): teacher shares notes with a class and sees what they shared. */
export function TeacherNotesScreen(p: TeacherNotesScreenProps) {
  const t = useBilingual("notes");
  const [draft, setDraft] = useState<NoteDraft>({ classId: p.defaultClassId ?? "", title: "", body: "", file: null });
  const [problem, setProblem] = useState<NoteProblem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const classId = draft.classId || p.defaultClassId || p.classes?.[0]?.id || "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const d = { ...draft, classId };
    const bad = noteProblem(d);
    setProblem(bad);
    if (bad) return;
    if (await p.onShare(d)) {
      setDraft({ classId, title: "", body: "", file: null });
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <StickerIcon name="doc" size={36} />
        <BilingualText as="h1" size="xl" text={t("teacherTitle")} />
      </div>
      {p.loading ? (
        <LoadingState />
      ) : p.error ? (
        <ErrorState error={p.error} onRetry={p.onRetry} />
      ) : !p.classes?.length ? (
        <EmptyState
          message={t("noClasses")}
          action={
            <ChunkyButton asChild>
              <Link href="/teacher/classes">
                <BilingualText as="span" tone="inverse" text={t("makeClass")} />
              </Link>
            </ChunkyButton>
          }
        />
      ) : (
        <>
          <Card className="p-4">
            <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate data-testid="share-note-form">
              <BilingualText as="h2" size="lg" text={t("shareTitle")} />
              <fieldset className="flex flex-col gap-2">
                <legend>
                  <BilingualText as="span" size="sm" text={t("forClass")} />
                </legend>
                <div className="flex flex-wrap gap-2">
                  {p.classes.map((c) => (
                    <ChunkyButton key={c.id} type="button" size="sm" variant={classId === c.id ? "primary" : "white"} aria-pressed={classId === c.id} onClick={() => setDraft({ ...draft, classId: c.id })}>
                      {c.name}
                    </ChunkyButton>
                  ))}
                </div>
              </fieldset>
              <TextField label={t("titleLabel")} value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} error={problem === "titleMissing" ? t("titleMissing") : null} />
              <label className="flex flex-col gap-2">
                <BilingualText as="span" size="sm" text={t("bodyLabel")} />
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={6}
                  maxLength={20000}
                  className="rounded-card border-2 border-line bg-white p-3 shadow-[var(--shadow-inset)] outline-none focus:border-sky-strong"
                />
              </label>
              <label className="flex flex-col gap-2">
                <BilingualText as="span" size="sm" text={t("fileLabel")} />
                <input
                  ref={fileRef}
                  type="file"
                  accept={NOTE_ACCEPT}
                  data-testid="note-file"
                  onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] ?? null })}
                  className="rounded-card border-2 border-dashed border-line bg-white p-3 text-sm"
                />
              </label>
              {problem && problem !== "titleMissing" && (
                <p role="alert" className="text-coral-strong">
                  <BilingualText as="span" size="sm" text={t(problem)} />
                </p>
              )}
              <ChunkyButton type="submit" block loading={p.sharing} data-testid="share-note">
                <StickerIcon name="raise" size={20} />
                <BilingualText as="span" tone="inverse" text={t("share")} />
              </ChunkyButton>
            </form>
          </Card>
          <section className="flex flex-col gap-3">
            <BilingualText as="h2" size="lg" text={t("shared")} />
            <NotesList notes={p.notes ?? []} empty={<EmptyState message={t("teacherEmpty")} />} />
          </section>
        </>
      )}
    </div>
  );
}

export interface StudentNotesScreenProps {
  notes: ClassNote[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

/** Stateless: notes from the student's teachers, newest first. */
export function StudentNotesScreen(p: StudentNotesScreenProps) {
  const t = useBilingual("notes");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-32 pt-28 laptop:max-w-4xl laptop:px-8 laptop:pb-12 laptop:pt-8" data-testid="student-notes">
      <div className="flex items-center gap-3">
        <StickerIcon name="doc" size={36} />
        <BilingualText as="h1" size="xl" text={t("studentTitle")} />
      </div>
      {p.loading ? (
        <LoadingState />
      ) : p.error ? (
        <ErrorState error={p.error} onRetry={p.onRetry} />
      ) : (
        <NotesList
          notes={p.notes ?? []}
          empty={
            <EmptyState
              message={t("studentEmpty")}
              action={
                <ChunkyButton asChild variant="white">
                  <Link href="/join">
                    <BilingualText as="span" text={t("joinClass")} />
                  </Link>
                </ChunkyButton>
              }
            />
          }
        />
      )}
    </div>
  );
}
