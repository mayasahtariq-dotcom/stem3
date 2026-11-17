"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { ApiClient } from "@mooshala/api-client";
import type { AuthGateway } from "@/features/auth/gateway";
import type { ErrorReporter } from "@/lib/errors/reporter";
import type { PendingClient } from "@/lib/api/pending-client";

/**
 * External services behind interfaces. Production wiring lives in
 * `create-services.ts`; tests and Storybook pass fakes.
 */
export interface Services {
  auth: AuthGateway;
  api: ApiClient;
  /** Endpoints the spec names but the backend hasn't built (mocked). */
  pending: PendingClient;
  reporter: ErrorReporter;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("useServices must be used inside <ServicesProvider>");
  return s;
}
