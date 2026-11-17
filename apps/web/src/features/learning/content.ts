import { z } from "zod";
import type { Schemas } from "@mooshala/api-client";
import type { Tri } from "@/lib/i18n/use-tri";

/**
 * Parses question content from the backend (QuestionOut.content, shaped by
 * backend/app/ai/schemas.py) into typed questions. A question that doesn't
 * parse is skipped rather than crashing the lesson.
 */
const tri = z.object({ en: z.string(), hi: z.string(), kn: z.string() });
const optionRef = z.object({ term_key: z.string().nullish(), text: tri.nullish() });
const common = { prompt: tri, explanation: tri, source_page: z.number().int().optional() };

const mc = z.object({ type: z.literal("multiple_choice"), ...common, options: z.array(optionRef).min(2), correct_index: z.number().int().optional() });
const match = z.object({ type: z.literal("match_pairs"), ...common, pairs: z.array(z.object({ left: optionRef, right: optionRef })).min(2) });
const fill = z.object({ type: z.literal("fill_formula"), ...common, formula: z.string().includes("__"), chips: z.array(z.string()).min(2) });
const tf = z.object({ type: z.literal("true_false"), ...common, statement: tri });

export const questionContent = z.discriminatedUnion("type", [mc, match, fill, tf]);
export type QuestionContent = z.infer<typeof questionContent>;
export type QuestionType = QuestionContent["type"];
export const QUESTION_TYPES: QuestionType[] = ["multiple_choice", "match_pairs", "fill_formula", "true_false"];

export interface PlayableQuestion {
  id: string;
  position: number;
  sourcePage: number;
  content: QuestionContent;
}

export type TermMap = Record<string, { forms?: Tri; meaning?: Tri; analogy?: Tri } & Record<string, unknown>>;

export interface PlayableLesson {
  id: string;
  courseId: string;
  title: Tri;
  questions: PlayableQuestion[];
  terms: TermMap;
}

export function toPlayableLesson(lesson: Schemas["LessonOut"]): PlayableLesson {
  const questions: PlayableQuestion[] = [];
  for (const q of [...lesson.questions].sort((a, b) => a.position - b.position)) {
    const parsed = questionContent.safeParse({ ...q.content, type: q.type });
    if (parsed.success) questions.push({ id: q.id, position: q.position, sourcePage: q.source_page, content: parsed.data });
  }
  return { id: lesson.id, courseId: lesson.course_id, title: lesson.title as Tri, questions, terms: (lesson.terms ?? {}) as TermMap };
}

/** An option's text: its own text, or the term it points to (in every language). */
export function optionText(opt: z.infer<typeof optionRef>, terms: TermMap): Tri {
  if (opt.text) return opt.text;
  const forms = opt.term_key ? terms[opt.term_key]?.forms : undefined;
  return forms ?? { en: opt.term_key ?? "", hi: opt.term_key ?? "", kn: opt.term_key ?? "" };
}

/** Deterministic shuffle (seeded by the question id) so a resumed lesson looks the same. */
export function seededOrder(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Never show the right column in the same order as the left one.
  if (n > 1 && out.every((v, i) => v === i)) out.push(out.shift()!);
  return out;
}

/** The answer shapes POST /attempts accepts (backend/app/learning/rules.py `grade`). */
export type Answer =
  | { type: "multiple_choice"; index: number }
  | { type: "true_false"; value: boolean }
  | { type: "fill_formula"; chip: string }
  | { type: "match_pairs"; pairs: [number, number][]; mistakes: number };

export function answerPayload(a: Answer): Record<string, unknown> {
  switch (a.type) {
    case "multiple_choice":
      return { index: a.index };
    case "true_false":
      return { value: a.value };
    case "fill_formula":
      return { chip: a.chip };
    case "match_pairs":
      return { pairs: a.pairs, mistakes: a.mistakes };
  }
}
