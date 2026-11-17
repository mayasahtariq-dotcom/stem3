/** Error reporting seam: Sentry in production when a DSN is set, console otherwise. */
export interface ErrorReporter {
  capture(error: unknown, context?: Record<string, unknown>): void;
}

export const consoleReporter: ErrorReporter = {
  capture(error, context) {
    console.error("[mooshala]", error, context ?? "");
  },
};

export const silentReporter: ErrorReporter = { capture() {} };
