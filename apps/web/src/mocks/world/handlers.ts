import { http, HttpResponse } from "msw";
import { isFieldId } from "@/lib/world/fields";
import { userForToken } from "../fake-db";
import { idempotent } from "../idempotency";
import { celebrate, inventory, layout, purchase, saveLayout, store, worldState } from "./state";

const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });
const auth = (request: Request) => {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
};
const STATUS: Record<string, number> = { NOT_FOUND: 404, NOT_ENOUGH_GEMS: 409, FIELD_LOCKED: 403, LAYOUT_CONFLICT: 409 };

/** Students only: teachers and parents never see the store or edit a farm. */
function student(request: Request) {
  const u = auth(request);
  if (!u) return { error: err(401, "UNAUTHORIZED") };
  if (!u.roles.includes("student")) return { error: err(403, "NOT_A_STUDENT") };
  return { user: u };
}

/** MOCK ONLY: farm worlds (packages/api-client/src/pending-world.ts). */
export function makeWorldHandlers(base: string) {
  return [
    http.get(`${base}/world`, ({ request }) => {
      const s = student(request);
      return s.error ?? HttpResponse.json(worldState(s.user.id));
    }),
    http.post(`${base}/world/fields/:id/celebrate`, ({ request, params }) => {
      const s = student(request);
      if (s.error) return s.error;
      const f = String(params.id);
      if (!isFieldId(f)) return err(404, "NOT_FOUND");
      const e = celebrate(s.user.id, f);
      return e ? err(STATUS[e]!, e) : HttpResponse.json(worldState(s.user.id));
    }),
    http.get(`${base}/world/store`, ({ request }) => {
      const s = student(request);
      return s.error ?? HttpResponse.json(store(s.user.id));
    }),
    http.get(`${base}/world/inventory`, ({ request }) => {
      const s = student(request);
      return s.error ?? HttpResponse.json(inventory(s.user.id));
    }),
    http.post(`${base}/world/store/purchase`, async ({ request }) => {
      const s = student(request);
      if (s.error) return s.error;
      const body = (await request.clone().json().catch(() => ({}))) as { item_id?: string };
      return idempotent(request, s.user.id, () => {
        const r = purchase(s.user.id, String(body.item_id ?? ""));
        return "error" in r ? err(STATUS[r.error]!, r.error) : HttpResponse.json(r, { status: 201 });
      });
    }),
    http.get(`${base}/world/fields/:id/layout`, ({ request, params }) => {
      const s = student(request);
      if (s.error) return s.error;
      const f = String(params.id);
      return isFieldId(f) ? HttpResponse.json(layout(s.user.id, f)) : err(404, "NOT_FOUND");
    }),
    http.put(`${base}/world/fields/:id/layout`, async ({ request, params }) => {
      const s = student(request);
      if (s.error) return s.error;
      const f = String(params.id);
      if (!isFieldId(f)) return err(404, "NOT_FOUND");
      const body = (await request.json().catch(() => null)) as { version?: number; objects?: unknown } | null;
      if (!body || typeof body.version !== "number" || !Array.isArray(body.objects)) return err(422, "VALIDATION");
      const r = saveLayout(s.user.id, f, body.version, body.objects as never);
      return "error" in r ? err(STATUS[r.error] ?? 422, r.error) : HttpResponse.json(r);
    }),
  ];
}
