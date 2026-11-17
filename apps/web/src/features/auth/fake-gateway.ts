import type { AuthGateway } from "./gateway";
import { postClassKeyLogin } from "./class-key";
import { AuthError, type Session } from "./types";
import { browserStorage, type KeyValueStorage } from "./storage";

export const FAKE_OTP = "123456";
/** Numbers that make the fake fail, so error states can be demoed. */
export const FAKE_RATE_LIMITED_PHONE = "+919999999999";
export const FAKE_EXPIRED_CODE = "000000";

const KEY = "mooshala.fake-session";
const DAY = 24 * 60 * 60 * 1000;

export const fakeTokenFor = (phone: string) => `fake-token-${phone.replace(/\D/g, "")}`;

/**
 * Fake login for development and tests (NEXT_PUBLIC_USE_FAKES=true): any valid
 * number gets code 123456. Class-key login still goes through the API layer,
 * where MSW answers it.
 */
export class FakeAuthGateway implements AuthGateway {
  private session: Session | null = null;

  constructor(
    private readonly storage: KeyValueStorage = browserStorage("local"),
    private readonly delayMs = 400,
    private readonly classKeyStorage: KeyValueStorage = browserStorage("session"),
  ) {}

  private wait() {
    return new Promise((r) => setTimeout(r, this.delayMs));
  }

  async requestOtp(phone: string): Promise<void> {
    await this.wait();
    if (phone === FAKE_RATE_LIMITED_PHONE) throw new AuthError("rate_limited");
  }

  async verifyOtp(phone: string, code: string): Promise<Session> {
    await this.wait();
    if (code === FAKE_EXPIRED_CODE) throw new AuthError("code_expired");
    if (code !== FAKE_OTP) throw new AuthError("invalid_code");
    const session: Session = { accessToken: fakeTokenFor(phone), method: "phone", expiresAt: Date.now() + DAY, phone };
    this.session = session;
    this.storage.set(KEY, JSON.stringify(session));
    return session;
  }

  async loginWithClassKey(classKey: string, name: string): Promise<Session> {
    const session = await postClassKeyLogin(classKey, name);
    this.session = session;
    this.classKeyStorage.set(KEY, JSON.stringify(session));
    return session;
  }

  async restore(): Promise<Session | null> {
    if (this.session && this.session.expiresAt > Date.now()) return this.session;
    for (const store of [this.classKeyStorage, this.storage]) {
      const raw = store.get(KEY);
      if (!raw) continue;
      try {
        const s = JSON.parse(raw) as Session;
        if (s.expiresAt > Date.now()) return (this.session = s);
      } catch {
        /* corrupt */
      }
      store.remove(KEY);
    }
    return null;
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.restore())?.accessToken ?? null;
  }

  async signOut(): Promise<void> {
    this.session = null;
    this.storage.remove(KEY);
    this.classKeyStorage.remove(KEY);
  }
}
