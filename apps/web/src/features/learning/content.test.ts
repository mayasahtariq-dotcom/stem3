import type { Schemas } from "@mooshala/api-client";
import { buildLessons, termContent, TERMS } from "@/mocks/learning/course-data";
import { answerPayload, optionText, QUESTION_TYPES, seededOrder, toPlayableLesson } from "./content";

const lessonOut = (i = 1): Schemas["LessonOut"] => {
  const l = buildLessons()[i]!;
  return {
    id: l.id,
    course_id: "course-cell",
    title: l.title,
    generation_status: "ready",
    published: true,
    questions: l.questions.map((q) => ({ id: q.id, position: q.position, type: q.type, content: q.content, source_page: q.source_page, confidence: 0.9, flag_reason: null, call_safe: q.call_safe, teacher_edited: false })),
    terms: Object.fromEntries(Object.keys(TERMS).map((k) => [k, termContent(k)])),
  };
};

describe("question content", () => {
  it("parses all four documented question types from backend JSON", () => {
    const types = new Set(buildLessons().flatMap((l, i) => toPlayableLesson(lessonOut(i)).questions.map((q) => q.content.type)));
    expect([...types].sort()).toEqual([...QUESTION_TYPES].sort());
  });

  it("skips a malformed question instead of breaking the lesson", () => {
    const out = lessonOut();
    out.questions.push({ ...out.questions[0]!, id: "bad", position: 99, type: "multiple_choice", content: { prompt: { en: "x" } } });
    const lesson = toPlayableLesson(out);
    expect(lesson.questions.map((q) => q.id)).not.toContain("bad");
    expect(lesson.questions.length).toBe(out.questions.length - 1);
  });

  it("resolves options that point to a term, in every language", () => {
    const lesson = toPlayableLesson(lessonOut());
    expect(optionText({ term_key: "nucleus" }, lesson.terms)).toEqual({ en: "Nucleus", hi: "केंद्रक", kn: "ಕೋಶಕೇಂದ್ರ" });
    expect(optionText({ text: { en: "Fence", hi: "बाड़", kn: "ಬೇಲಿ" } }, lesson.terms).en).toBe("Fence");
  });

  it("shuffles match pairs the same way every time, never in the original order", () => {
    expect(seededOrder(4, "q-2-2")).toEqual(seededOrder(4, "q-2-2"));
    for (const seed of ["a", "b", "q-1-1", "q-9-9"]) {
      const o = seededOrder(3, seed);
      expect([...o].sort()).toEqual([0, 1, 2]);
      expect(o).not.toEqual([0, 1, 2]);
    }
  });

  it("builds the answer shapes the backend grades", () => {
    expect(answerPayload({ type: "multiple_choice", index: 1 })).toEqual({ index: 1 });
    expect(answerPayload({ type: "true_false", value: false })).toEqual({ value: false });
    expect(answerPayload({ type: "fill_formula", chip: "Organ" })).toEqual({ chip: "Organ" });
    expect(answerPayload({ type: "match_pairs", pairs: [[0, 0]], mistakes: 2 })).toEqual({ pairs: [[0, 0]], mistakes: 2 });
  });
});
