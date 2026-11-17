import { CLASS_KEY_LOGIN_PATH, type ClassKeyLoginResponse } from "@mooshala/api-client";
import { apiBaseUrl } from "@/lib/env";
import { AuthError, type Session } from "./types";

/**
 * POST /auth/class-key (web PRD section 8). The backend doesn't implement it
 * yet and the payload is our documented assumption (see
 * packages/api-client/src/pending-auth.ts). A 404/405 from a backend without
 * the route surfaces as `unavailable`, never as a fake success.
 */
export async function postClassKeyLogin(classKey: string, name: string, baseUrl = apiBaseUrl): Promise<Session> {
  let res: Response;
  try {
    res = await globalThis.fetch(`${baseUrl}${CLASS_KEY_LOGIN_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_key: classKey, name }),
    });
  } catch {
    throw new AuthError("network");
  }
  if (res.ok) {
    const body = (await res.json()) as ClassKeyLoginResponse;
    return { accessToken: body.access_token, method: "class-key", expiresAt: Date.now() + body.expires_in * 1000 };
  }
  let code: unknown;
  try {
    code = ((await res.json()) as { detail?: { code?: unknown } }).detail?.code;
  } catch {
    /* not JSON */
  }
  if (code === "KEY_NOT_FOUND" || code === "KEY_EXPIRED") throw new AuthError("class_key_not_found");
  if (res.status === 429) throw new AuthError("rate_limited");
  if (res.status === 404 || res.status === 405 || res.status === 501) throw new AuthError("unavailable");
  throw new AuthError("unknown", `class-key login failed: ${res.status}`);
}
