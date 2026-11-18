import { http, HttpResponse } from "msw";
import type { Schemas } from "@mooshala/api-client";
import { fakeDb, userForToken } from "../fake-db";
import { fakeNow, lessonById, questionById, removeFakeQuestion } from "../learning/state";
import { classInsights, courseById, courseOut, courseSummary, dashboard, lessonSummaryOut, deleteUpload, materials, newJoinKey, nextId, ownsClassroom, rosterOf, studentDetail, teacherOverview, teacherState, UPLOAD_LIMITS, uploadStatus } from "./state";

/**
 * Fakes for the teacher endpoints that exist in the backend
 * (backend/app/routers/courses.py, classrooms.py, dashboard.py).
 * The page PUT goes to a fake storage URL, like the backend's signed links.
 */
const err = (status: number, code: string, extra: Record<string, unknown> = {}) => HttpResponse.json({ detail: { code, ...extra } }, { status });
const json = <T,>(body: T, init?: ResponseInit) => HttpResponse.json(body as never, init);

function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
}

/** Fake storage host for the signed page links. */
export const FAKE_STORAGE = "https://fake-storage.mooshala.test";

const failedOnce = new Set<string>();
const TYPES = new Set(["multiple_choice", "true_false", "fill_formula", "match_pairs"]);

/** A light port of the backend's Question validation (INVALID_QUESTION). */
function validQuestion(type: string, q: Record<string, unknown>): boolean {
  if (q.type !== undefined && q.type !== type) return TYPES.has(String(q.type)) && validQuestion(String(q.type), { ...q, type: undefined });
  const tri = (v: unknown) => Boolean(v && typeof v === "object" && typeof (v as Record<string, unknown>).en === "string" && String((v as Record<string, string>).en).trim());
  if (!tri(q.prompt) && type !== "true_false" && type !== "fill_formula") return false;
  switch (type) {
    case "multiple_choice": {
      const opts = q.options as unknown[];
      return Array.isArray(opts) && opts.length >= 2 && opts.length <= 4 && typeof q.correct_index === "number" && q.correct_index >= 0 && q.correct_index < opts.length;
    }
    case "true_false":
      return tri(q.statement) && typeof q.answer === "boolean";
    case "fill_formula":
      return typeof q.formula === "string" && q.formula.includes("__") && typeof q.answer === "string" && Array.isArray(q.chips) && (q.chips as string[]).includes(q.answer);
    case "match_pairs":
      return Array.isArray(q.pairs) && q.pairs.length >= 2;
    default:
      return false;
  }
}

export function makeTeacherHandlers(base: string) {
  const teacher = (request: Request) => {
    const u = auth(request);
    if (!u) return { error: err(401, "UNAUTHORIZED") };
    if (!u.roles.includes("teacher")) return { error: err(403, "NOT_A_TEACHER") };
    return { user: u };
  };
  const ownCourse = (userId: string, id: string) => {
    const c = courseById(id);
    return c && c.ownerId === userId ? c : null;
  };

  return [
    // POST /classrooms exists in the backend (ClassroomCreate -> ClassroomOut).
    http.post(`${base}/classrooms`, async ({ request }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const body = (await request.json()) as Schemas["ClassroomCreate"];
      const name = (body.name ?? "").trim();
      if (!name || name.length > 80 || !["BI", "CH", "PH"].includes(body.subject) || !Number.isInteger(body.grade) || body.grade < 6 || body.grade > 12) return err(422, "VALIDATION");
      const modes = body.allowed_language_modes?.length ? body.allowed_language_modes : (["hindi", "kannada"] as ("hindi" | "kannada")[]);
      const id = nextId("class");
      const c = { id, name, subject: body.subject, grade: body.grade, join_key: newJoinKey(body.subject, body.grade), teacher_name: t.user.name ?? "", student_count: 0, allowed_language_modes: modes };
      fakeDb().classrooms.push(c);
      teacherState().roster[id] = [];
      teacherState().schoolConsent[id] = false;
      const out: Schemas["ClassroomOut"] = { id, name, subject: c.subject, grade: c.grade, join_key: c.join_key, expires_at: null, allowed_language_modes: modes, student_count: 0, created_at: new Date(fakeNow()).toISOString() };
      return json(out, { status: 201 });
    }),

    // MOCK ONLY (pending contracts in packages/api-client/src/pending-teacher.ts).
    http.get(`${base}/teacher/overview`, ({ request }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      return json(teacherOverview(t.user.name));
    }),
    http.get(`${base}/classrooms/:id/insights`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      if (!ownsClassroom(t.user.name, String(params.id))) return err(404, "NOT_FOUND");
      return json({ ...classInsights(String(params.id)), student_count: rosterOf(String(params.id)).length });
    }),
    http.get(`${base}/teacher/materials`, ({ request }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      return json(materials(t.user.id));
    }),
    http.delete(`${base}/uploads/:id`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      return deleteUpload(t.user.id, String(params.id)) ? new HttpResponse(null, { status: 204 }) : json({ detail: { code: "NOT_FOUND" } }, { status: 404 });
    }),

    http.get(`${base}/classrooms/:id/dashboard`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      if (!ownsClassroom(t.user.name, String(params.id))) return err(404, "NOT_FOUND");
      return json(dashboard(String(params.id)));
    }),

    http.get(`${base}/classrooms/:id/students/:sid`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      if (!ownsClassroom(t.user.name, String(params.id))) return err(404, "NOT_FOUND");
      const out = studentDetail(String(params.id), String(params.sid));
      return out ? json(out) : err(404, "NOT_FOUND");
    }),

    http.put(`${base}/classrooms/:id/school-consent`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const id = String(params.id);
      if (!ownsClassroom(t.user.name, id)) return err(404, "NOT_FOUND");
      const { enabled } = (await request.json()) as Schemas["SchoolConsentIn"];
      teacherState().schoolConsent[id] = Boolean(enabled);
      return json<Schemas["SchoolConsentOut"]>({ classroom_id: id, school_consent: Boolean(enabled) });
    }),

    http.get(`${base}/classrooms/:id`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const id = String(params.id);
      if (id === "preview" || !ownsClassroom(t.user.name, id)) return err(404, "NOT_FOUND");
      const c = fakeDb().classrooms.find((x) => x.id === id)!;
      const members = teacherState().roster[id] ?? [];
      return json<Schemas["ClassroomDetail"]>({
        id: c.id,
        name: c.name,
        subject: c.subject,
        grade: c.grade,
        join_key: c.join_key,
        expires_at: c.expired ? "2026-11-01T00:00:00Z" : null,
        allowed_language_modes: c.allowed_language_modes,
        student_count: members.length,
        created_at: "2026-11-01T09:00:00Z",
        members: members.map((m) => ({ id: m.id, name: m.name, joined_at: m.joinedAt })),
      });
    }),

    http.get(`${base}/courses`, ({ request }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      return json(teacherState().courses.filter((c) => c.ownerId === t.user.id).map(courseSummary));
    }),

    http.get(`${base}/courses/:id`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const c = ownCourse(t.user.id, String(params.id));
      return c ? json(courseOut(c)) : err(404, "NOT_FOUND");
    }),

    http.put(`${base}/courses/:id`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const c = ownCourse(t.user.id, String(params.id));
      if (!c) return err(404, "NOT_FOUND");
      const { title } = (await request.json()) as Schemas["TitleUpdate"];
      if (!title?.en?.trim()) return err(422, "VALIDATION");
      c.title = { en: title.en.trim(), hi: title.hi?.trim() || title.en.trim(), kn: title.kn?.trim() || title.en.trim() };
      return json(courseOut(c));
    }),

    http.post(`${base}/courses/:id/assign`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const c = ownCourse(t.user.id, String(params.id));
      if (!c) return err(404, "NOT_FOUND");
      const body = (await request.json()) as Schemas["AssignRequest"];
      if (!body.classroom_ids?.length) return err(422, "VALIDATION");
      for (const id of body.classroom_ids) if (!ownsClassroom(t.user.name, id)) return err(404, "NOT_FOUND");
      for (const id of body.classroom_ids) c.assigned[id] = body.due_at ?? null;
      return json<Schemas["AssignmentOut"][]>(
        body.classroom_ids.map((id) => ({ course_id: c.id, title: c.title, classroom: fakeDb().classrooms.find((x) => x.id === id)!.name, due_at: body.due_at ?? null, status: "pending" })),
      );
    }),

    http.post(`${base}/lessons/:id/publish`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const l = lessonById(String(params.id));
      const c = l ? ownCourse(t.user.id, l.courseId) : null;
      if (!l || !c) return err(404, "NOT_FOUND");
      if (l.generation_status !== "ready") return err(409, "LESSON_NOT_READY");
      const body = ((await request.json().catch(() => ({}))) ?? {}) as Schemas["PublishRequest"];
      const classroomId = body.classroom_id ?? c.classroomId;
      if (classroomId && !c.isPersonal) {
        if (!ownsClassroom(t.user.name, classroomId)) return err(404, "NOT_FOUND");
        if (!(classroomId in c.assigned)) c.assigned[classroomId] = null;
      }
      l.published = true; // idempotent, like published_at = published_at or now
      c.status = "published";
      return json(lessonSummaryOut(l));
    }),

    http.put(`${base}/questions/:id`, async ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const found = questionById(String(params.id));
      if (!found || !ownCourse(t.user.id, found.lesson.courseId)) return err(404, "NOT_FOUND");
      const { question } = (await request.json()) as Schemas["QuestionUpdate"];
      const merged = { ...found.question.content, ...question } as Record<string, unknown>;
      const type = String(question.type ?? found.question.type);
      if (!validQuestion(type, merged)) return err(422, "INVALID_QUESTION");
      const q = found.question;
      q.type = type;
      q.content = { ...merged, type } as typeof q.content;
      q.flag_reason = null;
      q.confidence = 1;
      q.teacher_edited = true;
      return json<Schemas["QuestionOut"]>({ id: q.id, position: q.position, type: q.type, content: q.content, source_page: q.source_page, confidence: 1, flag_reason: null, call_safe: q.call_safe, teacher_edited: true });
    }),

    http.post(`${base}/questions/:id/regenerate`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const found = questionById(String(params.id));
      if (!found || !ownCourse(t.user.id, found.lesson.courseId)) return err(404, "NOT_FOUND");
      const q = found.question;
      // The fake "AI" rewords the prompt and clears the flag.
      const prompt = (q.content.prompt ?? q.content.statement) as Record<string, string> | undefined;
      if (prompt) for (const k of Object.keys(prompt)) prompt[k] = prompt[k]!.replace(/^(\(new\) )?/, "(new) ");
      q.flag_reason = null;
      q.confidence = 0.9;
      return json<Schemas["QuestionOut"]>({ id: q.id, position: q.position, type: q.type, content: q.content, source_page: q.source_page, confidence: 0.9, flag_reason: null, call_safe: q.call_safe, teacher_edited: q.teacher_edited ?? false });
    }),

    http.delete(`${base}/questions/:id`, ({ request, params }) => {
      const t = teacher(request);
      if (t.error) return t.error;
      const found = questionById(String(params.id));
      if (!found || !ownCourse(t.user.id, found.lesson.courseId)) return err(404, "NOT_FOUND");
      removeFakeQuestion(found.question.id);
      return new HttpResponse(null, { status: 204 });
    }),

    // ---- uploads -------------------------------------------------------------------------------

    http.post(`${base}/uploads`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const body = (await request.json()) as Schemas["UploadCreate"];
      const isTeacher = u.roles.includes("teacher");
      if (!body.pages?.length || body.pages.length > UPLOAD_LIMITS.maxPages) return err(422, "VALIDATION");
      if (body.classroom_id && !ownsClassroom(u.name, body.classroom_id)) return err(404, "NOT_FOUND");
      for (const p of body.pages) {
        if (p.kind === "text" && !(p.text ?? "").trim()) return err(422, "INVALID_UPLOAD");
        if (p.kind === "pdf" && (p.size_bytes ?? 0) > UPLOAD_LIMITS.pdfBytes) return err(413, "FILE_TOO_LARGE");
        if (p.kind === "photo" && (p.size_bytes ?? 0) > UPLOAD_LIMITS.photoBytes) return err(413, "FILE_TOO_LARGE");
      }
      const id = nextId("upload");
      const willFail = body.pages.some((p) => /\bfail\b/i.test(p.text ?? ""));
      teacherState().uploads.set(id, {
        id,
        ownerId: u.id,
        pages: body.pages.map((p) => ({ kind: p.kind, stored: p.kind === "text", name: (p as { file_name?: string }).file_name })),
        createdAt: fakeNow(),
        subject: body.subject ?? "BI",
        grade: body.grade ?? 9,
        classroomId: body.classroom_id ?? null,
        personal: body.personal || !isTeacher,
        startedAt: null,
        willFail,
        courseId: null,
      });
      return json<Schemas["UploadCreated"]>(
        {
          id,
          pages: body.pages.map((p, index) => ({ index, upload_url: p.kind === "text" ? null : `${FAKE_STORAGE}/${id}/${index}`, method: "PUT", headers: { "Content-Type": p.kind === "pdf" ? "application/pdf" : "image/jpeg" } })),
        },
        { status: 201 },
      );
    }),

    http.put(`${FAKE_STORAGE}/:upload/:index`, async ({ request, params }) => {
      const up = teacherState().uploads.get(String(params.upload));
      const page = up?.pages[Number(params.index)];
      if (!up || !page) return new HttpResponse(null, { status: 404 });
      const body = await request.arrayBuffer();
      if (body.byteLength === 0) return new HttpResponse(null, { status: 400 });
      // A file whose bytes start with "FAIL" fails once, so per-page retry can be demoed and tested.
      const key = `${up.id}/${String(params.index)}`;
      if (new TextDecoder().decode(body.slice(0, 4)) === "FAIL" && !failedOnce.has(key)) {
        failedOnce.add(key);
        return new HttpResponse(null, { status: 503 });
      }
      page.stored = true;
      return new HttpResponse(null, { status: 200 });
    }),

    http.post(`${base}/uploads/:id/start`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const up = teacherState().uploads.get(String(params.id));
      if (!up || up.ownerId !== u.id) return err(404, "NOT_FOUND");
      if (up.startedAt !== null) return json(uploadStatus(up), { status: 202 });
      if (up.pages.some((p) => !p.stored)) return err(409, "PAGES_MISSING");
      up.startedAt = fakeNow();
      return json(uploadStatus(up), { status: 202 });
    }),

    http.get(`${base}/uploads/:id`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const up = teacherState().uploads.get(String(params.id));
      if (!up || up.ownerId !== u.id) return err(404, "NOT_FOUND");
      return json(uploadStatus(up));
    }),
  ];
}
