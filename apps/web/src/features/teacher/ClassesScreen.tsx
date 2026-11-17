"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ClassInsights, Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, Dialog, EmptyState, ErrorState, LoadingState, StickerIcon, TextField } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { MeterRow, Ring, TrendColumns } from "./charts";
import { newClassProblem, type NewClass } from "./insights-api";
import { PageTitle, Pill, pct } from "./shared";

type Classroom = Schemas["ClassroomOut"];

/** The join code, big, with a copy button. */
export function JoinCodeCard({ code, onCopy }: { code: string; onCopy: () => void }) {
  const t = useBilingual("classes");
  return (
    <Card className="flex flex-col gap-2 border-sun bg-sun-soft p-4">
      <BilingualText as="h2" size="lg" text={t("joinCode")} />
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-3xl font-extrabold tracking-widest" data-testid="class-join-code">
          {code}
        </p>
        <ChunkyButton size="sm" variant="white" onClick={onCopy} aria-label={t("copy").english}>
          <StickerIcon name="copy" size={20} />
          <BilingualText as="span" size="sm" text={t("copy")} />
        </ChunkyButton>
      </div>
      <BilingualText size="sm" text={t("joinCodeHint")} />
    </Card>
  );
}

export interface ClassesScreenProps {
  classes: Classroom[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onCreate: (c: NewClass) => void;
  creating: boolean;
  created: Classroom | null;
  onCloseCreated: () => void;
  onCopy: (code: string) => void;
}

/** Stateless: the teacher's classes with their join codes, and "create a class". */
export function ClassesScreen(p: ClassesScreenProps) {
  const t = useBilingual("classes");
  const tt = useBilingual("teacher");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewClass>({ name: "", subject: "BI", grade: 9, allowed_language_modes: ["hindi", "kannada"] });
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pr = newClassProblem(form);
    setProblem(pr);
    if (!pr) {
      p.onCreate({ ...form, name: form.name.trim() });
      setOpen(false);
    }
  };
  const toggleMode = (m: "hindi" | "kannada") => {
    const cur = form.allowed_language_modes ?? [];
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    if (next.length) setForm({ ...form, allowed_language_modes: next });
  };

  return (
    <div>
      <PageTitle
        text={t("title")}
        icon="school"
        action={
          <ChunkyButton onClick={() => setOpen(true)} data-testid="new-class">
            <StickerIcon name="plus" size={20} />
            <BilingualText as="span" tone="inverse" text={t("newClass")} />
          </ChunkyButton>
        }
      />
      {p.loading ? (
        <LoadingState />
      ) : p.error ? (
        <ErrorState error={p.error} onRetry={p.onRetry} />
      ) : !p.classes?.length ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {p.classes.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <StickerIcon name={c.subject === "CH" ? "flask" : c.subject === "PH" ? "calc" : "sprout"} size={36} />
                  <div className="flex-1">
                    <p className="text-lg font-extrabold">{c.name}</p>
                    <p className="text-sm text-stone">
                      {tt(`subject${c.subject}`).english} · {tt("gradeN", { n: c.grade }).english}
                    </p>
                  </div>
                  {c.expires_at && <Pill tone="warn">{t("expired").regional}</Pill>}
                </div>
                <div className="flex items-center gap-2 rounded-card bg-sun-soft px-3 py-2">
                  <span className="font-mono text-xl font-extrabold tracking-widest">{c.join_key}</span>
                  <ChunkyButton size="sm" variant="ghost" className="ml-auto" onClick={() => p.onCopy(c.join_key)} aria-label={`${t("copy").english} ${c.join_key}`}>
                    <StickerIcon name="copy" size={20} />
                  </ChunkyButton>
                </div>
                <BilingualText size="sm" text={t("studentsN", { n: c.student_count })} />
                <ChunkyButton asChild variant="white" block className="mt-auto">
                  <Link href={`/teacher/classes/${c.id}`}>
                    <BilingualText as="span" align="center" text={t("open")} />
                  </Link>
                </ChunkyButton>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen} title={t("newClass")}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField label={t("className")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={problem === "nameMissing" ? t("nameMissing") : null} placeholder="Class 8-B Science" maxLength={80} autoFocus />
          <fieldset className="flex flex-col gap-2">
            <legend>
              <BilingualText as="span" size="sm" text={tt("subject")} />
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["BI", "CH", "PH"] as const).map((s) => (
                <ChunkyButton key={s} type="button" size="sm" variant={form.subject === s ? "primary" : "white"} aria-pressed={form.subject === s} onClick={() => setForm({ ...form, subject: s })}>
                  <BilingualText as="span" size="sm" tone={form.subject === s ? "inverse" : undefined} text={tt(`subject${s}`)} />
                </ChunkyButton>
              ))}
            </div>
          </fieldset>
          <TextField label={tt("grade")} type="number" inputMode="numeric" min={6} max={12} value={String(form.grade)} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })} error={problem === "gradeRange" ? tt("form_gradeRange") : null} />
          <fieldset className="flex flex-col gap-2">
            <legend>
              <BilingualText as="span" size="sm" text={t("languages")} />
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["hindi", "kannada"] as const).map((m) => {
                const on = form.allowed_language_modes?.includes(m) ?? false;
                return (
                  <ChunkyButton key={m} type="button" size="sm" variant={on ? "primary" : "white"} aria-pressed={on} onClick={() => toggleMode(m)}>
                    <BilingualText as="span" size="sm" tone={on ? "inverse" : undefined} text={t(m)} />
                  </ChunkyButton>
                );
              })}
            </div>
          </fieldset>
          <ChunkyButton type="submit" block loading={p.creating} data-testid="create-class">
            <BilingualText as="span" align="center" tone="inverse" text={t("create")} />
          </ChunkyButton>
        </form>
      </Dialog>

      <Dialog open={Boolean(p.created)} onOpenChange={(o) => !o && p.onCloseCreated()} title={t("createdTitle", { name: p.created?.name ?? "" })}>
        {p.created && (
          <div className="flex flex-col gap-3">
            <JoinCodeCard code={p.created.join_key} onCopy={() => p.onCopy(p.created!.join_key)} />
            <ChunkyButton asChild block>
              <Link href={`/teacher/classes/${p.created.id}`} onClick={p.onCloseCreated}>
                <BilingualText as="span" align="center" tone="inverse" text={t("open")} />
              </Link>
            </ChunkyButton>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export interface ClassDetailScreenProps {
  classroom: Classroom | null;
  insights: ClassInsights | undefined;
  students: Schemas["StudentRow"][] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onCopy: (code: string) => void;
  onOpenStudent: (id: string) => void;
}

/** Stateless: one class: code, who joined, and how the class is doing. */
export function ClassDetailScreen(p: ClassDetailScreenProps) {
  const t = useBilingual("classes");
  const tt = useBilingual("teacher");
  const tri = useTri();
  if (p.loading) return <LoadingState />;
  if (p.error || !p.classroom) return <ErrorState error={p.error ?? new Error("not found")} onRetry={p.onRetry} />;
  const ins = p.insights;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/teacher/classes" className="self-start font-bold text-sky-strong underline">
        ← {t("backToClasses").regional} · {t("backToClasses").english}
      </Link>
      <PageTitle text={{ regional: p.classroom.name, english: `${tt(`subject${p.classroom.subject}`).english} · ${tt("gradeN", { n: p.classroom.grade }).english}` }} icon="school" />
      <div className="grid gap-4 laptop:grid-cols-3">
        <JoinCodeCard code={p.classroom.join_key} onCopy={() => p.onCopy(p.classroom!.join_key)} />
        <Card className="flex items-center gap-4 p-4">
          <Ring value={ins?.accuracy ?? null} label={t("classScore").english} />
          <div>
            <BilingualText as="h2" size="lg" text={t("classScore")} />
            <BilingualText size="sm" text={t("studentsN", { n: ins?.student_count ?? p.students?.length ?? 0 })} />
          </div>
        </Card>
        <Card className="flex flex-col justify-center gap-2 p-4">
          <MeterRow label={t("completion")} value={ins?.completion ?? 0} />
        </Card>
      </div>

      <div className="grid gap-4 laptop:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <BilingualText as="h2" size="lg" text={t("joined")} />
          {!p.students?.length ? (
            <BilingualText size="sm" text={t("noneJoined")} />
          ) : (
            <ul className="flex flex-col gap-2" data-testid="class-roster">
              {p.students.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => p.onOpenStudent(s.id)} className="flex w-full items-center gap-3 rounded-card border-2 border-line bg-white p-3 text-left hover:border-grass">
                    <StickerIcon name="backpack" size={24} />
                    <span className="flex-1 font-bold">{s.name}</span>
                    {s.behind || s.idle ? <Pill tone="warn">{tt("behindShort").regional}</Pill> : <Pill tone="good">{tt("onTrack").regional}</Pill>}
                    <span className="w-12 text-right font-extrabold tabular-nums">{pct(s.accuracy)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <BilingualText as="h2" size="lg" text={t("trend")} />
          {ins?.trend.length ? <TrendColumns points={ins.trend} label={t("trend").english} /> : <BilingualText size="sm" text={t("noData")} />}
          <BilingualText as="h3" size="base" text={t("topics")} />
          {ins?.topics.map((x) => <MeterRow key={x.name.en} label={tri(x.name)} value={x.accuracy} />)}
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <BilingualText as="h2" size="lg" text={t("missed")} />
        {!ins?.missed.length ? (
          <BilingualText size="sm" text={t("noMissed")} />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="missed-questions">
            {ins.missed.map((m) => (
              <li key={m.question_id} className="flex flex-col gap-1 rounded-card border-2 border-line bg-white p-3">
                <BilingualText size="sm" text={tri(m.prompt)} />
                <BilingualText size="sm" text={t("missedRate", { pct: Math.round(m.wrong_rate * 100), n: m.answers })} className="text-coral-strong" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
