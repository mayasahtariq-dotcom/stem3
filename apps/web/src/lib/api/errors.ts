/**
 * API errors. The backend answers errors as `{"detail": {"code": "KEY_NOT_FOUND"}}`
 * (backend/app/errors.py); the UI maps each code to a bilingual message
 * (messages/*.json, namespace `errors`).
 */

export const KNOWN_ERROR_CODES = [
  "UNAUTHORIZED",
  "PROFILE_INCOMPLETE",
  "NOT_A_TEACHER",
  "NOT_A_STUDENT",
  "NOT_A_PARENT",
  "NOT_FOUND",
  "KEY_NOT_FOUND",
  "KEY_EXPIRED",
  "ALREADY_MEMBER",
  "LANGUAGE_NOT_ALLOWED",
  "TOO_MANY_ATTEMPTS",
  "PHONE_IN_USE",
  "CONSENT_REQUIRED",
  "VALIDATION",
  "KEY_GENERATION_FAILED",
  "INVALID_UPLOAD",
  "FILE_TOO_LARGE",
  "PAGES_MISSING",
  "LESSON_NOT_PUBLISHED",
  "LESSON_NOT_READY",
  "INVALID_QUESTION",
  "AI_UNAVAILABLE",
  "HEARTS_EMPTY",
  "DOUBT_LIMIT",
  "INVALID_ANSWER",
  "LESSON_NOT_STARTED",
  "CODE_NOT_FOUND",
  "CODE_EXPIRED",
  "TOO_MANY_PARENTS",
  "NOT_ENOUGH_GEMS",
  "FREEZES_FULL",
  "ALREADY_OWNED",
  "ALREADY_CLAIMED",
  "QUEST_NOT_COMPLETE",
  "POT_ALREADY_OPENED",
  "DUPLICATE_PHONE",
  "OUTSIDE_CALL_HOURS",
  "CALL_IN_PROGRESS",
  "CONSENT_PENDING",
  "CALLS_PAUSED",
  "WEEKLY_CAP_REACHED",
  "NETWORK",
  "SERVER",
  "UNKNOWN",
] as const;

export type ApiErrorCode = (typeof KNOWN_ERROR_CODES)[number];

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message?: string,
    /** Extra fields from the error body, e.g. `refill_at` with HEARTS_EMPTY. */
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }

  /** Worth retrying automatically (network blips and 5xx), never 4xx. */
  get retryable(): boolean {
    return this.code === "NETWORK" || this.status >= 500;
  }
}

const isKnown = (c: unknown): c is ApiErrorCode =>
  typeof c === "string" && (KNOWN_ERROR_CODES as readonly string[]).includes(c);

/** Builds an ApiError from a status and a parsed (or unparsable) error body. */
export function toApiError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const code = (detail as { code?: unknown } | null)?.code;
  if (isKnown(code)) return new ApiError(code, status, undefined, (detail ?? {}) as Record<string, unknown>);
  if (status === 401) return new ApiError("UNAUTHORIZED", status);
  if (status === 404) return new ApiError("NOT_FOUND", status);
  if (status === 422) return new ApiError("VALIDATION", status);
  if (status === 429) return new ApiError("TOO_MANY_ATTEMPTS", status);
  if (status >= 500) return new ApiError("SERVER", status);
  return new ApiError("UNKNOWN", status, typeof code === "string" ? code : undefined);
}

export function asApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  // Only fetch failures are network errors; other TypeErrors are bugs.
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) return new ApiError("NETWORK", 0, err.message);
  return new ApiError("UNKNOWN", 0, err instanceof Error ? err.message : String(err));
}
