"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { asApiError, type ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { isOnline } from "@/lib/offline/online";
import { pendingFor, useOutbox } from "@/lib/offline/outbox";
import { useServices } from "@/lib/services";
import type { Profile } from "@/features/auth/types";
import { sounds } from "@/lib/sound/sound-manager";
import { answerPayload, toPlayableLesson, type Answer, type PlayableLesson, type PlayableQuestion } from "./content";
import { currentQuestionId, isRetry, sessionReducer, startSession, type SessionEvent, type SessionState } from "./session";
import { useLessonSessions } from "./session-store";

export type LoadState = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; resumed: boolean };

export interface LessonPlayerModel {
  load: LoadState;
  lesson: PlayableLesson | null;
  session: SessionState | null;
  question: PlayableQuestion | null;
  retry: boolean;
  submit: (a: Answer) => void;
  resubmit: () => void;
  next: () => void;
  retryComplete: () => void;
  reload: () => void;
}

const EMPTY: SessionState = startSession("", []);

/**
 * View-model for the lesson player. Starts the lesson (POST /lessons/{id}/start)
 * or resumes a saved session (GET /lessons/{id}, so the server's attempt window
 * isn't reset), sends each answer to POST /attempts, and finishes with
 * POST /lessons/{id}/complete. The screen stays stateless.
 *
 * Offline (or while older answers still wait in the outbox, so order is kept),
 * answers and the completion go to the outbox instead and the player moves on;
 * the server grades them on sync. A saved session resumes from the cached
 * lesson when the network is down.
 */
export function useLessonPlayer(lessonId: string): LessonPlayerModel {
  const { api } = useServices();
  const qc = useQueryClient();
  const store = useLessonSessions;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [lesson, setLesson] = useState<PlayableLesson | null>(null);
  const [session, dispatch] = useReducer((s: SessionState, e: SessionEvent | { type: "replace"; state: SessionState }) => (e.type === "replace" ? e.state : sessionReducer(s, e)), EMPTY);
  const [attemptKey, setAttemptKey] = useState(0);
  const shownAt = useRef(0);
  const completing = useRef(false);

  // Load or resume.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = store.getState().resumable(lessonId);
        let out: Schemas["LessonOut"];
        if (saved) {
          try {
            out = unwrap(await api.GET("/lessons/{lesson_id}", { params: { path: { lesson_id: lessonId } } }));
          } catch (e) {
            const cached = qc.getQueryData<Schemas["LessonOut"]>(queryKeys.lesson(lessonId));
            if (asApiError(e).code !== "NETWORK" || !cached) throw e;
            out = cached;
          }
        } else {
          const started = unwrap(await api.POST("/lessons/{lesson_id}/start", { params: { path: { lesson_id: lessonId } } }));
          qc.setQueryData(queryKeys.stats, started.stats);
          out = started.lesson;
        }
        if (cancelled) return;
        qc.setQueryData(queryKeys.lesson(lessonId), out);
        const playable = toPlayableLesson(out);
        const ids = new Set(playable.questions.map((q) => q.id));
        // A saved session is only reused if the lesson still has the same questions.
        const reuse = saved && saved.session.queue.every((id) => ids.has(id)) ? saved.session : null;
        setLesson(playable);
        dispatch({ type: "replace", state: reuse ? { ...reuse, phase: reuse.phase === "submitting" ? "submitError" : reuse.phase } : startSession(lessonId, playable.questions.map((q) => q.id)) });
        setLoad({ status: "ready", resumed: Boolean(reuse) });
      } catch (e) {
        if (!cancelled) setLoad({ status: "error", error: asApiError(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, lessonId, qc, store, attemptKey]);

  // Save progress after every step.
  useEffect(() => {
    if (!lesson || session.lessonId !== lessonId) return;
    if (session.phase === "done") store.getState().clear(lessonId);
    else store.getState().save({ courseId: lesson.courseId, title: lesson.title, session, savedAt: Date.now() });
  }, [lesson, lessonId, session, store]);

  const userId = useCallback(() => qc.getQueryData<Profile>(queryKeys.me)?.id ?? null, [qc]);
  /** True when this step must go to the outbox: offline, or older items still wait. */
  const mustQueue = useCallback(() => {
    const id = userId();
    return Boolean(id) && (!isOnline() || pendingFor(useOutbox.getState().items, id).length > 0);
  }, [userId]);

  const send = useCallback(
    async (answer: Record<string, unknown>, retry: boolean, questionId: string) => {
      const body = { question_id: questionId, answer, retry, time_ms: Math.min(3_600_000, Date.now() - shownAt.current) };
      const queue = () => {
        const id = userId();
        if (!id) return false;
        useOutbox.getState().enqueue({ kind: "attempt", userId: id, lessonId, body });
        dispatch({ type: "queued" });
        return true;
      };
      if (mustQueue() && queue()) return;
      try {
        const res = unwrap(await api.POST("/attempts", { body }));
        qc.setQueryData(queryKeys.stats, res.stats);
        sounds.play(res.correct ? "pop" : "tap");
        dispatch({ type: "graded", result: { correct: res.correct, correctAnswer: res.correct_answer, explanation: res.explanation, xpDelta: res.xp_delta, heartLost: res.heart_lost } });
      } catch (e) {
        const err = asApiError(e);
        if (err.code === "HEARTS_EMPTY") dispatch({ type: "heartsEmpty", refillAt: (err.details.refill_at as string | null) ?? null });
        else if (!(err.code === "NETWORK" && queue())) dispatch({ type: "submitFailed" });
      }
    },
    [api, lessonId, mustQueue, qc, userId],
  );

  const submit = useCallback(
    (a: Answer) => {
      const id = currentQuestionId(session);
      if (!id || (session.phase !== "answering" && session.phase !== "heartsEmpty")) return;
      const payload = answerPayload(a);
      dispatch({ type: "submit", answer: payload });
      void send(payload, isRetry(session), id);
    },
    [send, session],
  );

  const resubmit = useCallback(() => {
    const id = currentQuestionId(session);
    if (!id || !session.pendingAnswer || session.phase !== "submitError") return;
    dispatch({ type: "submit", answer: session.pendingAnswer });
    void send(session.pendingAnswer, isRetry(session), id);
  }, [send, session]);

  const finish = useCallback(async () => {
    if (completing.current) return;
    completing.current = true;
    const queue = () => {
      const id = userId();
      if (!id) return false;
      useOutbox.getState().enqueue({ kind: "complete", userId: id, lessonId });
      dispatch({ type: "completeQueued" });
      return true;
    };
    if (mustQueue() && queue()) {
      completing.current = false;
      return;
    }
    try {
      const res = unwrap(await api.POST("/lessons/{lesson_id}/complete", { params: { path: { lesson_id: lessonId } } }));
      qc.setQueryData(queryKeys.stats, res.stats);
      dispatch({ type: "completed", result: { xpEarned: res.xp_earned, accuracy: res.accuracy, streak: res.streak, streakExtended: res.streak_extended } });
      void qc.invalidateQueries({ queryKey: queryKeys.home });
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["game"] });
    } catch (e) {
      if (!(asApiError(e).code === "NETWORK" && queue())) dispatch({ type: "completeFailed" });
    } finally {
      completing.current = false;
    }
  }, [api, lessonId, mustQueue, qc, userId]);

  useEffect(() => {
    if (session.phase === "completing") void finish();
  }, [finish, session.phase]);

  useEffect(() => {
    if (session.phase === "answering") shownAt.current = Date.now();
  }, [session.phase, session.index]);

  const qid = currentQuestionId(session);
  return {
    load,
    lesson,
    session: lesson ? session : null,
    question: lesson?.questions.find((q) => q.id === qid) ?? null,
    retry: isRetry(session),
    submit,
    resubmit,
    next: () => dispatch({ type: "next" }),
    retryComplete: () => dispatch({ type: "completeStarted" }),
    reload: () => {
      setLoad({ status: "loading" });
      setAttemptKey((k) => k + 1);
    },
  };
}
