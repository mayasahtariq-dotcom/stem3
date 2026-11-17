import type { Schemas } from "@mooshala/api-client";
import { draftProblem, draftToQuestion, publishBlock, reviewItems, toDraft } from "./review";
import { allPagesDone, formProblem, initialRun, kindForFile, pageProblem, runReducer, UPLOAD_RULES, type PageDraft } from "./upload";
import { filterStudents, needsHelp } from "./students";

const tri = (en: string) => ({ en, hi: `${en}-hi`, kn: `${en}-kn` });
const lesson = (questions: Partial<Schemas["QuestionOut"]>[], status = "ready"): Schemas["LessonOut"] => ({
  id: "l1",
  course_id: "c1",
  title: tri("Lesson"),
  generation_status: status,
  published: false,
  terms: { nucleus: { forms: tri("Nucleus") } },
  questions: questions.map((q, i) => ({ id: `q${i}`, position: i + 1, type: "true_false", content: { prompt: tri("TF"), statement: tri("Cells are small."), answer: true, explanation: tri("Yes") }, source_page: 2, confidence: 0.9, flag_reason: null, call_safe: true, teacher_edited: false, ...q })),
});

describe("review", () => {
  it("shows each question's prompt, correct answer, confidence and flag", () => {
    const items = reviewItems(
      lesson([
        { type: "multiple_choice", content: { prompt: tri("Which controls the cell?"), options: [{ term_key: "nucleus" }, { text: tri("Wall") }], correct_index: 0, explanation: tri("Boss") }, confidence: 0.4, flag_reason: "Blurry" },
        { position: 0 },
      ]),
    );
    expect(items.map((i) => i.id)).toEqual(["q1", "q0"]);
    const mc = items[1]!;
    expect(mc.answer).toEqual(tri("Nucleus"));
    expect(mc.flagReason).toBe("Blurry");
    expect(items[0]!.prompt.en).toBe("Cells are small.");
    expect(items[0]!.answer.en).toBe("True");
  });

  it("blocks publishing while generating, empty or flagged", () => {
    expect(publishBlock(lesson([{}], "generating"))).toBe("notReady");
    expect(publishBlock(lesson([]))).toBe("noQuestions");
    expect(publishBlock(lesson([{ flag_reason: "x" }]))).toBe("flagged");
    expect(publishBlock(lesson([{}]))).toBeNull();
  });

  it("validates a draft and builds the full question for PUT /questions", () => {
    const [item] = reviewItems(lesson([{ type: "fill_formula", content: { prompt: tri("Fill"), formula: "A + __", answer: "B", chips: ["B", "C"], explanation: tri("E") } }]));
    const d = toDraft(item!);
    expect(draftProblem({ ...d, formula: "A + B" }, item!)).toBe("formulaBlank");
    expect(draftProblem({ ...d, answerChip: "Z" }, item!)).toBe("chipMissing");
    expect(draftProblem({ ...d, prompt: { en: " ", hi: "", kn: "" } }, item!)).toBe("promptMissing");
    const q = draftToQuestion({ ...d, answerChip: "C", prompt: { en: "Fill it", hi: "", kn: "" } }, item!);
    expect(q).toMatchObject({ type: "fill_formula", answer: "C", chips: ["B", "C"], prompt: { en: "Fill it", hi: "Fill it", kn: "Fill it" } });
  });
});

describe("upload rules", () => {
  const page = (p: Partial<PageDraft>): PageDraft => ({ key: "k", kind: "photo", name: "a.jpg", size: 100, ...p });
  it("checks file type, size and empty text like the backend", () => {
    expect(kindForFile({ type: "image/jpeg", name: "x" })).toBe("photo");
    expect(kindForFile({ type: "", name: "notes.PDF" })).toBe("pdf");
    expect(kindForFile({ type: "image/png", name: "x.png" })).toBeNull();
    expect(pageProblem(page({ size: UPLOAD_RULES.photoBytes + 1 }))).toBe("tooLarge");
    expect(pageProblem(page({ kind: "pdf", size: UPLOAD_RULES.pdfBytes + 1 }))).toBe("tooLarge");
    expect(pageProblem(page({ kind: "pdf", size: UPLOAD_RULES.pdfBytes }))).toBeNull();
    expect(pageProblem(page({ kind: "text", text: "  " }))).toBe("emptyText");
    expect(pageProblem(page({ unsupported: true }))).toBe("wrongType");
  });
  it("limits pages to ten", () => {
    const meta = { subject: "BI" as const, grade: 9, classroomId: null };
    expect(formProblem([], meta)).toBe("noPages");
    expect(formProblem(Array.from({ length: 11 }, () => page({})), meta)).toBe("tooManyPages");
    expect(formProblem([page({})], { ...meta, grade: 5 })).toBe("gradeRange");
    expect(formProblem([page({})], meta)).toBeNull();
  });
});

describe("upload run", () => {
  it("never reports success before the server says ready with a course", () => {
    let r = runReducer(initialRun, { type: "create", pageCount: 2 });
    r = runReducer(r, { type: "created", uploadId: "u1", textPages: [1] });
    expect(allPagesDone(r)).toBe(false);
    expect(runReducer(r, { type: "start" }).phase).toBe("uploading");
    r = runReducer(r, { type: "pageFailed", index: 0 });
    expect(r.pages[0]!.state).toBe("error");
    r = runReducer(r, { type: "pageDone", index: 0 });
    r = runReducer(r, { type: "start" });
    expect(r.phase).toBe("starting");
    r = runReducer(r, { type: "status", status: { status: "ready", steps: ["queued"], error: null, course_id: null, first_lesson_id: null } });
    expect(r.phase).toBe("processing");
    r = runReducer(r, { type: "status", status: { status: "ready", steps: ["queued", "ready"], error: null, course_id: "c9", first_lesson_id: "l9" } });
    expect(r).toMatchObject({ phase: "ready", courseId: "c9" });
  });
  it("shows the pipeline's failure", () => {
    const r = runReducer({ ...initialRun, phase: "processing" }, { type: "status", status: { status: "failed", steps: ["queued"], error: "No readable text", course_id: null, first_lesson_id: null } });
    expect(r).toMatchObject({ phase: "failed", pipelineError: "No readable text" });
  });
});

describe("students", () => {
  const row = (name: string, x: Partial<Schemas["StudentRow"]> = {}): Schemas["StudentRow"] => ({ id: name, name, streak: 1, current_lesson: null, accuracy: 0.8, idle_days: 0, idle: false, behind: false, overdue: 0, ...x });
  it("puts overdue and struggling students first", () => {
    const rows = [row("A"), row("B", { idle: true, idle_days: 10 }), row("C", { behind: true, overdue: 2 }), row("D", { behind: true, accuracy: 0.4 })];
    expect(needsHelp(rows).map((r) => r.name)).toEqual(["C", "D", "B"]);
    expect(filterStudents(rows, "all", "", "accuracy")[0]!.name).toBe("D");
    expect(filterStudents(rows, "all", "b", "name").map((r) => r.name)).toEqual(["B"]);
  });
});
