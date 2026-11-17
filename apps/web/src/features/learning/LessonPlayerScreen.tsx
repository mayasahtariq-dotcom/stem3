"use client";
import Link from "next/link";
import type { Schemas } from "@mooshala/api-client";
import {
  BilingualText,
  ChunkyButton,
  ErrorState,
  GoluMascot,
  HeartMeter,
  LoadingState,
  ProgressBar,
  SpeechBubble,
  StickerIcon,
  StreakFlame,
} from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import {
  BendingPlant,
  FarmChest,
  HarvestBasket,
  SproutBloom,
  XpPop,
} from "./feedback/FarmFeedback";
import { QuestionStage } from "./minigames";
import { progress } from "./session";
import type { LessonPlayerModel } from "./use-lesson-player";

export interface LessonPlayerScreenProps {
  model: LessonPlayerModel;
  stats: Schemas["StatsOut"] | undefined;
  onExit: () => void;
  onSpeak?: (text: string) => void;
  /** Rendered under the lesson summary (Phase 4: the Golu Pot). */
  completeExtras?: React.ReactNode;
  formatTime: (iso: string) => string;
}

/** Stateless lesson player: every state (loading, error, playing, hearts out, done) has a screen. */
export function LessonPlayerScreen({
  model,
  stats,
  onExit,
  onSpeak,
  completeExtras,
  formatTime,
}: LessonPlayerScreenProps) {
  const t = useBilingual("lesson");
  const c = useBilingual("common");
  const tri = useTri();
  const { load, lesson, session, question } = model;

  if (load.status === "loading") return <LoadingState className="h-full" message={t("loading")} />;
  if (load.status === "error")
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3">
          <ErrorState
            error={load.error}
            onRetry={load.error.retryable ? model.reload : undefined}
          />
          <ChunkyButton variant="white" onClick={onExit}>
            <BilingualText as="span" align="center" text={t("backToFarm")} />
          </ChunkyButton>
        </div>
      </div>
    );
  if (!lesson || !session) return <LoadingState className="h-full" />;
  if (lesson.questions.length === 0)
    return (
      <div className="grid h-full place-items-center p-6">
        <SpeechBubble>
          <BilingualText text={t("noQuestions")} align="center" />
        </SpeechBubble>
      </div>
    );

  if (session.phase === "done" && session.complete) {
    const r = session.complete;
    return (
      <section
        aria-labelledby="lesson-done"
        className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center"
      >
        <HarvestBasket items={Math.round(r.xpEarned / 10)} />
        <BilingualText
          as="h1"
          size="2xl"
          align="center"
          text={t("doneTitle")}
          className="[&>span:first-child]:font-extrabold"
        />
        <p id="lesson-done" className="sr-only">
          {t("doneTitle").english}
        </p>
        <ul className="grid w-full grid-cols-3 gap-2">
          {[
            { label: t("xpEarned"), value: `+${r.xpEarned}`, icon: "star" as const },
            {
              label: t("accuracy"),
              value: `${Math.round(r.accuracy * 100)}%`,
              icon: "target" as const,
            },
            { label: t("streak"), value: String(r.streak), icon: "flame" as const },
          ].map((x) => (
            <li
              key={x.label.english}
              className="flex flex-col items-center gap-1 rounded-card border-2 border-line bg-white p-3"
            >
              <StickerIcon name={x.icon} size={28} />
              <span className="text-xl font-extrabold tabular-nums">{x.value}</span>
              <span>
                <BilingualText as="span" size="sm" align="center" text={x.label} />
              </span>
            </li>
          ))}
        </ul>
        {r.streakExtended && (
          <p className="flex items-center gap-2 font-bold text-flame">
            <StreakFlame value={r.streak} label={t("streakDays", { n: r.streak }).english} />
            <BilingualText as="span" text={t("streakGrew")} />
          </p>
        )}
        {session.bestCombo >= 3 && (
          <BilingualText size="sm" align="center" text={t("bestCombo", { n: session.bestCombo })} />
        )}
        {completeExtras}
        <ChunkyButton block size="lg" onClick={onExit} data-testid="lesson-finish">
          <BilingualText as="span" align="center" tone="inverse" text={t("backToFarm")} />
        </ChunkyButton>
      </section>
    );
  }

  if (session.phase === "done" && session.completedOffline)
    return (
      <section
        aria-labelledby="lesson-done-offline"
        data-testid="lesson-done-offline"
        className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center"
      >
        <FarmChest size={110} />
        <BilingualText
          as="h1"
          size="2xl"
          align="center"
          text={t("doneTitle")}
          className="[&>span:first-child]:font-extrabold"
        />
        <p id="lesson-done-offline" className="sr-only">
          {t("doneTitle").english}
        </p>
        <SpeechBubble>
          <BilingualText align="center" text={t("savedOfflineDone", { n: session.queuedCount ?? 0 })} />
        </SpeechBubble>
        <ChunkyButton block size="lg" onClick={onExit} data-testid="lesson-finish">
          <BilingualText as="span" align="center" tone="inverse" text={t("backToFarm")} />
        </ChunkyButton>
      </section>
    );

  if (session.phase === "completing" || session.phase === "completeError")
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <FarmChest size={110} />
          {session.phase === "completing" ? (
            <BilingualText align="center" text={t("finishing")} />
          ) : (
            <>
              <BilingualText align="center" text={t("finishFailed")} />
              <ChunkyButton onClick={model.retryComplete}>
                <BilingualText as="span" align="center" tone="inverse" text={c("retry")} />
              </ChunkyButton>
            </>
          )}
        </div>
      </div>
    );

  const result = session.phase === "feedback" ? session.last : null;
  const busy = session.phase === "submitting";
  const prompt = question ? tri(question.content.prompt) : null;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 p-3 tablet:p-4">
        <ChunkyButton
          variant="ghost"
          size="icon"
          onClick={onExit}
          aria-label={t("exit").english}
          title={t("exit").regional}
        >
          <StickerIcon name="home" size={26} />
        </ChunkyButton>
        <ProgressBar
          value={progress(session)}
          label={
            t("progressLabel", {
              done: Math.min(session.index, session.queue.length),
              total: session.queue.length,
            }).english
          }
          className="flex-1"
        />
        {session.combo >= 3 && (
          <StreakFlame
            value={session.combo}
            label={t("combo", { n: session.combo }).english}
            className="text-flame"
          />
        )}
        <HeartMeter
          value={stats?.hearts ?? 0}
          max={stats?.max_hearts ?? 5}
          label={t("hearts", { n: stats?.hearts ?? 0 }).english}
        />
      </header>

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4" aria-live="off">
        {model.retry && (
          <p className="flex items-center gap-2 self-start rounded-full bg-sun-soft px-3 py-1 text-sm font-bold">
            <StickerIcon name="repeat" size={20} /> {t("retryBadge").regional} ·{" "}
            {t("retryBadge").english}
          </p>
        )}
        {question && prompt && session.phase !== "heartsEmpty" && (
          <>
            <div className="flex items-start gap-3">
              <BilingualText as="h1" size="xl" text={prompt} className="flex-1" />
              {onSpeak && (
                <ChunkyButton
                  variant="white"
                  size="icon"
                  onClick={() => onSpeak(prompt.regional)}
                  aria-label={t("listen").english}
                  title={t("listen").regional}
                >
                  <StickerIcon name="speaker" size={24} />
                </ChunkyButton>
              )}
            </div>
            <QuestionStage
              key={`${question.id}:${session.index}`}
              id={question.id}
              content={question.content}
              terms={lesson.terms}
              result={result?.queued ? null : result}
              busy={busy || Boolean(result?.queued)}
              onAnswer={model.submit}
            />
          </>
        )}

        {session.phase === "submitError" && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-card border-2 border-sun bg-sun-soft p-4"
          >
            <BilingualText text={t("sendFailed")} />
            <ChunkyButton onClick={model.resubmit} data-testid="resend-answer">
              <BilingualText as="span" align="center" tone="inverse" text={c("retry")} />
            </ChunkyButton>
          </div>
        )}

        {session.phase === "heartsEmpty" && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-card border-2 border-line bg-white p-5 text-center"
            data-testid="hearts-empty"
          >
            <GoluMascot pose="sleep" size={96} />
            <BilingualText align="center" text={t("heartsEmpty")} />
            {session.refillAt && (
              <BilingualText
                size="sm"
                align="center"
                text={t("heartsRefill", { time: formatTime(session.refillAt) })}
              />
            )}
            <ChunkyButton variant="white" onClick={onExit}>
              <BilingualText as="span" align="center" text={t("backToFarm")} />
            </ChunkyButton>
          </div>
        )}
      </main>

      {result?.queued && <QueuedSheet onNext={model.next} />}
      {result && !result.queued && (
        <FeedbackSheet
          correct={result.correct}
          xp={result.xpDelta}
          heartLost={result.heartLost}
          explanation={tri(result.explanation as never)}
          willRetry={!result.correct && !model.retry}
          askHref={
            question
              ? `/farm/ask?course=${encodeURIComponent(lesson.courseId)}&question=${encodeURIComponent(question.id)}`
              : undefined
          }
          onNext={model.next}
        />
      )}
    </div>
  );
}

/** Offline: the answer is saved on the phone; no grade until it syncs. */
function QueuedSheet({ onNext }: { onNext: () => void }) {
  const t = useBilingual("lesson");
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="feedback-sheet"
      data-queued="true"
      className="motion-safe:animate-[pop-in_.25s_ease-out] relative border-t-4 border-sky bg-sky-soft p-4 pb-[max(16px,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center gap-3">
          <StickerIcon name="backpack" size={56} />
          <div className="flex flex-1 flex-col gap-1">
            <BilingualText as="h2" size="xl" text={t("savedOfflineTitle")} />
            <BilingualText size="sm" text={t("savedOfflineBody")} />
          </div>
        </div>
        <ChunkyButton block size="lg" onClick={onNext} autoFocus data-testid="feedback-continue">
          <BilingualText as="span" align="center" tone="inverse" text={t("continue")} />
        </ChunkyButton>
      </div>
    </section>
  );
}

function FeedbackSheet({
  correct,
  xp,
  heartLost,
  explanation,
  willRetry,
  askHref,
  onNext,
}: {
  correct: boolean;
  xp: number;
  heartLost: boolean;
  explanation: { regional: string; english: string };
  willRetry: boolean;
  askHref?: string;
  onNext: () => void;
}) {
  const t = useBilingual("lesson");
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="feedback-sheet"
      data-correct={correct}
      className={cn(
        "motion-safe:animate-[pop-in_.25s_ease-out] relative border-t-4 p-4 pb-[max(16px,env(safe-area-inset-bottom))]",
        correct ? "border-grass bg-[#ecf8e4]" : "border-sun bg-cream",
      )}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center gap-3">
          {correct ? <SproutBloom size={84} /> : <BendingPlant size={84} />}
          <div className="flex flex-1 flex-col gap-1">
            <BilingualText
              as="h2"
              size="xl"
              text={correct ? t("niceWork") : t("notQuiteTitle")}
              className={correct ? "text-grass-strong" : "text-ink"}
            />
            {correct && xp > 0 && <BilingualText size="sm" text={t("xpGained", { n: xp })} />}
            {!correct && heartLost && <BilingualText size="sm" text={t("heartUsed")} />}
            {willRetry && <BilingualText size="sm" text={t("comeBack")} />}
          </div>
          <GoluMascot pose={correct ? "heart" : "question"} size={72} />
          <XpPop value={xp} label={`+${xp} XP`} />
        </div>
        {explanation.english && (
          <div className="rounded-card bg-white/80 p-3">
            <BilingualText size="sm" text={explanation} />
          </div>
        )}
        <div className="flex flex-col gap-2 tablet:flex-row-reverse">
          <ChunkyButton block size="lg" onClick={onNext} autoFocus data-testid="feedback-continue">
            <BilingualText as="span" align="center" tone="inverse" text={t("continue")} />
          </ChunkyButton>
          {!correct && askHref && (
            <ChunkyButton asChild variant="white" block size="lg">
              <Link href={askHref}>
                <BilingualText as="span" align="center" text={t("askWhy")} />
              </Link>
            </ChunkyButton>
          )}
        </div>
      </div>
    </section>
  );
}
