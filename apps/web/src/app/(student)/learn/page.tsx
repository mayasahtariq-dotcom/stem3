"use client";
import clsx from "clsx";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GoluMascot, MeadowScene } from "@/components/game";
import { BilingualText, Card, ChunkyButton, QueryState, SpeechBubble, StickerIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useHome, usePath } from "@/lib/queries";
import type { PathLesson } from "@/lib/types";

export default function Learn() {
  const { t, bi } = useT();
  const home = useHome();
  const courses = home.data?.courses ?? [];
  const cont = home.data?.continue;
  return (
    <div className="relative mx-auto max-w-xl space-y-6 pb-40">
      <QueryState loading={home.isLoading} error={home.error} onRetry={() => home.refetch()}>
        {cont ? (
          <Card className="flex items-center gap-4 border-grass/40 bg-grass/5">
            <GoluMascot size={80} stage={home.data?.stats.stage} />
            <div className="flex-1">
              <BilingualText regional={cont.lesson_title} english={cont.course_title} />
              <Link href={`/lesson/${cont.lesson_id}?course=${cont.course_id}`}>
                <ChunkyButton className="mt-2 w-full">{t("learn.continue")}</ChunkyButton></Link>
            </div>
          </Card>
        ) : courses.length === 0 ? <JoinClass /> : null}
        {courses.map((c) => <CoursePath key={c.id} id={c.id} />)}
      </QueryState>
      <MeadowScene className="fixed" />
      <span className="sr-only">{bi("nav.learn").english}</span>
    </div>
  );
}

function CoursePath({ id }: { id: string }) {
  const p = usePath(id);
  return (
    <QueryState loading={p.isLoading} error={p.error}>
      {p.data && <section aria-label={p.data.title} className="space-y-6">
        {p.data.units.map((u, ui) => (
          <div key={u.id}>
            <div className="rounded-[16px] bg-grass px-5 py-4 text-white shadow-[0_4px_0_var(--color-grass-dark)]">
              <div className="text-sm font-bold uppercase opacity-90">{p.data!.title}</div>
              <div className="text-xl font-black">{u.title}</div>
            </div>
            <ol className="relative mt-6 flex flex-col items-center gap-5">
              {u.lessons.map((l, li) => <PathNode key={l.id} lesson={l} courseId={id} offset={Math.sin((li + ui) * 1.3) * 70} />)}
            </ol>
          </div>))}
      </section>}
    </QueryState>
  );
}

function PathNode({ lesson, courseId, offset }: { lesson: PathLesson; courseId: string; offset: number }) {
  const { t } = useT();
  const icon = lesson.state === "locked" ? "lock" : lesson.state === "completed" ? "check" : lesson.kind;
  const body = (
    <motion.span whileHover={lesson.state !== "locked" ? { scale: 1.06 } : undefined}
      className={clsx("grid h-20 w-20 place-items-center rounded-full border-4",
        lesson.state === "current" && "border-grass bg-grass shadow-[0_6px_0_var(--color-grass-dark)] ring-8 ring-grass/20",
        lesson.state === "completed" && "border-sun bg-sun shadow-[0_6px_0_#E0A800]",
        lesson.state === "locked" && "border-line bg-line shadow-[0_6px_0_#CFCFCF]")}>
      <StickerIcon name={icon} size={40} /></motion.span>
  );
  return (
    <li style={{ transform: `translateX(${offset}px)` }} className="flex flex-col items-center gap-1">
      {lesson.state === "current" && <SpeechBubble className="mb-1 px-3 py-1 text-sm font-bold text-grass">{t("learn.start")}</SpeechBubble>}
      {lesson.state === "locked" ? <span aria-disabled="true" aria-label={`${lesson.title} (locked)`}>{body}</span>
        : <Link href={`/lesson/${lesson.id}?course=${courseId}`} aria-label={lesson.title}>{body}</Link>}
      <span className="max-w-40 text-center text-sm font-bold">{lesson.title}</span>
    </li>
  );
}

function JoinClass() {
  const { t, bi } = useT();
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card className="space-y-3 text-center">
      <GoluMascot size={100} mood="think" />
      <p className="font-bold">{t("learn.noCourse")}</p>
      <input aria-label={bi("auth.classKeyLabel").english} value={key} onChange={(e) => setKey(e.target.value)}
        className="w-full rounded-[12px] border-2 border-line bg-cloud px-4 py-3 text-center uppercase tracking-widest" />
      <ChunkyButton className="w-full" disabled={key.length < 4} onClick={async () => {
        try { await api("/classrooms/join", { json: { class_key: key } }); setErr(null); await qc.invalidateQueries(); }
        catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
      }}>{t("learn.joinClass")}</ChunkyButton>
      {err && <p role="alert" className="font-bold text-coral">{err}</p>}
    </Card>
  );
}
