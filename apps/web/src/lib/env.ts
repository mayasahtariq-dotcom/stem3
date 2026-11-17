import { z } from "zod";

/**
 * Public (browser-safe) configuration. Only NEXT_PUBLIC_ variables may appear
 * here; every secret stays on the backend. Values are read with literal
 * `process.env.X` so Next.js can inline them at build time.
 */
const schema = z
  .object({
    apiBaseUrl: z.string().default(""),
    supabaseUrl: z.string().default(""),
    supabaseAnonKey: z.string().default(""),
    sentryDsn: z.string().default(""),
    useFakes: z.boolean(),
  })
  .superRefine((env, ctx) => {
    if (env.useFakes) return;
    for (const key of ["apiBaseUrl", "supabaseUrl", "supabaseAnonKey"] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when NEXT_PUBLIC_USE_FAKES is not "true"` });
      }
    }
  });

export type PublicEnv = z.infer<typeof schema>;

export function readEnv(source: Record<string, string | undefined>): PublicEnv {
  return schema.parse({
    apiBaseUrl: (source.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, ""),
    supabaseUrl: source.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: source.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    sentryDsn: source.NEXT_PUBLIC_SENTRY_DSN ?? "",
    // Fakes are the default: the app must run with no keys at all.
    useFakes: (source.NEXT_PUBLIC_USE_FAKES ?? "true") !== "false",
  });
}

export const env: PublicEnv = readEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_USE_FAKES: process.env.NEXT_PUBLIC_USE_FAKES,
});

/** Base URL for API calls. With fakes on, MSW answers requests to this origin. */
export const FAKE_API_BASE_URL = "http://fake-api.mooshala.test";
export const apiBaseUrl = env.useFakes ? env.apiBaseUrl || FAKE_API_BASE_URL : env.apiBaseUrl;
