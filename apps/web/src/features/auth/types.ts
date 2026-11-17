/** Roles a user can hold (backend `Role` in app/routers/me.py). */
export const ROLES = ["student", "teacher", "parent"] as const;
export type Role = (typeof ROLES)[number];

/** Stored language mode (backend `LanguageMode`). English always shows under the regional line. */
export const LANGUAGE_MODES = ["hindi", "kannada"] as const;
export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export type AuthMethod = "phone" | "class-key";

export interface Session {
  accessToken: string;
  method: AuthMethod;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** E.164, phone sign-in only. */
  phone?: string;
}

/** The signed-in user's profile (backend `MeResponse`). */
export interface Profile {
  id: string;
  registered: boolean;
  name: string | null;
  phone: string | null;
  roles: Role[];
  languageMode: LanguageMode | null;
}

export type AuthErrorCode =
  | "invalid_phone"
  | "invalid_code"
  | "code_expired"
  | "rate_limited"
  | "class_key_not_found"
  | "network"
  | "unavailable"
  | "unknown";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }
}
