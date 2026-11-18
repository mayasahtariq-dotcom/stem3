import { describe, expect, it, vi } from "vitest";
import { CallEngine, SimAuthError, type CallBackend, type ResumeStore, type SimQuestion } from "./engine";
import { pressKey, keyFromKeyboard } from "./keypad";

const tri = (s: string) => ({ en: s, hi: s, kn: s });
const q = (id: string): SimQuestion => ({
  id,
  prompt: tri(`Q ${id}`),
  options: [tri("a"), tri("b"), tri("c"), tri("d")],
  maxSelections: 1,
  toAnswer: ([i]) => ({ index: i }),
  correctIndex: (a) => a.index as number,
});
const RIGHT: Record<string, number> = { q1: 1, q2: 0 };

function fakeBackend(): CallBackend & { submits: unknown[]; patches: unknown[] } {
  const submits: unknown[] = [];
  const patches: unknown[] = [];
  return {
    submits,
    patches,
    checkId: async (id) => {
      if (id === "9999999999") throw new SimAuthError("unknown_id");
    },
    signIn: async (_id, pin) => {
      if (pin !== "123456") throw new SimAuthError("bad_pin");
      return { name: "Asha" };
    },
    courses: async () => ({ courses: [{ id: "c1", title: tri("Biology") }], continueLesson: null }),
    lessons: async () => [{ id: "l1", title: tri("Plants"), done: false }],
    openLesson: async () => ({ title: tri("Plants"), questions: [q("q1"), q("q2")] }),
    submit: async (id, answer) => {
      submits.push({ id, answer });
      const correct = (answer as { index: number }).index === RIGHT[id];
      return { correct, correctAnswer: { index: RIGHT[id] }, explanation: null, xp: correct ? 10 : 0 };
    },
    complete: async () => ({ xp: 25, accuracy: 0.5 }),
    startSession: async () => "s1",
    updateSession: async (_id, p) => void patches.push(p),
  };
}
const memResume = (): ResumeStore => {
  const m = new Map<string, { lessonId: string; index: number }>();
  return { get: (id) => m.get(id) ?? null, set: (id, p) => void m.set(id, p), clear: (id) => void m.delete(id) };
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const keys = async (e: CallEngine, s: string) => {
  for (const k of s) {
    pressKey(e, k as never);
    await flush();
  }
};

describe("phone lesson engine", () => {
  it("runs a whole call: ID, PIN, course, lesson, answers, completion", async () => {
    const b = fakeBackend();
    const e = new CallEngine(b, memResume());
    e.dial();
    await flush();
    expect(e.state.phase).toBe("enter_id");
    await keys(e, "9876543210#");
    expect(e.state.phase).toBe("enter_pin");
    await keys(e, "111111#");
    expect(e.state.phase).toBe("enter_pin"); // wrong PIN: asked again
    await keys(e, "123456#");
    expect(e.state.phase).toBe("menu");
    await keys(e, "2"); // choose a course
    await keys(e, "1"); // Biology
    expect(e.state.phase).toBe("choose_lesson");
    await keys(e, "1"); // Plants
    expect(e.state.phase).toBe("answering");

    await keys(e, "9"); // nothing chosen: not submitted
    expect(b.submits).toHaveLength(0);
    await keys(e, "3");
    await keys(e, "8"); // clear
    expect(e.state.selection).toEqual([]);
    await keys(e, "2");
    expect(e.state.selection).toEqual([1]);
    await keys(e, "7"); // read back, no change
    await keys(e, "9");
    expect(e.state.phase).toBe("feedback");
    expect(e.state.lastResult).toEqual({ correct: true, correctIndex: 1 });
    await keys(e, "9"); // go on
    expect(e.state.index).toBe(1);
    await keys(e, "4");
    await keys(e, "9");
    expect(e.state.lastResult?.correct).toBe(false);
    expect(e.state.questions).toHaveLength(3); // the missed question comes back
    await keys(e, "9");
    expect(e.state.questions[e.state.index]).toMatchObject({ id: "q2", retry: true });
    await keys(e, "19");
    await keys(e, "9");
    expect(e.state.phase).toBe("completed");
    expect(e.state.score).toEqual({ correct: 2, incorrect: 1, xp: 20 });
    expect(b.patches.at(-1)).toMatchObject({ status: "completed", answered: 3, correct: 2, incorrect: 1, lessons_completed: 1 });
  });

  it("ignores a second confirm while the answer is being checked", async () => {
    const b = fakeBackend();
    const slow = vi.fn(() => new Promise<never>(() => {}));
    const e = new CallEngine({ ...b, submit: slow }, memResume());
    await e.quickSignIn("9876543210", "123456");
    await keys(e, "211");
    pressKey(e, "1");
    pressKey(e, "9");
    pressKey(e, "9");
    await flush();
    expect(slow).toHaveBeenCalledTimes(1);
    expect(e.state.phase).toBe("submitting");
  });

  it("resumes at the saved question on the next call", async () => {
    const resume = memResume();
    const b = fakeBackend();
    const e = new CallEngine(b, resume);
    await e.quickSignIn("9876543210", "123456");
    await keys(e, "211");
    await keys(e, "29");
    e.hangUp();
    expect(b.patches.at(-1)).toMatchObject({ status: "ended" });
    expect(resume.get("9876543210")).toEqual({ lessonId: "l1", index: 1 });
    await e.quickSignIn("9876543210", "123456");
    await keys(e, "211");
    expect(e.state.index).toBe(1);
  });

  it("rejects an unknown ID and maps keyboard keys", async () => {
    const e = new CallEngine(fakeBackend(), memResume());
    e.dial();
    await flush();
    await keys(e, "9999999999#");
    expect(e.state.phase).toBe("enter_id");
    expect(keyFromKeyboard({ key: "Enter" })).toBe("#");
    expect(keyFromKeyboard({ key: "Backspace" })).toBe("*");
    expect(keyFromKeyboard({ key: "x" })).toBeNull();
  });
});
