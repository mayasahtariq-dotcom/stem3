import { http, HttpResponse } from "msw";
import type { Schemas } from "@mooshala/api-client";
import { fakeDb, userForToken } from "../fake-db";
import { COURSE_ID, COURSE_TITLE, UNITS, termContent, TERMS } from "./course-data";
import { idempotent } from "../idempotency";
import { mayStartLessons } from "../parent/state";
import { fakeNow, coursesFor, fakeLessons, finishLessonStreak, grade, learner, lessonById, loseHeart, questionById, RULES, statsOut } from "./state";

/**
 * Fakes for the learning endpoints that exist in the backend
 * (backend/app/routers/learning.py and courses.py GET /lessons/{id}).
 * Response bodies are typed with the generated OpenAPI schemas.
 */
const err = (status: number, code: string, extra: Record<string, unknown> = {}) => HttpResponse.json({ detail: { code, ...extra } }, { status });

function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
}

const json = <T,>(body: T, init?: ResponseInit) => HttpResponse.json(body as never, init);

export function buildPath(userId: string): Schemas["PathOut"] {
  const s = learner(userId);
  const ordered = fakeLessons();
  const done = new Set(ordered.filter((l) => s.progress.get(l.id)?.completedAt).map((l) => l.id));
  const current = ordered.find((l) => !done.has(l.id)) ?? null;
  let previous: (typeof ordered)[number] | null = null;
  const units: Schemas["PathUnit"][] = UNITS.map((u) => ({ id: u.id, title: u.title, lessons: [] }));
  for (const l of ordered) {
    const state = done.has(l.id) ? "done" : current?.id === l.id ? "current" : "locked";
    units[l.unit]!.lessons.push({
      id: l.id,
      position: l.position,
      title: l.title,
      state,
      generation_status: l.generation_status,
      question_count: l.questions.length,
      unlocked_by: state === "locked" && previous ? previous.title : null,
    });
    previous = l;
  }
  return { course_id: COURSE_ID, title: COURSE_TITLE, subject: "BI", is_personal: false, units, done_count: done.size, lesson_count: ordered.length, current_lesson_id: current?.id ?? null };
}

export const lessonOut = (id: string): Schemas["LessonOut"] => {
  const l = lessonById(id)!;
  return {
    id: l.id,
    course_id: l.courseId,
    title: l.title,
    generation_status: l.generation_status,
    published: l.published,
    questions: l.questions.map((q) => ({ id: q.id, position: q.position, type: q.type, content: q.content, source_page: q.source_page, confidence: q.confidence ?? 0.92, flag_reason: q.flag_reason ?? null, call_safe: q.call_safe, teacher_edited: q.teacher_edited ?? false })),
    terms: Object.fromEntries(Object.keys(TERMS).map((k) => [k, termContent(k)])),
  };
};

function readable(userId: string, courseId: string) {
  return coursesFor(userId).includes(courseId);
}

export function makeLearningHandlers(base: string) {
  return [
    http.get(`${base}/me/stats`, ({ request }) => {
      const u = auth(request);
      return u ? json<Schemas["StatsOut"]>(statsOut(learner(u.id))) : err(401, "UNAUTHORIZED");
    }),

    http.put(`${base}/me/daily-goal`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const { goal } = (await request.json()) as Schemas["DailyGoalIn"];
      if (!(RULES.dailyGoals as readonly number[]).includes(goal)) return err(422, "VALIDATION");
      const s = learner(u.id);
      s.dailyGoal = goal;
      return json<Schemas["StatsOut"]>(statsOut(s));
    }),

    http.get(`${base}/me/home`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.registered) return err(400, "PROFILE_INCOMPLETE");
      const s = learner(u.id);
      const courses = coursesFor(u.id);
      const db = fakeDb();
      const memberOf = db.classrooms.filter((c) => db.memberships.get(u.id)?.has(c.id));
      const path = courses.length ? buildPath(u.id) : null;
      const lessons = path ? path.units.flatMap((x) => x.lessons) : [];
      const currentIdx = lessons.findIndex((l) => l.id === path?.current_lesson_id);
      const out: Schemas["HomeOut"] = {
        name: u.name ?? "",
        language_mode: u.language_mode ?? "hindi",
        stats: statsOut(s),
        continue_lesson:
          path && currentIdx >= 0
            ? { course_id: COURSE_ID, course_title: COURSE_TITLE, subject: "BI", lesson_id: lessons[currentIdx]!.id, lesson_title: lessons[currentIdx]!.title, lesson_number: currentIdx + 1, lesson_count: lessons.length, generation_status: lessons[currentIdx]!.generation_status, due_at: null }
            : null,
        classes: memberOf.map((c) => ({ id: c.id, name: c.name, subject: c.subject, teacher_name: c.teacher_name, new_lessons: courses.length && c.id === "c-bio9a" ? lessons.filter((l) => l.state !== "done").length : 0 })),
        courses: path ? [{ id: COURSE_ID, title: COURSE_TITLE, subject: "BI", is_personal: false, ai_made: false, percent_complete: Math.round((100 * path.done_count) / path.lesson_count), lesson_count: path.lesson_count }] : [],
      };
      return json(out);
    }),

    http.get(`${base}/courses/:id/path`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!readable(u.id, String(params.id))) return err(404, "NOT_FOUND");
      return json(buildPath(u.id));
    }),

    http.get(`${base}/lessons/:id`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const l = lessonById(String(params.id));
      if (!l) return err(404, "NOT_FOUND");
      if (!u.roles.includes("teacher") && !readable(u.id, l.courseId)) return err(404, "NOT_FOUND");
      if (!u.roles.includes("teacher") && !l.published) return err(403, "LESSON_NOT_PUBLISHED");
      return json(lessonOut(l.id));
    }),

    http.post(`${base}/lessons/:id/start`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const l = lessonById(String(params.id));
      if (!l || !readable(u.id, l.courseId)) return err(404, "NOT_FOUND");
      if (!l.published) return err(403, "LESSON_NOT_PUBLISHED");
      if (l.generation_status !== "ready") return err(409, "LESSON_NOT_READY");
      if (u.roles.includes("student") && !mayStartLessons(u.id)) return err(403, "CONSENT_REQUIRED");
      const s = learner(u.id);
      const prev = s.progress.get(l.id);
      s.progress.set(l.id, { startedAt: fakeNow(), completedAt: prev?.completedAt, bestAccuracy: prev?.bestAccuracy ?? 0 });
      const out: Schemas["StartOut"] = { lesson: lessonOut(l.id), stats: statsOut(s), term_mastery: {} };
      return json(out);
    }),

    http.post(`${base}/attempts`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      return idempotent(request, u.id, async () => {
        const body = (await request.json()) as Schemas["AttemptIn"];
        const found = questionById(body.question_id);
        if (!found) return err(404, "NOT_FOUND");
        const s = learner(u.id);
        let result;
        try {
          result = grade(found.question.type, found.question.content, body.answer as Record<string, unknown>);
        } catch {
          return err(422, "INVALID_ANSWER");
        }
        if (s.hearts <= 0 && result.costsHeart) return err(409, "HEARTS_EMPTY", { refill_at: statsOut(s).refill_at });
        const xp = result.correct ? (body.retry ? RULES.xpRetry : RULES.xpFirstTry) : 0;
        const heartLost = !result.correct && result.costsHeart;
        if (heartLost) loseHeart(s);
        s.xpTotal += xp;
        s.xpToday += xp;
        s.attempts.push({ lessonId: found.lesson.id, questionId: found.question.id, correct: result.correct, firstTry: !body.retry, at: fakeNow(), channel: request.headers.get("X-Channel") === "phone_simulator" ? "phone_simulator" : "app" });
        const out: Schemas["AttemptOut"] = { correct: result.correct, correct_answer: result.correct_answer, explanation: (found.question.content.explanation as Record<string, string>) ?? {}, xp_delta: xp, heart_lost: heartLost, stats: statsOut(s) };
        return json(out);
      });
    }),

    http.post(`${base}/lessons/:id/complete`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      return idempotent(request, u.id, () => {
        const l = lessonById(String(params.id));
        if (!l) return err(404, "NOT_FOUND");
        const s = learner(u.id);
        const p = s.progress.get(l.id);
        if (!p) return err(409, "LESSON_NOT_STARTED");
        const attempts = s.attempts.filter((a) => a.lessonId === l.id && a.at >= p.startedAt);
        const first = attempts.filter((a) => a.firstTry);
        const accuracy = first.length ? first.filter((a) => a.correct).length / first.length : 0;
        const answerXp = attempts.reduce((n, a) => n + (a.correct ? (a.firstTry ? RULES.xpFirstTry : RULES.xpRetry) : 0), 0);
        const extended = finishLessonStreak(s);
        s.xpTotal += RULES.xpLessonBonus;
        s.xpToday += RULES.xpLessonBonus;
        p.completedAt = fakeNow();
        p.bestAccuracy = Math.max(p.bestAccuracy, accuracy);
        const out: Schemas["CompleteOut"] = { xp_earned: answerXp + RULES.xpLessonBonus, accuracy: Math.round(accuracy * 1000) / 1000, streak: s.streak, streak_extended: extended, stats: statsOut(s) };
        return json(out);
      });
    }),

    http.get(`${base}/courses/:id/terms`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!readable(u.id, String(params.id)) && !u.roles.includes("teacher")) return err(404, "NOT_FOUND");
      const s = learner(u.id);
      const out: Schemas["TermOut"][] = Object.keys(TERMS)
        .sort()
        .map((k) => ({ key: k, content: termContent(k), source_page: TERMS[k]!.page, saved: s.savedTerms.has(k), mastery: k === "nucleus" ? 0.8 : k === "cell" ? 0.6 : null }));
      return json(out);
    }),

    http.put(`${base}/me/saved-terms/:course/:key`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!TERMS[String(params.key)]) return err(404, "NOT_FOUND");
      learner(u.id).savedTerms.add(String(params.key));
      return new HttpResponse(null, { status: 204 });
    }),

    http.delete(`${base}/me/saved-terms/:course/:key`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      learner(u.id).savedTerms.delete(String(params.key));
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${base}/doubts`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const body = (await request.json()) as Schemas["DoubtIn"];
      const s = learner(u.id);
      const dayStart = fakeNow() - ((fakeNow() + 5.5 * 3600_000) % 86400_000);
      const asked = s.doubts.filter((t) => t >= dayStart).length;
      if (asked >= RULES.doubtsPerDay) return err(429, "DOUBT_LIMIT");
      if (!readable(u.id, body.course_id)) return err(404, "NOT_FOUND");
      if (/\bfail\b/i.test(body.text)) return err(503, "AI_UNAVAILABLE");
      s.doubts.push(fakeNow());
      const term = body.term_key ? TERMS[body.term_key] : Object.entries(TERMS).find(([k, t]) => body.text.toLowerCase().includes(t.forms.en.toLowerCase()) || body.text.includes(t.forms.hi) || body.text.includes(t.forms.kn) || body.text.toLowerCase().includes(k))?.[1];
      const inNotes = Boolean(term);
      const answer = term
        ? body.mode === "example"
          ? term.analogy
          : { en: `${term.forms.en}: ${term.meaning.en} ${body.mode === "simpler" ? term.analogy.en : ""}`.trim(), hi: `${term.forms.hi}: ${term.meaning.hi} ${body.mode === "simpler" ? term.analogy.hi : ""}`.trim(), kn: `${term.forms.kn}: ${term.meaning.kn} ${body.mode === "simpler" ? term.analogy.kn : ""}`.trim() }
        : { en: "That isn't in your notes yet, but here's a short answer: ask your teacher to add a page about it.", hi: "यह अभी तुम्हारे नोट्स में नहीं है। शिक्षक से इस पर एक पन्ना जोड़ने को कहो।", kn: "ಇದು ಇನ್ನೂ ನಿಮ್ಮ ನೋಟ್ಸ್‌ನಲ್ಲಿ ಇಲ್ಲ. ಇದರ ಬಗ್ಗೆ ಪುಟ ಸೇರಿಸಲು ಶಿಕ್ಷಕರನ್ನು ಕೇಳಿ." };
      const out: Schemas["DoubtOut"] = { id: `doubt-${s.doubts.length}`, answer, in_notes: inNotes, source_pages: term ? [term.page] : [], doubts_left_today: Math.max(0, RULES.doubtsPerDay - asked - 1) };
      return json(out);
    }),

    http.post(`${base}/audio`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const body = (await request.json()) as Schemas["AudioIn"];
      if (!body.text?.trim()) return err(422, "INVALID_ANSWER");
      // The fake has no speech engine; the app falls back to the browser's voice.
      const out: Schemas["AudioOut"] = { url: "" };
      return json(out);
    }),
  ];
}
