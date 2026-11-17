import { accuracySoFar, currentQuestionId, isRetry, progress, sessionReducer, startSession, type AttemptResult, type SessionEvent, type SessionState } from "./session";

const ok: AttemptResult = { correct: true, correctAnswer: {}, explanation: {}, xpDelta: 10, heartLost: false };
const miss: AttemptResult = { correct: false, correctAnswer: {}, explanation: {}, xpDelta: 0, heartLost: true };
const run = (s: SessionState, ...events: SessionEvent[]) => events.reduce(sessionReducer, s);
const answer = (r: AttemptResult): SessionEvent[] => [{ type: "submit", answer: {} }, { type: "graded", result: r }, { type: "next" }];

describe("lesson session", () => {
  it("plays questions in order and finishes", () => {
    let s = startSession("l1", ["a", "b"]);
    expect(currentQuestionId(s)).toBe("a");
    s = run(s, ...answer(ok));
    expect(currentQuestionId(s)).toBe("b");
    s = run(s, ...answer(ok));
    expect(s.phase).toBe("completing");
    s = run(s, { type: "completed", result: { xpEarned: 40, accuracy: 1, streak: 2, streakExtended: true } });
    expect(s.phase).toBe("done");
    expect(s.xpFromAnswers).toBe(20);
  });

  it("brings a 'not quite' question back once at the end, as a retry", () => {
    let s = startSession("l1", ["a", "b"]);
    s = run(s, ...answer(miss));
    expect(s.queue).toEqual(["a", "b", "a"]);
    s = run(s, ...answer(ok));
    expect(currentQuestionId(s)).toBe("a");
    expect(isRetry(s)).toBe(true);
    // Wrong again on the retry: the lesson still moves on (no endless loop).
    s = run(s, ...answer(miss));
    expect(s.queue).toEqual(["a", "b", "a"]);
    expect(s.phase).toBe("completing");
    // Accuracy counts first tries only.
    expect(accuracySoFar(s)).toBe(0.5);
  });

  it("counts the combo and resets it on a miss", () => {
    let s = startSession("l1", ["a", "b", "c", "d"]);
    s = run(s, ...answer(ok), ...answer(ok), ...answer(ok));
    expect(s.combo).toBe(3);
    s = run(s, ...answer(miss));
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(3);
  });

  it("keeps the answer when sending fails, so it can be sent again", () => {
    let s = run(startSession("l1", ["a"]), { type: "submit", answer: { index: 2 } }, { type: "submitFailed" });
    expect(s.phase).toBe("submitError");
    expect(s.pendingAnswer).toEqual({ index: 2 });
    s = run(s, { type: "submit", answer: { index: 2 } });
    expect(s.phase).toBe("submitting");
  });

  it("pauses when hearts run out and ignores double submits", () => {
    let s = run(startSession("l1", ["a"]), { type: "submit", answer: {} });
    expect(run(s, { type: "submit", answer: { other: 1 } })).toBe(s);
    s = run(s, { type: "heartsEmpty", refillAt: "2026-11-17T18:00:00Z" });
    expect(s).toMatchObject({ phase: "heartsEmpty", refillAt: "2026-11-17T18:00:00Z" });
  });

  it("retries a failed completion", () => {
    let s = run(startSession("l1", ["a"]), ...answer(ok), { type: "completeFailed" });
    expect(s.phase).toBe("completeError");
    s = run(s, { type: "completeStarted" });
    expect(s.phase).toBe("completing");
  });

  it("reports progress", () => {
    const s = run(startSession("l1", ["a", "b", "c", "d"]), ...answer(ok));
    expect(progress(s)).toBe(0.25);
  });
});
