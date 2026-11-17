import { createClient, type SupabaseClient, type Session as SbSession } from "@supabase/supabase-js";
import type { AuthGateway } from "./gateway";
import { postClassKeyLogin } from "./class-key";
import { AuthError, type Session } from "./types";
import { browserStorage, type KeyValueStorage } from "./storage";

const CLASS_KEY_SESSION = "mooshala.class-key-session";

/** Maps Supabase Auth error codes (https://supabase.com/docs/guides/auth/debugging/error-codes). */
export function mapSupabaseError(err: { code?: string; status?: number; message?: string }): AuthError {
  switch (err.code) {
    case "otp_expired":
      return new AuthError("code_expired");
    case "invalid_credentials":
    case "otp_disabled":
      return new AuthError("invalid_code");
    case "over_sms_send_rate_limit":
    case "over_request_rate_limit":
      return new AuthError("rate_limited");
    case "validation_failed":
    case "phone_provider_disabled":
      return new AuthError(err.code === "validation_failed" ? "invalid_phone" : "unavailable");
  }
  if (err.status === 429) return new AuthError("rate_limited");
  if (!err.status) return new AuthError("network", err.message);
  return new AuthError("unknown", err.message);
}

const fromSupabase = (s: SbSession): Session => ({
  accessToken: s.access_token,
  method: "phone",
  expiresAt: (s.expires_at ?? 0) * 1000,
  phone: s.user.phone ? `+${s.user.phone.replace(/^\+/, "")}` : undefined,
});

/**
 * Real login. Phone OTP goes to Supabase Auth, whose JWTs the FastAPI backend
 * verifies (backend/app/auth.py); supabase-js persists and refreshes the
 * session. Class-key sessions live in sessionStorage, so closing the browser
 * on a shared school computer signs the student out.
 */
export class SupabaseAuthGateway implements AuthGateway {
  private readonly sb: SupabaseClient;

  constructor(
    url: string,
    anonKey: string,
    private readonly classKeyStorage: KeyValueStorage = browserStorage("session"),
  ) {
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "mooshala.auth" },
    });
  }

  async requestOtp(phone: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithOtp({ phone });
    if (error) throw mapSupabaseError(error);
  }

  async verifyOtp(phone: string, code: string): Promise<Session> {
    const { data, error } = await this.sb.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error) throw mapSupabaseError(error);
    if (!data.session) throw new AuthError("unknown", "no session after verify");
    return fromSupabase(data.session);
  }

  async loginWithClassKey(classKey: string, name: string): Promise<Session> {
    const session = await postClassKeyLogin(classKey, name);
    this.classKeyStorage.set(CLASS_KEY_SESSION, JSON.stringify(session));
    return session;
  }

  private classKeySession(): Session | null {
    const raw = this.classKeyStorage.get(CLASS_KEY_SESSION);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Session;
      if (s.expiresAt > Date.now()) return s;
    } catch {
      /* corrupt */
    }
    this.classKeyStorage.remove(CLASS_KEY_SESSION);
    return null;
  }

  async restore(): Promise<Session | null> {
    const ck = this.classKeySession();
    if (ck) return ck;
    const { data } = await this.sb.auth.getSession(); // refreshes an expired token
    return data.session ? fromSupabase(data.session) : null;
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.restore())?.accessToken ?? null;
  }

  async signOut(): Promise<void> {
    this.classKeyStorage.remove(CLASS_KEY_SESSION);
    await this.sb.auth.signOut();
  }
}
