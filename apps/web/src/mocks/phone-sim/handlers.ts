import { http, HttpResponse } from "msw";
import { fakeDb, userForToken } from "../fake-db";
import { fakeNow, learner } from "../learning/state";
import { activeLink } from "../parent/state";
import { rosterOf } from "../teacher/state";

/*
 * Fakes for the call simulator's session log and the channel views (backend: app/routers/web_sim.py).
 * Attempts are tagged by channel in the learning fakes (X-Channel header), so one student has one history.
 */
export interface SimSession {
  id: string;
  userId: string;
  lessonId: string;
  status: "active" | "completed" | "ended";
  answered: number;
  correct: number;
  incorrect: number;
  question_index: number;
  question_count: number;
  lessons_completed: number;
  seconds: number;
  startedAt: number;
  lastAt: number;
}
const sessions: SimSession[] = [];
export const resetSimSessions = () => void sessions.splice(0);

const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });
function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
}

/** Interrupted: hung up (or went quiet for 2 minutes) before the lesson finished. */
const statusOf = (s: SimSession) =>
  s.status === "completed"
    ? "completed"
    : s.status === "ended" || fakeNow() - s.lastAt > 120_000
      ? "interrupted"
      : "active";
const nameOf = (id: string) =>
  [...fakeDb().users.values()].find((u) => u.id === id)?.name ?? "Student";

export function simActivity(userIds: string[]) {
  const mine = sessions.filter((s) => userIds.includes(s.userId));
  const attempts = userIds.flatMap((id) => learner(id).attempts);
  const phone = attempts.filter((a) => a.channel === "phone_simulator");
  const lessonsTotal = userIds.reduce(
    (n, id) => n + [...learner(id).progress.values()].filter((p) => p.completedAt).length,
    0,
  );
  const phoneLessons = mine.reduce((n, s) => n + s.lessons_completed, 0);
  return {
    simulator_users: new Set(mine.map((s) => s.userId)).size,
    sessions: mine.length,
    lessons_completed: phoneLessons,
    correct: phone.filter((a) => a.correct).length,
    incorrect: phone.filter((a) => !a.correct).length,
    call_seconds: mine.reduce((n, s) => n + s.seconds, 0),
    interrupted: mine.filter((s) => statusOf(s) === "interrupted").length,
    channels: {
      app: {
        answers: attempts.length - phone.length,
        lessons: Math.max(0, lessonsTotal - phoneLessons),
      },
      phone_simulator: { answers: phone.length, lessons: phoneLessons },
    },
    recent: [...mine]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        student_name: nameOf(s.userId),
        started_at: new Date(s.startedAt).toISOString(),
        seconds: s.seconds,
        status: statusOf(s),
        answered: s.answered,
        correct: s.correct,
        question_count: s.question_count,
      })),
  };
}

export function makePhoneSimHandlers(base: string) {
  return [
    http.post(`${base}/sim/sessions`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const body = (await request.json()) as { lesson_id: string };
      const s: SimSession = {
        id: crypto.randomUUID(),
        userId: u.id,
        lessonId: body.lesson_id,
        status: "active",
        answered: 0,
        correct: 0,
        incorrect: 0,
        question_index: 0,
        question_count: 0,
        lessons_completed: 0,
        seconds: 0,
        startedAt: fakeNow(),
        lastAt: fakeNow(),
      };
      sessions.push(s);
      return HttpResponse.json({ id: s.id }, { status: 201 });
    }),
    http.patch(`${base}/sim/sessions/:id`, async ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const s = sessions.find((x) => x.id === params.id && x.userId === u.id);
      if (!s) return err(404, "NOT_FOUND");
      if (s.status !== "active") return err(409, "CONFLICT");
      Object.assign(s, (await request.json()) as Partial<SimSession>, { lastAt: fakeNow() });
      return HttpResponse.json({ id: s.id, status: statusOf(s) });
    }),
    http.get(`${base}/classrooms/:id/sim-activity`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      return HttpResponse.json(simActivity(rosterOf(String(params.id)).map((r) => r.id)));
    }),
    http.get(`${base}/parent/children/:id/sim-activity`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!activeLink(u.id, String(params.id))) return err(404, "NOT_FOUND");
      return HttpResponse.json(simActivity([String(params.id)]));
    }),
  ];
}
