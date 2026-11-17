import { buildApiClient } from "@/lib/api/client";
import { buildPendingClient } from "@/lib/api/pending-client";
import { env } from "@/lib/env";
import { FakeAuthGateway } from "@/features/auth/fake-gateway";
import { SupabaseAuthGateway } from "@/features/auth/supabase-gateway";
import type { AuthGateway } from "@/features/auth/gateway";
import { consoleReporter } from "@/lib/errors/reporter";
import { sentryReporter } from "@/lib/errors/sentry-reporter";
import type { Services } from "./services";

/** Production wiring: fakes when NEXT_PUBLIC_USE_FAKES is on, real services otherwise. */
export function createServices(): Services {
  const auth: AuthGateway = env.useFakes
    ? new FakeAuthGateway()
    : new SupabaseAuthGateway(env.supabaseUrl, env.supabaseAnonKey);
  return {
    auth,
    api: buildApiClient(() => auth.getAccessToken()),
    pending: buildPendingClient(() => auth.getAccessToken()),
    reporter: env.sentryDsn ? sentryReporter : consoleReporter,
  };
}
