"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  AnswerOption,
  BilingualText,
  ChunkyButton,
  GoluMascot,
  ProgressBar,
  StickerIcon,
} from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import type { Phase } from "./engine";
import { KEYS } from "./keypad";
import type { PhoneCallModel } from "./use-phone-call";

/** The shared simulated number shown on the phone (no real line exists). */
export const SIM_NUMBER = "+91 80 4718 2700";

const STATUS: Record<Phase, string> = {
  idle: "stIdle",
  connecting: "stConnecting",
  enter_id: "stActive",
  enter_pin: "stActive",
  authenticating: "stChecking",
  menu: "stActive",
  choose_course: "stActive",
  choose_lesson: "stActive",
  loading: "stActive",
  answering: "stAnswering",
  submitting: "stChecking",
  feedback: "stFeedback",
  completed: "stCompleted",
  ended: "stEnded",
};

const clock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function PhoneCallScreen({ model, demoId }: { model: PhoneCallModel; demoId: string }) {
  const t = useBilingual("phoneSim");
  const tri = useTri();
  const { state } = model;
  const live = state.phase !== "idle" && state.phase !== "ended";
  const q = state.questions[state.index] ?? null;
  const inLesson = q && ["answering", "submitting", "feedback"].includes(state.phase);
  const feed = useRef<HTMLOListElement>(null);
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [state.lines.length]);
  const masked = state.phase === "enter_pin" ? "•".repeat(state.entry.length) : state.entry;

  return (
    <div className="playful sunburst relative isolate min-h-dvh overflow-hidden">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 pb-10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-white/70 px-3 font-bold text-ink hover:bg-white"
          >
            ← {t("back").regional}
          </Link>
          <span
            className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-ink"
            data-testid="sim-disclaimer"
          >
            {t("simulated").regional} · {t("simulated").english}
          </span>
        </div>
        <BilingualText as="h1" size="lg" tone="inverse" text={t("title")} />

        <div className="grid gap-6 laptop:grid-cols-[320px_1fr]">
          {/* the phone */}
          <div
            className="mx-auto w-full max-w-[320px] self-start rounded-[44px] bg-gradient-to-b from-[#1c2a4a] to-[#0d1526] p-3 shadow-[0_24px_60px_rgb(10_30_80/0.45)]"
            data-testid="phone-call"
            data-phase={state.phase}
          >
            <div className="flex flex-col gap-3 rounded-[34px] bg-gradient-to-b from-[#2b6fd6] via-[#3b82f6] to-[#1e3a8a] p-4 text-white">
              <span aria-hidden className="mx-auto h-1.5 w-20 rounded-full bg-black/30" />
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "rounded-full bg-white/20 p-1",
                    live && "motion-safe:animate-pulse",
                  )}
                >
                  <GoluMascot pose={live ? "heart" : "wave"} size={44} />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg tracking-wide">STEM Tutor · Aaroh</p>
                  <p className="text-xs text-white/80">{SIM_NUMBER}</p>
                  <p className="text-xs font-bold" aria-live="polite" data-testid="call-status">
                    {t(STATUS[state.phase]).regional}
                    {state.startedAt ? ` · ${clock(model.seconds)}` : ""}
                  </p>
                </div>
              </div>
              {(state.phase === "enter_id" || state.phase === "enter_pin") && (
                <div className="rounded-2xl bg-black/25 px-3 py-2 text-center" data-testid="entry">
                  <p className="text-[11px] text-white/80">
                    {t(state.phase === "enter_id" ? "idLabel" : "pinLabel").regional}
                  </p>
                  <p className="min-h-8 font-mono text-2xl tracking-[0.2em]">{masked || "—"}</p>
                  <p className="text-[11px] text-white/70">{t("entryHint").regional}</p>
                </div>
              )}
              <ol
                ref={feed}
                className="flex h-48 flex-col gap-1.5 overflow-y-auto rounded-2xl bg-white/12 p-2 text-sm"
                aria-label={t("transcript").english}
                data-testid="call-transcript"
              >
                {state.lines.length === 0 && (
                  <li className="m-auto text-center text-white/75">
                    {t("transcriptEmpty").regional}
                  </li>
                )}
                {state.lines.map((l, i) => {
                  const line = model.text(l.parts);
                  return (
                    <li
                      key={i}
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3 py-1.5 leading-snug",
                        l.who === "ai"
                          ? "self-start bg-white/90 text-ink"
                          : "self-end bg-[#22c55e] font-bold text-white",
                      )}
                    >
                      <span className="font-regional">{line.regional}</span>
                      {l.who === "ai" && line.english !== line.regional && (
                        <span className="block text-xs text-stone">{line.english}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("keypad").english}>
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => model.press(k)}
                    disabled={!live}
                    className="grid h-11 place-items-center rounded-full bg-white/18 text-lg font-extrabold transition active:scale-95 enabled:hover:bg-white/30 disabled:opacity-40"
                    data-testid={`key-${k}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3">
                {live ? (
                  <button
                    type="button"
                    onClick={model.hangUp}
                    aria-label={t("endCall").english}
                    className="flex items-center gap-2 rounded-full bg-[#ef4444] px-5 py-3 font-extrabold shadow-lg transition active:scale-95"
                    data-testid="end-call"
                  >
                    <StickerIcon name="speaker" size={20} /> {t("endCall").regional}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={model.dial}
                    className="flex items-center gap-2 rounded-full bg-[#22c55e] px-5 py-3 font-extrabold shadow-lg transition active:scale-95"
                    data-testid="call"
                  >
                    <StickerIcon name="speaker" size={20} />{" "}
                    {t(state.phase === "idle" ? "call" : "callAgain").regional}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => model.setMuted(!model.muted)}
                  aria-pressed={model.muted}
                  className="rounded-full bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30"
                  data-testid="mute"
                >
                  {t(model.muted ? "unmute" : "mute").regional}
                </button>
              </div>
            </div>
          </div>

          {/* what the call is doing */}
          <div className="flex flex-col gap-4">
            <section
              className="glass flex flex-col gap-3 rounded-[28px] p-5"
              data-testid="current-question"
            >
              {inLesson && q ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <BilingualText size="sm" text={tri(state.lessonTitle)} />
                    <span className="text-sm font-bold text-stone" data-testid="q-progress">
                      {state.index + 1} / {state.questions.length}
                    </span>
                  </div>
                  <ProgressBar
                    value={
                      (state.index + (state.phase === "feedback" ? 1 : 0)) / state.questions.length
                    }
                    label={t("progress").english}
                  />
                  <BilingualText size="lg" text={tri(q.prompt)} />
                  <div className="flex flex-col gap-2">
                    {q.options.map((o, i) => {
                      const r = state.lastResult;
                      const st =
                        r && state.phase === "feedback"
                          ? i === r.correctIndex
                            ? "correct"
                            : state.selection.includes(i) && !r.correct
                              ? "incorrect"
                              : "idle"
                          : state.selection.includes(i)
                            ? "selected"
                            : "idle";
                      return (
                        <AnswerOption
                          key={i}
                          index={i + 1}
                          text={tri(o)}
                          state={st}
                          onSelect={() => model.press(String(i + 1) as (typeof KEYS)[number])}
                          disabled={state.phase !== "answering"}
                        />
                      );
                    })}
                  </div>
                  {state.phase === "feedback" && state.lastResult && (
                    <p
                      className={cn(
                        "rounded-2xl px-3 py-2 font-bold",
                        state.lastResult.correct
                          ? "bg-[#ecf8e4] text-grass-strong"
                          : "bg-[#fff4e5] text-ink",
                      )}
                      data-testid="feedback"
                    >
                      {t(state.lastResult.correct ? "fbCorrect" : "fbNotQuite").regional} ·{" "}
                      {t(state.lastResult.correct ? "fbCorrect" : "fbNotQuite").english}
                    </p>
                  )}
                </>
              ) : state.phase === "completed" ? (
                <div
                  className="flex flex-col items-center gap-2 text-center"
                  data-testid="lesson-complete"
                >
                  <StickerIcon name="trophy" size={48} />
                  <BilingualText align="center" size="lg" text={t("doneTitle")} />
                  <BilingualText
                    align="center"
                    text={t("doneScore", {
                      correct: state.score.correct,
                      total: state.questions.length,
                      xp: state.score.xp,
                    })}
                  />
                  <Link href="/farm" className="font-bold text-sky-strong underline">
                    {t("seeInApp").regional} · {t("seeInApp").english}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <BilingualText text={t(live ? "panelLive" : "panelIdle")} />
                  {!live && <BilingualText size="sm" className="text-stone" text={t("howTo")} />}
                </div>
              )}
            </section>

            <section
              className="glass flex flex-col gap-2 rounded-[28px] p-5"
              aria-labelledby="keys-h"
            >
              <h2 id="keys-h" className="font-bold text-ink">
                {t("keysTitle").regional} ·{" "}
                <span className="text-stone">{t("keysTitle").english}</span>
              </h2>
              <ul className="grid gap-1 text-sm tablet:grid-cols-2">
                {["k15", "k6", "k7", "k8", "k9", "k0", "kHash", "kStar"].map((k) => (
                  <li key={k}>
                    <BilingualText size="sm" text={t(k)} />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-stone">{t("keyboardToo").english}</p>
            </section>

            <section
              className="glass flex flex-col gap-2 rounded-[28px] p-5"
              data-testid="demo-shortcut"
            >
              <p className="text-xs font-extrabold uppercase tracking-wide text-marigold-strong">
                {t("demoTag").english}
              </p>
              <BilingualText size="sm" text={t("demoHint", { id: demoId })} />
              <ChunkyButton
                variant="white"
                onClick={model.demoSignIn}
                disabled={live && state.phase !== "enter_id"}
                data-testid="demo-sign-in"
              >
                <BilingualText as="span" align="center" text={t("demoButton")} />
              </ChunkyButton>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
