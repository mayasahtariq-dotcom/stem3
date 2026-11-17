import { grade, learner, loseHeart, RULES, setFakeClock, statsOut, finishLessonStreak } from "./state";

/** The fake backend must follow backend/app/learning/rules.py, or the demo lies. */
describe("fake backend rules (parity with the server)", () => {
  it("grades every question type like rules.grade", () => {
    expect(grade("multiple_choice", { correct_index: 2 }, { index: 2 })).toMatchObject({ correct: true, costsHeart: true });
    expect(grade("true_false", { answer: false }, { value: true })).toMatchObject({ correct: false, correct_answer: { value: false } });
    expect(grade("fill_formula", { answer: "F" }, { chip: "F" }).correct).toBe(true);
    const pairs = { pairs: [{}, {}, {}] };
    expect(grade("match_pairs", pairs, { pairs: [[1, 1], [0, 0], [2, 2]], mistakes: 0 })).toMatchObject({ correct: true, costsHeart: false });
    expect(grade("match_pairs", pairs, { pairs: [[0, 0], [1, 1], [2, 2]], mistakes: 1 }).correct).toBe(false);
    expect(() => grade("multiple_choice", { correct_index: 1 }, { chip: "x" })).toThrow();
  });

  it("refills one heart every four hours and starts the clock when losing from full", () => {
    let now = Date.parse("2026-11-17T06:00:00Z");
    setFakeClock(() => now);
    const s = learner("u-new");
    expect(s.hearts).toBe(RULES.maxHearts);
    loseHeart(s);
    loseHeart(s);
    expect(statsOut(s).refill_at).toBe(new Date(now + RULES.heartRefillMs).toISOString());
    now += RULES.heartRefillMs + 1000;
    expect(learner("u-new").hearts).toBe(4);
    now += RULES.heartRefillMs;
    expect(learner("u-new").hearts).toBe(5);
    expect(statsOut(learner("u-new")).refill_at).toBeNull();
  });

  it("extends the streak once per India-time day and resets after a missed day", () => {
    let now = Date.parse("2026-11-17T10:00:00Z");
    setFakeClock(() => now);
    const s = learner("u-streak");
    expect(finishLessonStreak(s)).toBe(true);
    expect(finishLessonStreak(s)).toBe(false);
    now += 86400_000;
    finishLessonStreak(s);
    expect(s.streak).toBe(2);
    now += 3 * 86400_000;
    expect(statsOut(s).streak).toBe(0);
    finishLessonStreak(s);
    expect(s.streak).toBe(1);
  });
});
