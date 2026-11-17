import { http, HttpResponse } from "msw";
import type { Schemas } from "@mooshala/api-client";
import { FAKE_API_BASE_URL } from "@/lib/env";
import { DEMO, fakeDb, userForToken, type FakeClassroom } from "./fake-db";
import { makeLearningHandlers } from "./learning/handlers";
import { makeGameHandlers } from "./game/handlers";
import { makeTeacherHandlers } from "./teacher/handlers";
import { makeNotesHandlers } from "./notes/handlers";
import { rosterOf } from "./teacher/state";
import { makeParentHandlers } from "./parent/handlers";
import { makeCallHandlers } from "./calls/handlers";

const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });

function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  return token ? userForToken(token) : null;
}

const me = (u: ReturnType<typeof userForToken>): Schemas["MeResponse"] => ({
  id: u.id,
  registered: u.registered,
  name: u.name,
  phone: u.phone,
  roles: u.roles,
  language_mode: u.language_mode,
});

const preview = (c: FakeClassroom): Schemas["ClassroomPreview"] => ({
  id: c.id,
  name: c.name,
  teacher_name: c.teacher_name,
  subject: c.subject,
  grade: c.grade,
  student_count: c.student_count,
  allowed_language_modes: c.allowed_language_modes,
});

/** Runs the backend's join checks (backend/app/routers/classrooms.py) against the fake db. */
function checkJoin(userId: string, language: string | null | undefined, key: string) {
  const db = fakeDb();
  const n = (db.joinAttempts.get(userId) ?? 0) + 1;
  db.joinAttempts.set(userId, n);
  if (key === DEMO.rateLimitedKey || n > 10) return { error: err(429, "TOO_MANY_ATTEMPTS") };
  const c = db.classrooms.find((x) => x.join_key === key);
  if (!c) return { error: err(404, "KEY_NOT_FOUND") };
  if (c.expired) return { error: err(410, "KEY_EXPIRED") };
  if (db.memberships.get(userId)?.has(c.id)) return { error: err(409, "ALREADY_MEMBER") };
  if (language && !c.allowed_language_modes.includes(language as "hindi")) return { error: err(403, "LANGUAGE_NOT_ALLOWED") };
  return { classroom: c };
}

export function makeHandlers(base = FAKE_API_BASE_URL) {
  return [
    ...makeLearningHandlers(base),
    ...makeTeacherHandlers(base),
    ...makeNotesHandlers(base),
    ...makeParentHandlers(base),
    ...makeCallHandlers(base),
    // MOCK ONLY: endpoints the backend hasn't built yet.
    ...makeGameHandlers(base),
    http.get(`${base}/me`, ({ request }) => {
      const u = auth(request);
      return u ? HttpResponse.json(me(u)) : err(401, "UNAUTHORIZED");
    }),

    http.put(`${base}/me`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const body = (await request.json()) as Schemas["ProfileUpdate"];
      if (!body.name?.trim() || !body.roles?.length) return err(422, "VALIDATION");
      Object.assign(u, { name: body.name.trim(), roles: body.roles, language_mode: body.language_mode, registered: true });
      return HttpResponse.json(me(u));
    }),

    http.get(`${base}/me/classrooms`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const db = fakeDb();
      const ids = db.memberships.get(u.id) ?? new Set();
      const out: Schemas["StudentClassroomOut"][] = db.classrooms
        .filter((c) => ids.has(c.id))
        .map((c) => ({ ...preview(c), joined_at: "2026-11-10T09:00:00Z" }));
      return HttpResponse.json(out);
    }),

    http.get(`${base}/classrooms`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.roles.includes("teacher")) return err(403, "NOT_A_TEACHER");
      const out: Schemas["ClassroomOut"][] = fakeDb()
        .classrooms.filter((c) => c.teacher_name === u.name)
        .map((c) => ({
          id: c.id,
          name: c.name,
          subject: c.subject,
          grade: c.grade,
          join_key: c.join_key,
          expires_at: c.expired ? "2026-11-01T00:00:00Z" : null,
          allowed_language_modes: c.allowed_language_modes,
          student_count: rosterOf(c.id).length,
          created_at: "2026-11-01T09:00:00Z",
        }));
      return HttpResponse.json(out);
    }),

    http.get(`${base}/classrooms/preview/:key`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.roles.includes("student")) return err(403, "NOT_A_STUDENT");
      const r = checkJoin(u.id, u.language_mode, String(params.key));
      return r.error ?? HttpResponse.json(preview(r.classroom!));
    }),

    http.post(`${base}/classrooms/join`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.roles.includes("student")) return err(403, "NOT_A_STUDENT");
      const { key } = (await request.json()) as Schemas["JoinRequest"];
      const r = checkJoin(u.id, u.language_mode, key);
      if (r.error) return r.error;
      const db = fakeDb();
      const set = db.memberships.get(u.id) ?? new Set<string>();
      set.add(r.classroom!.id);
      db.memberships.set(u.id, set);
      const out: Schemas["StudentClassroomOut"] = { ...preview(r.classroom!), joined_at: new Date().toISOString() };
      return HttpResponse.json(out, { status: 201 });
    }),

    // Documented in the web PRD but not implemented by the backend yet; payload is our assumption.
    http.post(`${base}/auth/class-key`, async ({ request }) => {
      const { class_key, name } = (await request.json()) as { class_key: string; name: string };
      if (class_key === DEMO.rateLimitedKey) return err(429, "TOO_MANY_ATTEMPTS");
      const c = fakeDb().classrooms.find((x) => x.join_key === class_key);
      if (!c) return err(404, "KEY_NOT_FOUND");
      if (c.expired) return err(410, "KEY_EXPIRED");
      const token = `fake-classkey-${c.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const db = fakeDb();
      if (!db.users.has(token)) {
        db.users.set(token, { id: `u-${token.slice(14)}`, phone: null, name, roles: ["student"], language_mode: c.allowed_language_modes[0] ?? "hindi", registered: true });
        db.memberships.set(`u-${token.slice(14)}`, new Set([c.id]));
      }
      return HttpResponse.json({ access_token: token, token_type: "bearer", expires_in: 8 * 3600 });
    }),
  ];
}

export const handlers = makeHandlers();
