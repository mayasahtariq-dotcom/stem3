import { onFakeDbReset, registerFakeStore } from "./fake-db";

/**
 * Idempotency for the fake backend, as the real one must do it (see
 * docs/web/backend-handoff.md): a POST that carries `Idempotency-Key` runs
 * once per user and key; a replay gets the first answer back unchanged, so an
 * offline answer synced twice never pays XP, hearts or rewards twice.
 */
let seen = new Map<string, { status: number; body: string }>();
onFakeDbReset(() => (seen = new Map()));
registerFakeStore(
  "idempotency",
  () => seen,
  (v) => (seen = v),
);

export async function idempotent(
  request: Request,
  userId: string,
  run: () => Response | Promise<Response>,
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key");
  if (!key) return run();
  const id = `${userId}:${new URL(request.url).pathname}:${key}`;
  const hit = seen.get(id);
  if (hit)
    return new Response(hit.body, {
      status: hit.status,
      headers: { "Content-Type": "application/json", "Idempotent-Replay": "true" },
    });
  const res = await run();
  // Only successes are remembered; a refused request may be retried.
  if (res.ok) seen.set(id, { status: res.status, body: await res.clone().text() });
  return res;
}

export const idempotencyCount = () => seen.size;
