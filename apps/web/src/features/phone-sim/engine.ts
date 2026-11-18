import type { Tri } from "@/lib/i18n/use-tri";

/*
 * The phone lesson engine. It knows nothing about keypads, keyboards, speech or React: an input adapter
 * (the on-screen keypad and physical keyboard today, real DTMF from a telephony webhook later) calls the
 * control methods below, and a voice/transcript layer renders the lines it emits.
 * All grading, XP and progress happen on the server through the same endpoints the app uses (CallBackend).
 */

export type Phase =
  | "idle"
  | "connecting"
  | "enter_id"
  | "enter_pin"
  | "authenticating"
  | "menu"
  | "choose_course"
  | "choose_lesson"
  | "loading"
  | "answering"
  | "submitting"
  | "feedback"
  | "completed"
  | "ended";

export type Param = string | number | Tri;
/** One spoken line: a message key with values, or raw course content (`tri`). */
export type Prompt = { key: string; params?: Record<string, Param> } | { tri: Tri };
export type Line = { who: "ai" | "me"; parts: Prompt[] };

export interface SimStudent {
  name: string;
}
export interface SimCourse {
  id: string;
  title: Tri;
}
export interface SimLesson {
  id: string;
  title: Tri;
  done: boolean;
}
export interface SimQuestion {
  id: string;
  prompt: Tri;
  options: Tri[];
  /** 1 for every current question type; the engine also supports multi-select questions. */
  maxSelections: number;
  /** A second go at a question answered wrongly earlier in this lesson (the server needs every question right). */
  retry?: boolean;
  /** The POST /attempts answer for the chosen option indexes. */
  toAnswer: (selected: number[]) => Record<string, unknown>;
  /** The index of the right option from the server's correct_answer, if it can tell. */
  correctIndex: (correctAnswer: Record<string, unknown>) => number | null;
}
export interface Graded {
  correct: boolean;
  correctAnswer: Record<string, unknown>;
  explanation: Tri | null;
  xp: number;
}
export interface SessionPatch {
  status: "active" | "completed" | "ended";
  answered: number;
  correct: number;
  incorrect: number;
  question_index: number;
  question_count: number;
  lessons_completed: number;
  seconds: number;
}
export class SimAuthError extends Error {
  constructor(public reason: "unknown_id" | "bad_pin" | "not_student" | "failed") {
    super(reason);
  }
}

/** Everything the engine needs from outside; real (app API) and fake versions exist. */
export interface CallBackend {
  /** Checks the student ID exists and readies the PIN check. */
  checkId(studentId: string): Promise<void>;
  signIn(studentId: string, pin: string): Promise<SimStudent>;
  courses(): Promise<{
    courses: SimCourse[];
    continueLesson: { courseId: string; lessonId: string; title: Tri } | null;
  }>;
  lessons(courseId: string): Promise<SimLesson[]>;
  openLesson(lessonId: string, resume: boolean): Promise<{ title: Tri; questions: SimQuestion[] }>;
  submit(questionId: string, answer: Record<string, unknown>, elapsedMs: number, retry: boolean): Promise<Graded>;
  complete(lessonId: string): Promise<{ xp: number; accuracy: number }>;
  startSession(lessonId: string): Promise<string | null>;
  updateSession(id: string, patch: SessionPatch): Promise<void>;
}

export interface ResumePoint {
  lessonId: string;
  index: number;
}
export interface ResumeStore {
  get(studentId: string): ResumePoint | null;
  set(studentId: string, p: ResumePoint): void;
  clear(studentId: string): void;
}

export interface CallState {
  phase: Phase;
  lines: Line[];
  entry: string;
  student: SimStudent | null;
  courses: SimCourse[];
  lessons: SimLesson[];
  lessonTitle: Tri | null;
  questions: SimQuestion[];
  index: number;
  selection: number[];
  lastResult: { correct: boolean; correctIndex: number | null } | null;
  score: { correct: number; incorrect: number; xp: number };
  startedAt: number | null;
  endedAt: number | null;
  /** Bumps whenever the AI should speak the newest lines. */
  speakSeq: number;
}

export const MAX_CHOICES = 5;

const initial = (): CallState => ({
  phase: "idle",
  lines: [],
  entry: "",
  student: null,
  courses: [],
  lessons: [],
  lessonTitle: null,
  questions: [],
  index: 0,
  selection: [],
  lastResult: null,
  score: { correct: 0, incorrect: 0, xp: 0 },
  startedAt: null,
  endedAt: null,
  speakSeq: 0,
});

const p = (key: string, params?: Record<string, Param>): Prompt => ({ key, params });

export class CallEngine {
  state: CallState = initial();
  private listeners = new Set<(s: CallState) => void>();
  private studentId = "";
  private lessonId = "";
  private sessionId: string | null = null;
  private shownAt = 0;
  private run = 0; // bumps on hang-up so late server replies are dropped

  constructor(
    private backend: CallBackend,
    private resume: ResumeStore,
    private now: () => number = () => Date.now(),
  ) {}

  subscribe(fn: (s: CallState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }
  private say(...parts: Prompt[]) {
    this.set({
      lines: [...this.state.lines, { who: "ai", parts }],
      speakSeq: this.state.speakSeq + 1,
    });
  }
  private heard(key: string) {
    this.set({ lines: [...this.state.lines, { who: "me", parts: [p("pressed", { key })] }] });
  }
  private get question(): SimQuestion | null {
    return this.state.questions[this.state.index] ?? null;
  }
  get live(): boolean {
    return !["idle", "ended"].includes(this.state.phase);
  }
  get seconds(): number {
    const { startedAt, endedAt } = this.state;
    return startedAt ? Math.floor(((endedAt ?? this.now()) - startedAt) / 1000) : 0;
  }

  // ---------- call lifecycle ----------
  dial() {
    if (this.live) return;
    this.run++;
    this.set({
      ...initial(),
      phase: "connecting",
      startedAt: this.now(),
      speakSeq: this.state.speakSeq,
    });
    this.say(p("connecting"));
    const my = this.run;
    queueMicrotask(() => {
      if (my !== this.run) return;
      this.set({ phase: "enter_id" });
      this.say(p("greeting"), p("askId"));
    });
  }

  hangUp() {
    if (!this.live) return;
    this.run++;
    if (this.sessionId)
      void this.backend
        .updateSession(
          this.sessionId,
          this.patch(this.state.phase === "completed" ? "completed" : "ended"),
        )
        .catch(() => {});
    this.sessionId = null;
    this.set({ phase: "ended", endedAt: this.now() });
    this.say(p("goodbye"));
  }

  // ---------- ID and PIN entry ----------
  digit(d: string) {
    if (this.state.phase !== "enter_id" && this.state.phase !== "enter_pin") return;
    if (this.state.entry.length >= (this.state.phase === "enter_id" ? 10 : 6)) return;
    this.set({ entry: this.state.entry + d });
  }
  backspace() {
    if (this.state.phase === "enter_id" || this.state.phase === "enter_pin")
      this.set({ entry: this.state.entry.slice(0, -1) });
  }

  async submitEntry() {
    const { phase, entry } = this.state;
    const my = this.run;
    if (phase === "enter_id") {
      if (!/^\d{10}$/.test(entry)) return this.say(p("badId"));
      this.set({ phase: "authenticating" });
      try {
        await this.backend.checkId(entry);
        if (my !== this.run) return;
        this.studentId = entry;
        this.set({ phase: "enter_pin", entry: "" });
        this.say(p("askPin"));
      } catch (e) {
        if (my !== this.run) return;
        this.set({ phase: "enter_id", entry: "" });
        this.say(
          p(e instanceof SimAuthError && e.reason === "unknown_id" ? "unknownId" : "authFailed"),
          p("askId"),
        );
      }
      return;
    }
    if (phase === "enter_pin") {
      if (!/^\d{4,6}$/.test(entry)) return this.say(p("badPin"));
      this.set({ phase: "authenticating" });
      try {
        const student = await this.backend.signIn(this.studentId, entry);
        if (my !== this.run) return;
        this.set({ student, entry: "" });
        this.say(p("welcome", { name: student.name }));
        await this.menu();
      } catch (e) {
        if (my !== this.run) return;
        const reason = e instanceof SimAuthError ? e.reason : "failed";
        this.set({ phase: reason === "not_student" ? "enter_id" : "enter_pin", entry: "" });
        this.say(
          p(
            reason === "bad_pin"
              ? "badPinTryAgain"
              : reason === "not_student"
                ? "notStudent"
                : "authFailed",
          ),
          p(reason === "not_student" ? "askId" : "askPin"),
        );
      }
    }
  }

  /** Demo shortcut: types the ID and PIN as if keyed in. */
  async quickSignIn(id: string, pin: string) {
    if (!this.live) this.dial();
    await Promise.resolve();
    if (this.state.phase !== "enter_id") return;
    this.set({ entry: id });
    await this.submitEntry();
    if ((this.state.phase as Phase) !== "enter_pin") return;
    this.set({ entry: pin });
    await this.submitEntry();
  }

  // ---------- menus ----------
  private continueTo: { courseId: string; lessonId: string; title: Tri } | null = null;

  private async menu() {
    const my = this.run;
    this.set({ phase: "loading" });
    try {
      const { courses, continueLesson } = await this.backend.courses();
      if (my !== this.run) return;
      const saved = this.resume.get(this.studentId);
      this.continueTo = continueLesson;
      if (saved && continueLesson && saved.lessonId !== continueLesson.lessonId)
        this.continueTo = { ...continueLesson, lessonId: saved.lessonId };
      this.set({ phase: "menu", courses: courses.slice(0, MAX_CHOICES) });
      this.sayMenu();
    } catch {
      if (my !== this.run) return;
      this.set({ phase: "menu", courses: [] });
      this.say(p("loadFailed"));
    }
  }
  private sayMenu() {
    if (this.state.courses.length === 0) return this.say(p("noCourses"));
    this.say(
      this.continueTo ? p("menuContinue", { lesson: this.continueTo.title }) : p("menuNoContinue"),
    );
  }

  /** Menu key 1: continue where they left off. */
  async continueLesson() {
    if (this.state.phase !== "menu") return;
    if (!this.continueTo) return this.chooseCourseMenu();
    const saved = this.resume.get(this.studentId);
    await this.openLesson(
      this.continueTo.lessonId,
      saved?.lessonId === this.continueTo.lessonId ? saved.index : 0,
    );
  }

  chooseCourseMenu() {
    if (this.state.phase !== "menu" && this.state.phase !== "completed") return;
    if (this.state.courses.length === 0) return this.say(p("noCourses"));
    this.set({ phase: "choose_course" });
    this.sayList(
      "pickCourse",
      this.state.courses.map((c) => c.title),
    );
  }

  private sayList(head: string, titles: Tri[]) {
    this.say(
      p(head),
      ...titles.map((title, i) => p("listItem", { n: i + 1, title })),
      p("listHint"),
    );
  }

  /** Keys 1-5 on a course or lesson list. */
  async choose(n: number) {
    const my = this.run;
    if (this.state.phase === "choose_course") {
      const course = this.state.courses[n - 1];
      if (!course) return this.say(p("noSuchChoice", { n }));
      this.set({ phase: "loading" });
      try {
        const lessons = (await this.backend.lessons(course.id)).slice(0, MAX_CHOICES);
        if (my !== this.run) return;
        if (lessons.length === 0) {
          this.set({ phase: "choose_course" });
          return this.say(p("noLessons"));
        }
        this.set({ phase: "choose_lesson", lessons });
        this.sayList(
          "pickLesson",
          lessons.map((l) => l.title),
        );
      } catch {
        if (my !== this.run) return;
        this.set({ phase: "choose_course" });
        this.say(p("loadFailed"));
      }
      return;
    }
    if (this.state.phase === "choose_lesson") {
      const lesson = this.state.lessons[n - 1];
      if (!lesson) return this.say(p("noSuchChoice", { n }));
      const saved = this.resume.get(this.studentId);
      await this.openLesson(lesson.id, saved?.lessonId === lesson.id ? saved.index : 0);
    }
  }

  private async openLesson(lessonId: string, startAt: number) {
    const my = this.run;
    const back = this.state.phase;
    this.set({ phase: "loading" });
    try {
      const lesson = await this.backend.openLesson(lessonId, startAt > 0);
      if (my !== this.run) return;
      if (lesson.questions.length === 0) {
        this.set({ phase: back });
        return this.say(p("notPhoneReady"));
      }
      this.lessonId = lessonId;
      const index = Math.min(startAt, lesson.questions.length - 1);
      this.sessionId = await this.backend.startSession(lessonId).catch(() => null);
      if (my !== this.run) return;
      this.set({
        lessonTitle: lesson.title,
        questions: lesson.questions,
        index,
        selection: [],
        lastResult: null,
        score: { correct: 0, incorrect: 0, xp: 0 },
      });
      this.say(
        index > 0
          ? p("resuming", { lesson: lesson.title, n: index + 1 })
          : p("starting", { lesson: lesson.title, count: lesson.questions.length }),
        p("keyHelpShort"),
      );
      this.askQuestion();
    } catch {
      if (my !== this.run) return;
      this.set({ phase: back });
      this.say(p("loadFailed"));
    }
  }

  // ---------- questions: the functions a real DTMF handler would call ----------
  private askQuestion() {
    const q = this.question;
    if (!q) return;
    this.shownAt = this.now();
    this.set({ phase: "answering", selection: [], lastResult: null });
    this.say(
      p("questionN", { n: this.state.index + 1, of: this.state.questions.length }),
      { tri: q.prompt },
      ...q.options.map((title, i) => p("option", { n: i + 1, title })),
      p("pressNumber"),
    );
  }

  repeatQuestion() {
    const q = this.question;
    if (!q || (this.state.phase !== "answering" && this.state.phase !== "feedback")) return;
    this.say({ tri: q.prompt }, ...q.options.map((title, i) => p("option", { n: i + 1, title })), p("pressNumber"));
  }

  selectOption(n: number) {
    const q = this.question;
    if (!q || this.state.phase !== "answering") return;
    if (n < 1 || n > q.options.length)
      return this.say(p("noSuchOption", { n, max: q.options.length }));
    const i = n - 1;
    let selection: number[];
    if (q.maxSelections === 1) {
      if (this.state.selection[0] === i) return this.say(p("alreadySelected", { n }));
      selection = [i];
    } else if (this.state.selection.includes(i)) {
      selection = this.state.selection.filter((x) => x !== i); // multi-select: pressing again removes it
    } else {
      if (this.state.selection.length >= q.maxSelections)
        return this.say(p("tooMany", { max: q.maxSelections }));
      selection = [...this.state.selection, i].sort((a, b) => a - b);
    }
    this.set({ selection });
    this.say(p("selected", { n, title: q.options[i]! }), p("confirmHint"));
  }

  readSelection() {
    const q = this.question;
    if (!q || this.state.phase !== "answering") return;
    if (this.state.selection.length === 0) return this.say(p("nothingSelected"));
    this.say(
      p("yourSelection"),
      ...this.state.selection.map((i) => p("option", { n: i + 1, title: q.options[i]! })),
    );
  }

  clearSelection() {
    if (this.state.phase !== "answering") return;
    this.set({ selection: [] });
    this.say(p("cleared"));
  }

  async confirm() {
    const q = this.question;
    if (!q || this.state.phase !== "answering") return; // a second 9 while submitting does nothing
    if (this.state.selection.length === 0) return this.say(p("chooseFirst"));
    const my = this.run;
    const selection = this.state.selection;
    this.set({ phase: "submitting" });
    try {
      const res = await this.backend.submit(q.id, q.toAnswer(selection), this.now() - this.shownAt, Boolean(q.retry));
      if (my !== this.run) return;
      const correctIndex = q.correctIndex(res.correctAnswer);
      const score = {
        correct: this.state.score.correct + (res.correct ? 1 : 0),
        incorrect: this.state.score.incorrect + (res.correct ? 0 : 1),
        xp: this.state.score.xp + res.xp,
      };
      // like the app: a question answered wrongly comes back at the end until it is right
      const questions = res.correct ? this.state.questions : [...this.state.questions, { ...q, retry: true }];
      this.set({ phase: "feedback", lastResult: { correct: res.correct, correctIndex }, score, questions });
      const fb: Prompt[] = [
        res.correct
          ? p("correct", { xp: res.xp })
          : correctIndex !== null
            ? p("notQuiteAnswer", { n: correctIndex + 1, title: q.options[correctIndex]! })
            : p("notQuite"),
      ];
      if (res.explanation && res.explanation.en) fb.push({ tri: res.explanation });
      const last = this.state.index + 1 >= this.state.questions.length;
      if (!res.correct) fb.push(p("retryLater"));
      fb.push(p(last ? "lastDone" : "nextHint"));
      this.say(...fb);
      this.resume.set(this.studentId, { lessonId: this.lessonId, index: this.state.index + 1 });
      if (this.sessionId)
        void this.backend.updateSession(this.sessionId, this.patch("active", 1)).catch(() => {});
    } catch {
      if (my !== this.run) return;
      this.set({ phase: "answering" });
      this.say(p("saveFailed"));
    }
  }

  /** After feedback: the next question, or finish the lesson. */
  async advance() {
    if (this.state.phase !== "feedback") return;
    if (this.state.index + 1 < this.state.questions.length) {
      this.set({ index: this.state.index + 1 });
      return this.askQuestion();
    }
    const my = this.run;
    this.set({ phase: "submitting" });
    try {
      const res = await this.backend.complete(this.lessonId);
      if (my !== this.run) return;
      this.resume.clear(this.studentId);
      this.set({ phase: "completed" });
      if (this.sessionId)
        void this.backend.updateSession(this.sessionId, this.patch("completed")).catch(() => {});
      this.sessionId = null;
      this.say(
        p("lessonDone", {
          correct: this.state.score.correct,
          total: this.state.questions.length,
          xp: res.xp,
        }),
        p("afterLesson"),
      );
    } catch {
      if (my !== this.run) return;
      this.set({ phase: "feedback" });
      this.say(p("saveFailed"));
    }
  }

  help() {
    if (this.state.phase === "answering" || this.state.phase === "feedback")
      return this.say(p("keyHelp"));
    if (this.state.phase === "menu") return this.sayMenu();
    if (this.state.phase === "choose_course")
      return this.sayList(
        "pickCourse",
        this.state.courses.map((c) => c.title),
      );
    if (this.state.phase === "choose_lesson")
      return this.sayList(
        "pickLesson",
        this.state.lessons.map((l) => l.title),
      );
    if (this.state.phase === "enter_id") return this.say(p("askId"));
    if (this.state.phase === "enter_pin") return this.say(p("askPin"));
    if (this.state.phase === "completed") return this.say(p("afterLesson"));
  }

  /** Records that a key was heard (shown in the transcript). */
  echo(key: string) {
    if (this.live) this.heard(key);
  }

  private patch(status: SessionPatch["status"], extra = 0): SessionPatch {
    const { correct, incorrect } = this.state.score;
    return {
      status,
      answered: correct + incorrect,
      correct,
      incorrect,
      question_index: Math.min(this.state.index + extra, this.state.questions.length),
      question_count: this.state.questions.length,
      lessons_completed: status === "completed" ? 1 : 0,
      seconds: this.seconds,
    };
  }
}
