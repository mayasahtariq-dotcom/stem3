"use client";
import { useEffect, useMemo, useState } from "react";
import { AnswerOption, BilingualText, ChunkyButton, type AnswerState } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { optionText, seededOrder, type Answer, type QuestionContent, type TermMap } from "./content";
import type { AttemptResult } from "./session";

/*
 * The four documented question types (Android PRD M3, backend/app/ai/schemas.py).
 * Each keeps only its UI selection; the answer goes up through onAnswer and
 * is graded by the server. `result` is the server's verdict for the shown
 * question, used to colour the options after grading.
 */
export interface QuestionProps<C extends QuestionContent> {
  id: string;
  content: C;
  terms: TermMap;
  /** Set once the server has graded this question. */
  result: AttemptResult | null;
  busy: boolean;
  onAnswer: (a: Answer) => void;
}

/** Number keys 1-9 pick an option (keyboard play). */
export function useNumberKeys(count: number, onPick: (i: number) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [count, enabled, onPick]);
}

function CheckButton({ disabled, busy, onClick }: { disabled: boolean; busy: boolean; onClick: () => void }) {
  const t = useBilingual("lesson");
  return (
    <ChunkyButton block size="lg" disabled={disabled} loading={busy} onClick={onClick} data-testid="check-answer">
      <BilingualText as="span" align="center" tone="inverse" text={t("check")} />
    </ChunkyButton>
  );
}

function optionState(i: number, picked: number | null, result: AttemptResult | null, correctIndex: number | null): AnswerState {
  if (!result) return picked === i ? "selected" : "idle";
  if (correctIndex === i) return "correct";
  if (picked === i && !result.correct) return "incorrect";
  return "idle";
}

export function MultipleChoiceQuestion({ content, terms, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "multiple_choice" }>>) {
  const tri = useTri();
  const t = useBilingual("lesson");
  const [picked, setPicked] = useState<number | null>(null);
  const locked = Boolean(result) || busy;
  useNumberKeys(content.options.length, setPicked, !locked);
  const correctIndex = result ? Number(result.correctAnswer.index) : null;
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("chooseOne").english} className="flex flex-col gap-3">
        {content.options.map((o, i) => {
          const state = optionState(i, picked, result, correctIndex);
          return <AnswerOption key={i} index={i + 1} text={tri(optionText(o, terms))} state={state} disabled={locked} onSelect={() => setPicked(i)} stateLabel={state === "correct" ? t("correctLabel").english : state === "incorrect" ? t("notQuite").english : undefined} />;
        })}
      </div>
      {!result && <CheckButton disabled={picked === null} busy={busy} onClick={() => picked !== null && onAnswer({ type: "multiple_choice", index: picked })} />}
    </div>
  );
}

export function TrueFalseQuestion({ content, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "true_false" }>>) {
  const tri = useTri();
  const t = useBilingual("lesson");
  const [picked, setPicked] = useState<number | null>(null);
  const locked = Boolean(result) || busy;
  useNumberKeys(2, setPicked, !locked);
  const correctIndex = result ? (result.correctAnswer.value === true ? 0 : 1) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border-2 border-line bg-cream p-4">
        <BilingualText size="lg" text={tri(content.statement)} />
      </div>
      <div role="radiogroup" aria-label={t("chooseOne").english} className="grid grid-cols-2 gap-3">
        {[t("true"), t("false")].map((label, i) => {
          const state = optionState(i, picked, result, correctIndex);
          return <AnswerOption key={i} index={i + 1} text={label} state={state} disabled={locked} onSelect={() => setPicked(i)} stateLabel={state === "correct" ? t("correctLabel").english : state === "incorrect" ? t("notQuite").english : undefined} />;
        })}
      </div>
      {!result && <CheckButton disabled={picked === null} busy={busy} onClick={() => picked !== null && onAnswer({ type: "true_false", value: picked === 0 })} />}
    </div>
  );
}

export function FillFormulaQuestion({ content, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "fill_formula" }>>) {
  const t = useBilingual("lesson");
  const [chip, setChip] = useState<string | null>(null);
  const locked = Boolean(result) || busy;
  useNumberKeys(content.chips.length, (i) => setChip(content.chips[i]!), !locked);
  const [before, after] = content.formula.split("__", 2) as [string, string];
  const right = result ? String(result.correctAnswer.chip) : null;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center justify-center gap-2 rounded-card border-2 border-line bg-cream p-4 text-center font-mono text-xl font-bold" aria-label={`${t("formula").english}: ${content.formula.replace("__", chip ?? "blank")}`}>
        <span>{before}</span>
        <span
          className={cn(
            "inline-flex min-h-11 min-w-20 items-center justify-center rounded-button border-2 border-dashed px-3",
            !chip && "border-stone text-stone",
            chip && !result && "border-sky-strong bg-sky-soft",
            result && (result.correct ? "border-grass-strong bg-[#ecf8e4]" : "border-coral-strong bg-[#fdeeed]"),
          )}
          data-testid="formula-blank"
        >
          {chip ?? "?"}
        </span>
        <span>{after}</span>
      </p>
      {result && !result.correct && right && (
        <p className="text-center font-bold text-grass-strong">
          {t("rightChip").regional}: <span className="font-mono">{right}</span>
          <span className="block text-sm font-medium text-stone">{t("rightChip").english}</span>
        </p>
      )}
      <div role="radiogroup" aria-label={t("chooseChip").english} className="flex flex-wrap justify-center gap-2">
        {content.chips.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={chip === c}
            disabled={locked}
            onClick={() => setChip(c)}
            className={cn("min-h-12 min-w-16 rounded-button border-2 border-b-4 px-4 font-mono text-lg font-bold", chip === c ? "border-sky-strong bg-sky-soft" : "border-line bg-white hover:bg-cream")}
          >
            {c}
          </button>
        ))}
      </div>
      {!result && <CheckButton disabled={!chip} busy={busy} onClick={() => chip && onAnswer({ type: "fill_formula", chip })} />}
    </div>
  );
}

/**
 * Match pairs: tap a left item, then its partner on the right. A wrong pair
 * shakes and costs no heart (PRD M3); the question is sent once everything
 * is matched, with the number of mistakes.
 */
export function MatchPairsQuestion({ id, content, terms, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "match_pairs" }>>) {
  const tri = useTri();
  const t = useBilingual("lesson");
  const n = content.pairs.length;
  const rightOrder = useMemo(() => seededOrder(n, id), [n, id]);
  const [left, setLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const locked = Boolean(result) || busy;

  const pickRight = (r: number) => {
    if (left === null || locked || matched.includes(r)) return;
    if (r === left) {
      const next = [...matched, r];
      setMatched(next);
      setLeft(null);
      if (next.length === n) onAnswer({ type: "match_pairs", pairs: next.map((i) => [i, i] as [number, number]), mistakes });
    } else {
      setMistakes((m) => m + 1);
      setWrong(r);
      setTimeout(() => setWrong(null), 450);
    }
  };

  const cell = (active: boolean, done: boolean, bad: boolean) =>
    cn(
      "flex min-h-14 w-full items-center rounded-card border-2 border-b-4 px-3 py-2 text-left",
      done ? "border-grass-strong bg-[#ecf8e4] opacity-80" : active ? "border-sky-strong bg-sky-soft" : "border-line bg-white hover:bg-cream",
      bad && "border-coral-strong bg-[#fdeeed] motion-safe:animate-[shake_.35s_ease-in-out]",
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-stone" aria-live="polite">
        {t("matchProgress", { done: matched.length, total: n }).regional} · {t("matchProgress", { done: matched.length, total: n }).english}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ul className="flex flex-col gap-3" aria-label={t("matchLeft").english}>
          {content.pairs.map((p, i) => (
            <li key={i}>
              <button type="button" disabled={locked || matched.includes(i)} aria-pressed={left === i} onClick={() => setLeft(i)} className={cell(left === i, matched.includes(i), false)}>
                <BilingualText as="span" size="sm" text={tri(optionText(p.left, terms))} />
              </button>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-3" aria-label={t("matchRight").english}>
          {rightOrder.map((r) => (
            <li key={r}>
              <button type="button" disabled={locked || matched.includes(r)} onClick={() => pickRight(r)} className={cell(false, matched.includes(r), wrong === r)} data-testid={`match-right-${r}`}>
                <BilingualText as="span" size="sm" text={tri(optionText(content.pairs[r]!.right, terms))} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {mistakes > 0 && !result && (
        <p className="text-sm text-stone">
          {t("matchNoHeart").regional} · {t("matchNoHeart").english}
        </p>
      )}
    </div>
  );
}

export function QuestionBody(props: Omit<QuestionProps<QuestionContent>, "content"> & { content: QuestionContent }) {
  const c = props.content;
  switch (c.type) {
    case "multiple_choice":
      return <MultipleChoiceQuestion {...props} content={c} />;
    case "true_false":
      return <TrueFalseQuestion {...props} content={c} />;
    case "fill_formula":
      return <FillFormulaQuestion {...props} content={c} />;
    case "match_pairs":
      return <MatchPairsQuestion {...props} content={c} />;
  }
}
