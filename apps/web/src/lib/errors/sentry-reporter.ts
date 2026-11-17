import * as Sentry from "@sentry/nextjs";
import type { ErrorReporter } from "./reporter";

export const sentryReporter: ErrorReporter = {
  capture(error, context) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  },
};
