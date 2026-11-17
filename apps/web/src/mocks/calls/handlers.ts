import { http, HttpResponse } from "msw";
import type { CallStudentCreate, CallStudentPatch } from "@mooshala/api-client";
import { callBlock, daysProblem, isLive, normalizePhone, windowProblem } from "@/features/calls/rules";
import { fakeDb, userForToken } from "../fake-db";
import { fakeNow } from "../learning/state";
import { ownsClassroom } from "../teacher/state";
import { callState, callsState, newStudent, sessionOut, setDemoClock, settle, startCall, studentOut, twinOut } from "./state";

/**
 * MOCK ONLY: call-student endpoints named in the web spec but not built by the
 * backend (contract in packages/api-client/src/pending-calls.ts). Error codes
 * and status codes follow backend/app/errors.py conventions.
 */
const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });
const json = <T,>(body: T, init?: ResponseInit) => HttpResponse.json(body as never, init);
const STATUS = { CALL_IN_PROGRESS: 409, CALLS_PAUSED: 409, CONSENT_PENDING: 409, WEEKLY_CAP_REACHED: 409, OUTSIDE_CALL_HOURS: 409 } as const;

function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
}

export function makeCallHandlers(base: string) {
  const teacher = (request: Request) => {
    const u = auth(request);
    if (!u) return { error: err(401, "UNAUTHORIZED") };
    if (!u.roles.includes("teacher")) return { error: err(403, "NOT_A_TEACHER") };
    return { user: u };
  };
  const owned = (teacherName: string | null, id: string) => {
    const s = callsState().students.find((x) => x.id === id);
    return s && ownsClassroom(teacherName, s.classroomId) ? s : null;
  };

  return [
    http.get(`${base}/classrooms/:id/call-students`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const id = String(params.id);
      if (!ownsClassroom(t.user.name, id)) return err(404, "NOT_FOUND");
      return json(callsState().students.filter((s) => s.classroomId === id).map(studentOut));
    }),

    http.post(`${base}/classrooms/:id/call-students`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const id = String(params.id);
      if (!ownsClassroom(t.user.name, id)) return err(404, "NOT_FOUND");
      const body = (await request.json()) as CallStudentCreate;
      const phone = normalizePhone(body.parent_phone ?? "");
      if ((body.name ?? "").trim().length < 2 || !phone || windowProblem(body.window) || daysProblem(body.days ?? []) || !["hindi", "kannada"].includes(body.language)) return err(422, "VALIDATION");
      const db = fakeDb();
      const appStudentInClass = [...db.users.values()].some((u) => u.phone === phone && db.memberships.get(u.id)?.has(id));
      if (appStudentInClass || callsState().students.some((s) => s.classroomId === id && s.phone === phone)) return err(409, "DUPLICATE_PHONE");
      const s = newStudent(id, { name: body.name.trim(), phone, language: body.language, window: body.window, days: body.days });
      return json(studentOut(s), { status: 201 });
    }),

    http.patch(`${base}/call-students/:id`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const s = owned(t.user.name, String(params.id));
      if (!s) return err(404, "NOT_FOUND");
      const body = (await request.json()) as CallStudentPatch;
      if (body.window && windowProblem(body.window)) return err(422, "VALIDATION");
      if (body.days && daysProblem(body.days)) return err(422, "VALIDATION");
      if (body.paused !== undefined) s.paused = body.paused;
      if (body.window) s.window = body.window;
      if (body.days) s.days = [...body.days].sort();
      if (body.language) s.language = body.language;
      return json(studentOut(s));
    }),

    http.post(`${base}/call-students/:id/call-now`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const s = owned(t.user.name, String(params.id));
      if (!s) return err(404, "NOT_FOUND");
      settle(s);
      const last = s.calls.at(-1);
      const live = last ? isLive(callState(last, fakeNow()).state) : false;
      const block = callBlock(studentOut(s), fakeNow(), live);
      if (block) return err(STATUS[block], block);
      const c = startCall(s);
      return json(sessionOut(s, c), { status: 202 });
    }),

    http.get(`${base}/call-students/:id/call`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const s = owned(t.user.name, String(params.id));
      if (!s) return err(404, "NOT_FOUND");
      settle(s);
      const last = s.calls.at(-1);
      return last ? json(sessionOut(s, last)) : err(404, "NOT_FOUND");
    }),

    http.get(`${base}/call-students/:id/twin`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const s = owned(t.user.name, String(params.id));
      return s ? json(twinOut(s)) : err(404, "NOT_FOUND");
    }),

    // Demo only (never a real endpoint): move the fake clock so calls can be tried at any hour.
    http.put(`${base}/__demo/clock`, async ({ request }) => {
      const { preset } = (await request.json()) as { preset: "evening" | "real" };
      setDemoClock(preset === "evening" ? "evening" : "real");
      return json({ now: new Date(fakeNow()).toISOString() });
    }),
  ];
}
