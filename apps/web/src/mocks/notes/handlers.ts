import { http, HttpResponse } from "msw";
import { NOTE_LIMITS, type ClassNote, type NoteCreate } from "@mooshala/api-client";
import { fakeDb, userForToken } from "../fake-db";
import { ownsClassroom } from "../teacher/state";
import { addNote, notesState } from "./state";

const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });
function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
}

function out(n: ReturnType<typeof notesState>["notes"][number]): ClassNote {
  const cls = fakeDb().classrooms.find((c) => c.id === n.classroom_id);
  return { id: n.id, classroom_id: n.classroom_id, classroom: cls?.name ?? "", teacher_name: n.teacherName, title: n.title, body: n.body, file: n.file, created_at: n.created_at };
}

/** Pending contract: class notes (packages/api-client/src/pending-notes.ts). */
export function makeNotesHandlers(base: string) {
  return [
    http.post(`${base}/classrooms/:id/notes`, async ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.roles.includes("teacher")) return err(403, "NOT_A_TEACHER");
      const classId = String(params.id);
      if (!ownsClassroom(u.name ?? "", classId)) return err(404, "NOT_FOUND");
      const body = (await request.json()) as NoteCreate;
      const title = (body.title ?? "").trim();
      const text = (body.body ?? "").trim();
      const f = body.file ?? null;
      if (!title || title.length > NOTE_LIMITS.titleMax || text.length > NOTE_LIMITS.bodyMax) return err(422, "VALIDATION");
      if (!text && !f) return err(422, "VALIDATION");
      let file = null;
      if (f) {
        if (!/^data:[\w/+.-]+;base64,/.test(f.data_url)) return err(422, "VALIDATION");
        const size = Math.floor((f.data_url.length - f.data_url.indexOf(",") - 1) * 0.75);
        if (size > NOTE_LIMITS.fileMaxBytes) return err(413, "FILE_TOO_LARGE");
        file = { name: f.name.slice(0, 200), type: f.type, url: f.data_url, size };
      }
      const note = addNote({ ownerId: u.id, teacherName: u.name ?? "", classroom_id: classId, title, body: text, file });
      return HttpResponse.json(out(note), { status: 201 });
    }),
    http.get(`${base}/teacher/notes`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.roles.includes("teacher")) return err(403, "NOT_A_TEACHER");
      return HttpResponse.json(notesState().notes.filter((n) => n.ownerId === u.id).map(out));
    }),
    http.get(`${base}/me/notes`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const mine = fakeDb().memberships.get(u.id) ?? new Set<string>();
      return HttpResponse.json(notesState().notes.filter((n) => mine.has(n.classroom_id)).map(out));
    }),
  ];
}
