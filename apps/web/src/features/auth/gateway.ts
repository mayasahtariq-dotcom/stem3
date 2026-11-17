import type { Session } from "./types";

/**
 * Everything the app needs from a login provider. The real implementation uses
 * Supabase phone OTP (what the backend verifies) plus the backend's class-key
 * login; the fake accepts any 10-digit number with code 123456.
 */
export interface AuthGateway {
  /** Sends a 6-digit code by SMS. `phone` is E.164 (+91XXXXXXXXXX). */
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<Session>;
  /** Shared school computers: class key plus the student's name. */
  loginWithClassKey(classKey: string, name: string): Promise<Session>;
  /** The stored session, refreshed if needed, or null. */
  restore(): Promise<Session | null>;
  /** A valid access token for the current session (refreshing it if needed). */
  getAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
}
