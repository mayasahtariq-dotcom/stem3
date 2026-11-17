import type { Schemas } from "@mooshala/api-client";
import { optionText, type TermMap } from "@/features/learning/content";
import type { Tri } from "@/lib/i18n/use-tri";

/**
 * Pure review logic for AI-made lessons: what a teacher sees about each
 * question, the editable draft, the payload PUT /questions expects, and
 * whether a lesson may be published.
 */
export type QuestionType = "multiple_choice" | "true_false" | "fill_formula" | "match_pairs";
type Content = Record<string, unknown>;

const asTri = (v: unknown): Tri => {
  const o = (v ?? {}) as Partial<Tri>;
  return { en: o.en ?? "", hi: o.hi ?? "", kn: o.kn ?? "" };
};

export interface ReviewItem {
  id: string;
  position: number;
  type: QuestionType;
  content: Content;
  prompt: Tri;
  answer: Tri;
  explanation: Tri;
  sourcePage: number;
  confidence: number;
  flagReason: string | null;
  edited: boolean;
}

/** A low-confidence question is shown with its confidence even when not flagged. */
export const LOW_CONFIDENCE = 0.7;

export function answerOf(type: QuestionType, c: Content, terms: TermMap): Tri {
  switch (type) {
    case "multiple_choice": {
      const opts = (c.options ?? []) as { term_key?: string | null; text?: Tri | null }[];
      const i = Number(c.correct_index);
      return opts[i] ? optionText(opts[i]!, terms) : asTri(null);
    }
    case "true_false":
      return c.answer ? { en: "True", hi: "सही", kn: "ಸರಿ" } : { en: "False", hi: "गलत", kn: "ತಪ್ಪು" };
    case "fill_formula": {
      const a = String(c.answer ?? "");
      return { en: a, hi: a, kn: a };
    }
    case "match_pairs": {
      const pairs = (c.pairs ?? []) as { left: { term_key?: string | null; text?: Tri | null }; right: { term_key?: string | null; text?: Tri | null } }[];
      const join = (k: keyof Tri) => pairs.map((p) => `${optionText(p.left, terms)[k]} → ${optionText(p.right, terms)[k]}`).join(", ");
      return { en: join("en"), hi: join("hi"), kn: join("kn") };
    }
  }
}

export function reviewItems(lesson: Schemas["LessonOut"]): ReviewItem[] {
  const terms = (lesson.terms ?? {}) as TermMap;
  return [...lesson.questions]
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      const type = q.type as QuestionType;
      const c = q.content as Content;
      return {
        id: q.id,
        position: q.position,
        type,
        content: c,
        prompt: type === "true_false" ? asTri(c.statement) : type === "fill_formula" ? { ...asTri(c.prompt), en: `${asTri(c.prompt).en} ${String(c.formula ?? "")}`.trim() } : asTri(c.prompt),
        answer: answerOf(type, c, terms),
        explanation: asTri(c.explanation),
        sourcePage: q.source_page,
        confidence: q.confidence,
        flagReason: q.flag_reason ?? null,
        edited: q.teacher_edited,
      };
    });
}

export const isFlagged = (i: Pick<ReviewItem, "flagReason">) => Boolean(i.flagReason);

export type PublishBlock = "notReady" | "noQuestions" | "flagged" | null;

/** Why a lesson can't be published yet (null when it can). */
export function publishBlock(lesson: Pick<Schemas["LessonOut"], "generation_status" | "questions">): PublishBlock {
  if (lesson.generation_status !== "ready") return "notReady";
  if (!lesson.questions.length) return "noQuestions";
  if (lesson.questions.some((q) => q.flag_reason)) return "flagged";
  return null;
}

/** The editable parts of a question. Options and pairs keep their term links. */
export interface QuestionDraft {
  type: QuestionType;
  prompt: Tri;
  explanation: Tri;
  statement: Tri;
  correctIndex: number;
  answerBool: boolean;
  formula: string;
  answerChip: string;
}

export function toDraft(item: ReviewItem): QuestionDraft {
  const c = item.content;
  return {
    type: item.type,
    prompt: asTri(c.prompt),
    explanation: asTri(c.explanation),
    statement: asTri(c.statement),
    correctIndex: Number(c.correct_index ?? 0),
    answerBool: Boolean(c.answer),
    formula: String(c.formula ?? ""),
    answerChip: String(c.answer ?? ""),
  };
}

export type DraftProblem = "promptMissing" | "statementMissing" | "formulaBlank" | "chipMissing" | null;

export function draftProblem(d: QuestionDraft, item: ReviewItem): DraftProblem {
  if (d.type !== "true_false" && !d.prompt.en.trim()) return "promptMissing";
  if (d.type === "true_false" && !d.statement.en.trim()) return "statementMissing";
  if (d.type === "fill_formula" && !d.formula.includes("__")) return "formulaBlank";
  if (d.type === "fill_formula" && !((item.content.chips ?? []) as string[]).includes(d.answerChip)) return "chipMissing";
  return null;
}

/** The body for PUT /questions/{id}: the full question with the draft applied. */
export function draftToQuestion(d: QuestionDraft, item: ReviewItem): Record<string, unknown> {
  const clean = (t: Tri): Tri => ({ en: t.en.trim(), hi: t.hi.trim() || t.en.trim(), kn: t.kn.trim() || t.en.trim() });
  const q: Record<string, unknown> = { ...item.content, type: d.type, prompt: clean(d.prompt), explanation: clean(d.explanation) };
  if (d.type === "multiple_choice") q.correct_index = d.correctIndex;
  if (d.type === "true_false") Object.assign(q, { statement: clean(d.statement), answer: d.answerBool });
  if (d.type === "fill_formula") Object.assign(q, { formula: d.formula.trim(), answer: d.answerChip });
  return q;
}

/** Options as text, for the correct-answer picker. */
export function optionLabels(item: ReviewItem, terms: TermMap): Tri[] {
  return ((item.content.options ?? []) as { term_key?: string | null; text?: Tri | null }[]).map((o) => optionText(o, terms));
}
