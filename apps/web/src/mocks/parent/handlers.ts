import { http, HttpResponse } from "msw";
import type { Schemas } from "@mooshala/api-client";
import { userForToken, fakeDb } from "../fake-db";
import { fakeNow } from "../learning/state";
import { activeLink, childDashboard, childOut, classesOf, newCode, PARENT_RULES, parentState, refreshConsent, validCode } from "./state";

/** Fakes for backend/app/routers/parents.py (student side and parent side). */
const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });
const json = <T,>(body: T, init?: ResponseInit) => HttpResponse.json(body as never, init);
const CODE_STATUS = { CODE_NOT_FOUND: 404, CODE_EXPIRED: 410 } as const;

function auth(request: Request) {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
}

export function makeParentHandlers(base: string) {
  const parent = (request: Request) => {
    const u = auth(request);
    if (!u) return { error: err(401, "UNAUTHORIZED") };
    if (!u.roles.includes("parent")) return { error: err(403, "NOT_A_PARENT") };
    const st = parentState();
    st.names[u.id] ??= { name: u.name ?? "Parent", phoneLast4: (u.phone ?? "0000").slice(-4) };
    return { user: u };
  };
  const linked = (parentId: string, childId: string) => activeLink(parentId, childId);

  return [
    // ---- student side ----
    http.post(`${base}/me/link-code`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      if (!u.roles.includes("student")) return err(403, "NOT_A_STUDENT");
      parentState().names[u.id] ??= { name: u.name ?? "Student", phoneLast4: (u.phone ?? "0000").slice(-4) };
      return json<Schemas["LinkCodeOut"]>(newCode(u.id), { status: 201 });
    }),

    http.get(`${base}/me/parents`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const st = parentState();
      return json<Schemas["ParentOut"][]>(
        st.links
          .filter((l) => l.studentId === u.id && l.active)
          .map((l) => ({ id: l.parentId, name: st.names[l.parentId]?.name ?? "Parent", phone_last4: st.names[l.parentId]?.phoneLast4 ?? "0000", linked_at: new Date(l.linkedAt).toISOString(), consented: l.consentAt !== null })),
      );
    }),

    http.delete(`${base}/me/parents/:id`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const l = activeLink(String(params.id), u.id);
      if (!l) return err(404, "NOT_FOUND");
      l.active = false;
      refreshConsent(u.id);
      return new HttpResponse(null, { status: 204 });
    }),

    // ---- parent side ----
    http.get(`${base}/parent/link/:code`, ({ request, params }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const v = validCode(String(params.code));
      if (v.error) return err(CODE_STATUS[v.error], v.error);
      const id = v.entry.studentId;
      return json<Schemas["ChildPreview"]>({ id, name: parentState().names[id]?.name ?? "Student", classes: classesOf(id) });
    }),

    http.post(`${base}/parent/link`, async ({ request }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const { code } = (await request.json()) as Schemas["LinkIn"];
      const v = validCode(code ?? "");
      if (v.error) return err(CODE_STATUS[v.error], v.error);
      const st = parentState();
      const childId = v.entry.studentId;
      const others = st.links.filter((l) => l.studentId === childId && l.active && l.parentId !== p.user.id).length;
      if (others >= PARENT_RULES.maxParents) return err(409, "TOO_MANY_PARENTS");
      let link = st.links.find((l) => l.parentId === p.user.id && l.studentId === childId);
      if (!link) {
        link = { parentId: p.user.id, studentId: childId, linkedAt: fakeNow(), active: true, consentAt: null };
        st.links.push(link);
      } else Object.assign(link, { active: true, linkedAt: fakeNow(), consentAt: null });
      v.entry.usedAt = fakeNow();
      return json(childOut(childId, link), { status: 201 });
    }),

    http.get(`${base}/parent/children`, ({ request }) => {
      const p = parent(request);
      if (p.error) return p.error;
      return json(parentState().links.filter((l) => l.parentId === p.user.id && l.active).map((l) => childOut(l.studentId, l)));
    }),

    http.post(`${base}/parent/children/:id/consent`, ({ request, params }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const link = linked(p.user.id, String(params.id));
      if (!link) return err(404, "NOT_FOUND");
      link.consentAt = link.consentAt ?? fakeNow();
      parentState().consent[link.studentId] = "approved";
      return json(childOut(link.studentId, link));
    }),

    http.post(`${base}/parent/children/:id/revoke-consent`, ({ request, params }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const link = linked(p.user.id, String(params.id));
      if (!link) return err(404, "NOT_FOUND");
      const st = parentState();
      for (const l of st.links) if (l.studentId === link.studentId) l.consentAt = null;
      st.consent[link.studentId] = "revoked";
      return json(childOut(link.studentId, link));
    }),

    http.delete(`${base}/parent/children/:id`, ({ request, params }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const link = linked(p.user.id, String(params.id));
      if (!link) return err(404, "NOT_FOUND");
      link.active = false;
      refreshConsent(link.studentId);
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${base}/parent/children/:id/deletion`, ({ request, params }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const link = linked(p.user.id, String(params.id));
      if (!link) return err(404, "NOT_FOUND");
      const st = parentState();
      st.consent[link.studentId] = "revoked";
      const requestId = `del-${st.deletions.length + 1}`;
      st.deletions.push(requestId);
      return json<Schemas["DeletionOut"]>({ request_id: requestId, status: "requested", complete_by: new Date(fakeNow() + PARENT_RULES.deletionDays * 86400_000).toISOString() }, { status: 202 });
    }),

    http.get(`${base}/parent/children/:id/dashboard`, ({ request, params }) => {
      const p = parent(request);
      if (p.error) return p.error;
      const link = linked(p.user.id, String(params.id));
      if (!link || !fakeDb()) return err(404, "NOT_FOUND");
      return json(childDashboard(link.studentId, link));
    }),
  ];
}
