import { apiBaseUrl } from "@/lib/env";
import type { AuthGateway } from "./gateway";
import { postClassKeyLogin } from "./class-key";
import { AuthError, type Session } from "./types";
import { browserStorage, type KeyValueStorage } from "./storage";

const PHONE_SESSION = "aaroh.session";
const CLASS_KEY_SESSION = "mooshala.class-key-session";

async function postJson(path: string, body: unknown, baseUrl: string): Promise<{ status: number; data: unknown }> {
  let res: Response;
  try {
    res = await globalThis.fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("network");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

function errorFrom(status: number, data: unknown): AuthError {
  const detail = (data as { detail?: unknown } | null)?.detail;
  const code = typeof detail === "object" && detail ? (detail as { code?: string }).code : undefined;
  if (code === "OTP_EXPIRED") return new AuthError("code_expired");
  if (code === "INVALID_CODE") return new AuthError("invalid_code");
  if (status === 429) return new AuthError("rate_limited");
  if (status === 422) return new AuthError("invalid_phone");
  return new AuthError("unknown", typeof detail === "string" ? detail : `login failed: ${status}`);
}

/**
 * Real login against the Aaroh FastAPI backend (its own phone OTP and tokens, no Supabase).
 * Endpoints: POST /auth/otp, /auth/verify, /auth/class-key under the /web compatibility layer.
 * Phone sessions live in localStorage; class-key sessions in sessionStorage, so closing the
 * browser on a shared school computer signs the student out.
 */
export class BackendAuthGateway implements AuthGateway {
  /** The last code the backend handed back in demo mode (shown on the code screen). */
  lastDevCode: string | null = null;

  constructor(
    private readonly baseUrl: string = apiBaseUrl,
    private readonly phoneStorage: KeyValueStorage = browserStorage("local"),
    private readonly classKeyStorage: KeyValueStorage = browserStorage("session"),
  ) {}

  async requestOtp(phone: string): Promise<void> {
    const { status, data } = await postJson("/auth/otp", { phone }, this.baseUrl);
    if (status >= 400) throw errorFrom(status, data);
    this.lastDevCode = (data as { dev_code?: string | null } | null)?.dev_code ?? null;
    if (this.lastDevCode && typeof console !== "undefined") console.info(`[demo] login code: ${this.lastDevCode}`);
  }

  async verifyOtp(phone: string, code: string): Promise<Session> {
    const { status, data } = await postJson("/auth/verify", { phone, code }, this.baseUrl);
    if (status >= 400) throw errorFrom(status, data);
    const body = data as { access_token: string; expires_in: number };
    const session: Session = { accessToken: body.access_token, method: "phone", expiresAt: Date.now() + body.expires_in * 1000, phone };
    this.phoneStorage.set(PHONE_SESSION, JSON.stringify(session));
    return session;
  }

  async loginWithClassKey(classKey: string, name: string): Promise<Session> {
    const session = await postClassKeyLogin(classKey, name, this.baseUrl);
    this.classKeyStorage.set(CLASS_KEY_SESSION, JSON.stringify(session));
    return session;
  }

  private read(storage: KeyValueStorage, key: string): Session | null {
    const raw = storage.get(key);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Session;
      if (s.expiresAt > Date.now()) return s;
    } catch {
      /* corrupt */
    }
    storage.remove(key);
    return null;
  }

  async restore(): Promise<Session | null> {
    return this.read(this.classKeyStorage, CLASS_KEY_SESSION) ?? this.read(this.phoneStorage, PHONE_SESSION);
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.restore())?.accessToken ?? null;
  }

  async signOut(): Promise<void> {
    this.classKeyStorage.remove(CLASS_KEY_SESSION);
    this.phoneStorage.remove(PHONE_SESSION);
  }
}
