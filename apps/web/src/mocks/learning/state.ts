import { fakeDb, onFakeDbReset, registerFakeStore } from "../fake-db";
import { buildLessons, COURSE_ID, type FakeLesson } from "./course-data";

/**
 * The fake backend's learning state, ported from backend/app/learning/rules.py
 * so the fakes behave like the server: XP 10/5/+20, five hearts (match pairs
 * cost none), one heart back every four hours, streak on India-time days.
 */
export const RULES = {
  xpFirstTry: 10,
  xpRetry: 5,
  xpLessonBonus: 20,
  maxHearts: 5,
  heartRefillMs: 4 * 60 * 60 * 1000,
  dailyGoals: [30, 50, 100] as const,
  doubtsPerDay: 20,
};

export interface LearnerState {
  xpTotal: number;
  xpToday: number;
  xpTodayDate: string;
  dailyGoal: number;
  hearts: number;
  heartsUpdatedAt: number;
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  progress: Map<string, { startedAt: number; completedAt?: number; bestAccuracy: number }>;
  attempts: { lessonId: string; questionId: string; correct: boolean; firstTry: boolean; at: number; channel?: "app" | "phone_simulator" }[];
  savedTerms: Set<string>;
  doubts: number[];
}

/** Lesson courses assigned to classrooms (CourseAssignment). */
export const ASSIGNMENTS: Record<string, string[]> = { "c-bio9a": [COURSE_ID] };

let lessons: FakeLesson[];
let learners: Map<string, LearnerState>;
let clock = { now: () => Date.now() };
export const fakeNow = () => clock.now();
/** Tests move the fake server clock (e.g. to check heart refills). */
export function setFakeClock(now: () => number) {
  clock = { now };
}

/** India-time calendar day, like rules.india_today. */
export function indiaDay(ms: number): string {
  return new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

function newLearner(now: number): LearnerState {
  return { xpTotal: 0, xpToday: 0, xpTodayDate: indiaDay(now), dailyGoal: 50, hearts: RULES.maxHearts, heartsUpdatedAt: now, streak: 0, longestStreak: 0, lastActiveDate: null, progress: new Map(), attempts: [], savedTerms: new Set(), doubts: [] };
}

onFakeDbReset(() => {
  lessons = buildLessons();
  learners = new Map();
  clock = { now: () => Date.now() };
  const now = clock.now();
  // Asha: three-day streak, lesson 1 done, one heart refilling.
  const asha = newLearner(now);
  Object.assign(asha, { xpTotal: 120, xpToday: 10, hearts: 4, heartsUpdatedAt: now - 3600_000, streak: 3, longestStreak: 5, lastActiveDate: dayBefore(indiaDay(now)) });
  asha.progress.set("lesson-1", { startedAt: now - 86400_000, completedAt: now - 86400_000 + 300_000, bestAccuracy: 0.875 });
  asha.savedTerms.add("nucleus");
  learners.set("u-asha", asha);
});

registerFakeStore("learning", () => ({ lessons, learners }), (v) => {
  lessons = v.lessons;
  learners = v.learners;
});

/** Lessons of one course, in order (defaults to the seeded class course). */
export const fakeLessons = (courseId: string = COURSE_ID) => lessons.filter((l) => l.courseId === courseId);
export const allFakeLessons = () => lessons;
export function addFakeLessons(more: FakeLesson[]) {
  lessons.push(...more);
}
export function removeFakeQuestion(id: string) {
  for (const l of lessons) l.questions = l.questions.filter((q) => q.id !== id);
}
export const lessonById = (id: string) => lessons.find((l) => l.id === id);
export const questionById = (id: string) => {
  for (const l of lessons) {
    const q = l.questions.find((x) => x.id === id);
    if (q) return { lesson: l, question: q };
  }
  return null;
};

/** Courses a student can read: those assigned to their classrooms. */
export function coursesFor(userId: string): string[] {
  const ids = fakeDb().memberships.get(userId) ?? new Set<string>();
  return [...new Set([...ids].flatMap((c) => ASSIGNMENTS[c] ?? []))];
}

/** Loads a learner with hearts refilled and today's XP reset (rules.refill / _load_stats). */
export function learner(userId: string): LearnerState {
  const now = clock.now();
  let s = learners.get(userId);
  if (!s) {
    s = newLearner(now);
    learners.set(userId, s);
  }
  if (s.hearts >= RULES.maxHearts) {
    s.hearts = RULES.maxHearts;
  } else {
    const gained = Math.floor((now - s.heartsUpdatedAt) / RULES.heartRefillMs);
    if (gained > 0) {
      const count = Math.min(RULES.maxHearts, s.hearts + gained);
      s.heartsUpdatedAt = count >= RULES.maxHearts ? now : s.heartsUpdatedAt + gained * RULES.heartRefillMs;
      s.hearts = count;
    }
  }
  const today = indiaDay(now);
  if (s.xpTodayDate !== today) Object.assign(s, { xpToday: 0, xpTodayDate: today });
  return s;
}

export function statsOut(s: LearnerState) {
  const today = indiaDay(clock.now());
  const broken = s.lastActiveDate === null || s.lastActiveDate < dayBefore(today);
  return {
    xp_total: s.xpTotal,
    xp_today: s.xpToday,
    daily_goal: s.dailyGoal,
    hearts: s.hearts,
    max_hearts: RULES.maxHearts,
    refill_at: s.hearts >= RULES.maxHearts ? null : new Date(s.heartsUpdatedAt + RULES.heartRefillMs).toISOString(),
    streak: broken ? 0 : s.streak,
    longest_streak: s.longestStreak,
  };
}

export function loseHeart(s: LearnerState) {
  if (s.hearts <= 0) return;
  if (s.hearts >= RULES.maxHearts) s.heartsUpdatedAt = clock.now();
  s.hearts -= 1;
}

/** rules.finish_lesson_streak */
export function finishLessonStreak(s: LearnerState) {
  const today = indiaDay(clock.now());
  if (s.lastActiveDate === today) return false;
  s.streak = s.lastActiveDate === dayBefore(today) ? s.streak + 1 : 1;
  s.longestStreak = Math.max(s.longestStreak, s.streak);
  s.lastActiveDate = today;
  return true;
}

/** rules.grade: the same answer shapes the server accepts. */
export function grade(type: string, content: Record<string, unknown>, answer: Record<string, unknown>) {
  if (type === "multiple_choice") {
    if (typeof answer.index !== "number") throw new Error("index");
    const right = Number(content.correct_index);
    return { correct: answer.index === right, correct_answer: { index: right }, costsHeart: true };
  }
  if (type === "true_false") {
    if (typeof answer.value !== "boolean") throw new Error("value");
    const right = Boolean(content.answer);
    return { correct: answer.value === right, correct_answer: { value: right }, costsHeart: true };
  }
  if (type === "fill_formula") {
    if (typeof answer.chip !== "string") throw new Error("chip");
    const right = String(content.answer);
    return { correct: answer.chip === right, correct_answer: { chip: right }, costsHeart: true };
  }
  if (type === "match_pairs") {
    if (!Array.isArray(answer.pairs)) throw new Error("pairs");
    const n = (content.pairs as unknown[]).length;
    const expected = Array.from({ length: n }, (_, i) => [i, i]);
    const given = (answer.pairs as number[][]).map(([a, b]) => [Number(a), Number(b)]).sort((x, y) => x[0]! - y[0]! || x[1]! - y[1]!);
    const ok = JSON.stringify(given) === JSON.stringify(expected) && Number(answer.mistakes ?? 0) === 0;
    return { correct: ok, correct_answer: { pairs: expected }, costsHeart: false };
  }
  throw new Error(`unknown type ${type}`);
}

export const allLearners = () => learners;
