/**
 * The lesson session: a pure state machine (no React, no network), so every
 * rule is unit-tested. The server grades answers and owns XP and hearts; this
 * only decides what the player sees next.
 *
 * - Questions play in order. A question answered "not quite" comes back once
 *   at the end of the lesson as a retry (Android PRD M3: wrong answers return).
 * - A retry answered wrong again moves on, so a lesson always ends.
 * - Offline, an answer is saved to the outbox instead ("queued"): the
 *   player moves on without a grade, and the server grades it on sync.
 * - The combo flame counts correct answers in a row (display only; the
 *   backend has no combo XP yet, see docs/decisions.md).
 */
export type Phase = "answering" | "submitting" | "feedback" | "submitError" | "heartsEmpty" | "completing" | "completeError" | "done";

export interface AttemptResult {
  correct: boolean;
  correctAnswer: Record<string, unknown>;
  explanation: Record<string, string>;
  xpDelta: number;
  heartLost: boolean;
  /** Saved offline: the server grades it when the phone is back online. */
  queued?: boolean;
}

export interface CompleteResult {
  xpEarned: number;
  accuracy: number;
  streak: number;
  streakExtended: boolean;
}

export interface SessionState {
  lessonId: string;
  /** Question ids still to play, in order; retries are appended. */
  queue: string[];
  /** How many questions the lesson has; later queue entries are retries. */
  originalCount: number;
  index: number;
  retries: string[];
  firstTry: Record<string, boolean>;
  phase: Phase;
  last: AttemptResult | null;
  pendingAnswer: Record<string, unknown> | null;
  combo: number;
  bestCombo: number;
  xpFromAnswers: number;
  refillAt: string | null;
  complete: CompleteResult | null;
  /** Answers saved offline in this session (graded later by the server). */
  queuedCount?: number;
  /** The lesson was finished offline; its rewards arrive after sync. */
  completedOffline?: boolean;
}

export type SessionEvent =
  | { type: "submit"; answer: Record<string, unknown> }
  | { type: "graded"; result: AttemptResult }
  | { type: "queued" }
  | { type: "submitFailed" }
  | { type: "heartsEmpty"; refillAt: string | null }
  | { type: "next" }
  | { type: "completeStarted" }
  | { type: "completed"; result: CompleteResult }
  | { type: "completeFailed" }
  | { type: "completeQueued" };

export function startSession(lessonId: string, questionIds: string[]): SessionState {
  return { lessonId, queue: [...questionIds], originalCount: questionIds.length, index: 0, retries: [], firstTry: {}, phase: "answering", last: null, pendingAnswer: null, combo: 0, bestCombo: 0, xpFromAnswers: 0, refillAt: null, complete: null };
}

export const currentQuestionId = (s: SessionState) => s.queue[s.index] ?? null;
export const isRetry = (s: SessionState) => s.index >= s.originalCount;
/** Progress for the bar: answered questions over all questions to play. */
export const progress = (s: SessionState) => (s.queue.length ? Math.min(1, (s.index + (s.phase === "feedback" ? 1 : 0)) / s.queue.length) : 0);
export const accuracySoFar = (s: SessionState) => {
  const v = Object.values(s.firstTry);
  return v.length ? v.filter(Boolean).length / v.length : 0;
};

export function sessionReducer(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case "submit":
      if (s.phase !== "answering" && s.phase !== "submitError" && s.phase !== "heartsEmpty") return s;
      return { ...s, phase: "submitting", pendingAnswer: e.answer };
    case "submitFailed":
      return s.phase === "submitting" ? { ...s, phase: "submitError" } : s;
    case "heartsEmpty":
      return { ...s, phase: "heartsEmpty", refillAt: e.refillAt };
    case "graded": {
      if (s.phase !== "submitting") return s;
      const id = currentQuestionId(s)!;
      const retry = isRetry(s);
      const firstTry = retry ? s.firstTry : { ...s.firstTry, [id]: e.result.correct };
      const queueRetry = !e.result.correct && !retry;
      const combo = e.result.correct ? s.combo + 1 : 0;
      return {
        ...s,
        phase: "feedback",
        last: e.result,
        pendingAnswer: null,
        firstTry,
        queue: queueRetry ? [...s.queue, id] : s.queue,
        retries: queueRetry ? [...s.retries, id] : s.retries,
        combo,
        bestCombo: Math.max(s.bestCombo, combo),
        xpFromAnswers: s.xpFromAnswers + e.result.xpDelta,
      };
    }
    case "queued": {
      // Offline: no grade yet, so no retry, combo change or first-try record.
      if (s.phase !== "submitting") return s;
      const last: AttemptResult = { correct: false, correctAnswer: {}, explanation: {}, xpDelta: 0, heartLost: false, queued: true };
      return { ...s, phase: "feedback", last, pendingAnswer: null, queuedCount: (s.queuedCount ?? 0) + 1 };
    }
    case "next": {
      if (s.phase !== "feedback") return s;
      const index = s.index + 1;
      return index >= s.queue.length ? { ...s, index, phase: "completing", last: null } : { ...s, index, phase: "answering", last: null };
    }
    case "completeStarted":
      return s.phase === "completeError" ? { ...s, phase: "completing" } : s;
    case "completed":
      return { ...s, phase: "done", complete: e.result };
    case "completeFailed":
      return { ...s, phase: "completeError" };
    case "completeQueued":
      return s.phase === "completing" || s.phase === "completeError" ? { ...s, phase: "done", complete: null, completedOffline: true } : s;
  }
}
