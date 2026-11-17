"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Celebration } from "@/components/Celebration";
import { DoubtSheet, TermsSheet } from "@/components/Sheets";
import { HeartMeter, StreakFlame, XPPop } from "@/components/game";
import { AnswerOption, FillIn, MatchPairs } from "@/components/answers";
import { BilingualText, ChunkyButton, ListenButton, ProgressBar, QueryState, StickerIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { pick, pickEnglish, useT } from "@/lib/i18n";
import { useStats } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { AttemptResult, CompleteResult, LessonStart, Question } from "@/lib/types";
import { playSound } from "@/lib/sound";

export default function LessonPage() {
  return <AuthGate role="student"><Player /></AuthGate>;
}

function Player() {
  const { id } = useParams<{ id: string }>();
  const courseId = useSearchParams().get("course") ?? undefined;
  const { t } = useT();
  const qc = useQueryClient();
  const start = useQuery({ queryKey: ["lesson", id], queryFn: () => api<LessonStart>(`/lessons/${id}/start`, { method: "POST" }),
    staleTime: Infinity, gcTime: 0, retry: false });
  const stats = useStats();
  const [phase, setPhase] = useState<"content" | "quiz" | "done">("content");
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [sheet, setSheet] = useState<"terms" | "doubt" | null>(null);
  const [bestCombo, setBestCombo] = useState(0);
  const [firstTryRight, setFirstTryRight] = useState(0);

  const lesson = start.data?.lesson;
  const hasContent = lesson && (lesson.kind === "video" || lesson.kind === "reading");
  useEffect(() => { if (start.data && !hasContent) setPhase("quiz"); }, [start.data, hasContent]);

  const complete = useMutation({
    mutationFn: () => api<CompleteResult>(`/lessons/${id}/complete`, { method: "POST" }),
    onSuccess: (r) => { setResult(r); setPhase("done"); playSound("finish"); qc.invalidateQueries(); },
  });
  const onQuizDone = useCallback(() => complete.mutate(), [complete]);
  const finishContent = () => (start.data?.questions.length ? setPhase("quiz") : complete.mutate());

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-4">
      <header className="flex items-center gap-3">
        <Link href="/learn" aria-label={t("lesson.quit")} className="grid h-11 w-11 place-items-center rounded-full text-2xl font-bold text-muted hover:bg-line">×</Link>
        <div className="flex-1" id="lesson-progress" />
        {stats.data && <><StreakFlame days={stats.data.streak} /><HeartMeter hearts={stats.data.hearts} /></>}
      </header>
      <div className="mt-2 flex gap-2">
        <ChunkyButton variant="white" className="px-3 py-2 text-xs normal-case" onClick={() => setSheet("terms")} disabled={!courseId}>
          <StickerIcon name="book" size={18} className="mr-1 inline" />{t("lesson.terms")}</ChunkyButton>
        <ChunkyButton variant="white" className="px-3 py-2 text-xs normal-case" onClick={() => setSheet("doubt")}>
          <StickerIcon name="quest" size={18} className="mr-1 inline" />{t("lesson.doubt")}</ChunkyButton>
      </div>

      <QueryState loading={start.isLoading} error={start.error} onRetry={() => start.refetch()}>
        {lesson && phase === "content" && hasContent && <ContentView lesson={lesson} onDone={finishContent} busy={complete.isPending} />}
        {lesson && phase === "quiz" && start.data && (
          start.data.questions.length === 0
            ? <div className="mt-10 text-center"><ChunkyButton onClick={onQuizDone}>{t("lesson.done")}</ChunkyButton></div>
            : <Quiz questions={start.data.questions} interactive={lesson.kind === "interactive"} onDone={onQuizDone}
                    onCombo={(c) => setBestCombo((b) => Math.max(b, c))} onFirstTry={() => setFirstTryRight((n) => n + 1)} />)}
        {phase === "done" && result && <Celebration result={result} bestCombo={bestCombo}
          accuracy={start.data?.questions.length ? Math.round((firstTryRight / start.data.questions.length) * 100) : 100} />}
        {complete.error && <p role="alert" className="mt-4 rounded-[12px] bg-coral/10 p-3 font-bold text-coral">{(complete.error as Error).message}</p>}
      </QueryState>

      <TermsSheet open={sheet === "terms"} courseId={courseId} onClose={() => setSheet(null)} />
      <DoubtSheet open={sheet === "doubt"} lessonId={id} onClose={() => setSheet(null)} />
    </div>
  );
}

function ContentView({ lesson, onDone, busy }: { lesson: LessonStart["lesson"]; onDone: () => void; busy: boolean }) {
  const { t, lang } = useT();
  const c = lesson.content as { url?: string; transcript?: unknown; body?: unknown };
  const text = lesson.kind === "video" ? c.transcript : c.body;
  const regional = pick(text, lang), english = lang === "en" ? "" : pickEnglish(text);
  return (
    <section className="mt-6 space-y-4">
      <BilingualText as="h1" size="lg" regional={lesson.title} english={t(lesson.kind === "video" ? "lesson.watch" : "lesson.read")} />
      {lesson.kind === "video" && c.url && (
        <video controls preload="metadata" className="aspect-video w-full rounded-[16px] bg-ink" src={c.url}>
          <track kind="captions" />
        </video>)}
      {regional && <div className="rounded-[16px] border-2 border-line bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold uppercase text-muted">{lesson.kind === "video" ? t("lesson.transcript") : t("lesson.read")}</span>
          <ListenButton text={regional} label={t("lesson.listen")} /></div>
        <p className="whitespace-pre-line text-lg font-bold leading-relaxed">{regional}</p>
        {english && english !== regional && <p className="mt-2 whitespace-pre-line text-muted">{english}</p>}
      </div>}
      <ChunkyButton className="w-full" onClick={onDone} disabled={busy}>{t("lesson.done")}</ChunkyButton>
    </section>
  );
}

/* Quiz: one question at a time; wrong answers come back at the end; server checks every answer. */
function Quiz({ questions, interactive, onDone, onCombo, onFirstTry }: { questions: Question[]; interactive: boolean;
  onDone: () => void; onCombo: (c: number) => void; onFirstTry: () => void }) {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const sound = useSession((s) => s.sound);
  const [queue, setQueue] = useState<Question[]>(questions);
  const [done, setDone] = useState(0);
  const [answer, setAnswer] = useState<unknown>(null);
  const [res, setRes] = useState<AttemptResult | null>(null);
  const [pop, setPop] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const q = queue[0];

  const check = useMutation({
    mutationFn: () => api<AttemptResult>("/attempts", { json: { question_id: q.id, answer } }),
    onSuccess: (r) => {
      setRes(r); setPop((p) => p + 1); setErr(null);
      if (sound) playSound(r.correct ? "correct" : "wrong");
      if (r.correct && r.first_try) onFirstTry();
      onCombo(r.combo);
      qc.setQueryData(["stats"], (s: object | undefined) => s ? { ...s, hearts: r.hearts } : s);
    },
    onError: (e) => setErr((e as Error).message),
  });

  const next = useCallback(() => {
    if (!res) return;
    const rest = queue.slice(1);
    const newQueue = res.correct ? rest : [...rest, q];
    if (res.correct) setDone((d) => d + 1);
    setQueue(newQueue); setAnswer(null); setRes(null);
    qc.invalidateQueries({ queryKey: ["stats"] });
    if (newQueue.length === 0) onDone();
  }, [res, queue, q, onDone, qc]);

  const pairsNeeded = q?.kind === "match" ? Math.floor((q.options?.length ?? 0) / 2) : 0;
  const ready = q?.kind === "match"
    ? Object.keys((answer as Record<string, string>) ?? {}).length === pairsNeeded && pairsNeeded > 0
    : answer !== null && answer !== "";

  // Keyboard play: 1-4 pick an answer, Enter checks, Space continues.
  const choices = useMemo(() => q ? optionsFor(q, t) : [], [q, t]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.key === "Enter" && ready && !res) check.mutate(); return; }
      if (!res && /^[1-9]$/.test(e.key) && choices[Number(e.key) - 1]) setAnswer(choices[Number(e.key) - 1].value);
      else if (e.key === "Enter" && !res && ready) check.mutate();
      else if ((e.key === " " || e.key === "Enter") && res) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [choices, ready, res, check, next]);

  if (!q) return null;
  const prompt = pick(q.prompt, lang), promptEn = lang === "en" ? "" : pickEnglish(q.prompt);
  return (
    <section className="relative mt-4 flex flex-1 flex-col">
      <ProgressBar value={done} max={questions.length} label="Lesson progress" />
      <XPPop xp={res?.correct ? res.xp_gained : 0} id={pop} />
      {res && res.combo >= 3 && <div className="mt-2 text-center font-black text-flame"><StickerIcon name="flame" size={20} className="mr-1 inline anim-flicker" />{t("lesson.combo", { n: res.combo })}</div>}
      <div className="mt-6 flex items-start gap-3">
        <BilingualText as="h1" size="lg" className="flex-1" regional={prompt} english={promptEn !== prompt ? promptEn : ""} />
        <ListenButton text={prompt} label={t("lesson.listen")} />
      </div>
      <motion.div key={q.id + String(queue.length)} className="mt-6 flex-1" animate={res && !res.correct ? { x: [0, -6, 6, 0] } : {}}>
        {q.kind === "match"
          ? <MatchPairs options={(q.options ?? []) as unknown[]} value={(answer as Record<string, string>) ?? {}}
                        onChange={setAnswer} disabled={!!res} lang={lang} interactive={interactive} />
          : q.kind === "fill_in"
            ? <FillIn value={(answer as string) ?? ""} onChange={setAnswer} disabled={!!res} placeholder={t("lesson.typeAnswer")} />
            : <div className="grid gap-3 sm:grid-cols-2">
                {choices.map((c, i) => <AnswerOption key={i} index={i + 1} label={c.label} sub={c.sub}
                  selected={JSON.stringify(answer) === JSON.stringify(c.value)} disabled={!!res}
                  state={res ? (JSON.stringify(c.value) === JSON.stringify(res.correct_answer) ? "right" : JSON.stringify(answer) === JSON.stringify(c.value) ? "wrong" : undefined) : undefined}
                  onSelect={() => setAnswer(c.value)} />)}
              </div>}
      </motion.div>
      {err && <p role="alert" className="mb-3 rounded-[12px] bg-coral/10 p-3 font-bold text-coral">{err}</p>}
      <AnimatePresence mode="wait">
        {res ? (
          <motion.div key="fb" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className={`sticky bottom-0 -mx-4 mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${res.correct ? "bg-grass/15" : "bg-coral/10"}`}
            role="status" aria-live="assertive">
            <div className="flex-1">
              <p className={`text-xl font-black ${res.correct ? "text-grass-dark" : "text-coral"}`}>{res.correct ? t("lesson.correct") : t("lesson.notQuite")}</p>
              {!res.correct && <p className="font-bold text-coral">{t("lesson.answerWas", { answer: answerLabel(res.correct_answer, q, t, lang) })}</p>}
              {!res.correct && <p className="text-sm text-muted">{t("lesson.comeBack")}</p>}
            </div>
            <ChunkyButton variant={res.correct ? "primary" : "coral"} onClick={next} autoFocus>{t("lesson.continue")}</ChunkyButton>
          </motion.div>
        ) : (
          <motion.div key="check" className="sticky bottom-0 -mx-4 mt-4 bg-cloud p-4">
            <ChunkyButton className="w-full" disabled={!ready || check.isPending} onClick={() => check.mutate()}>{t("lesson.check")}</ChunkyButton>
          </motion.div>)}
      </AnimatePresence>
    </section>
  );
}

function optionsFor(q: Question, t: (k: string) => string) {
  if (q.kind === "true_false") return [{ value: true as unknown, label: t("lesson.true"), sub: "" }, { value: false as unknown, label: t("lesson.false"), sub: "" }];
  const lang = useSession.getState().lang;
  return (q.options ?? []).map((o) => ({ value: o, label: pick(o, lang), sub: lang === "en" ? "" : pickEnglish(o) }));
}

function answerLabel(a: unknown, q: Question, t: (k: string) => string, lang: ReturnType<typeof useT>["lang"]) {
  if (q.kind === "true_false") return t(a === true || a === "true" ? "lesson.true" : "lesson.false");
  if (Array.isArray(a)) return a.map((x) => pick(x, lang)).join(" / ");
  if (a && typeof a === "object" && !("en" in a || "regional" in a || "hi" in a)) return Object.entries(a).map(([k, v]) => `${k} → ${v}`).join(", ");
  return pick(a, lang);
}
