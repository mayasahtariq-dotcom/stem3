import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import { buildApiClient } from "@/lib/api/client";
import { buildPendingClient } from "@/lib/api/pending-client";
import { FAKE_API_BASE_URL } from "@/lib/env";
import { FakeAuthGateway } from "@/features/auth/fake-gateway";
import { memoryStorage } from "@/features/auth/storage";
import { silentReporter } from "@/lib/errors/reporter";
import { ServicesProvider, type Services } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";

export const MESSAGES = { hi: { ...hi, _en: en }, kn: { ...kn, _en: en } };

export function makeTestServices(overrides: Partial<Services> = {}): Services {
  const auth = new FakeAuthGateway(memoryStorage(), 0, memoryStorage());
  return {
    auth,
    api: buildApiClient(() => auth.getAccessToken(), FAKE_API_BASE_URL),
    pending: buildPendingClient(() => auth.getAccessToken(), FAKE_API_BASE_URL),
    reporter: silentReporter,
    ...overrides,
  };
}

export function TestProviders({ children, locale = "hi", services, client }: { children: ReactNode; locale?: "hi" | "kn"; services?: Services; client?: QueryClient }) {
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Kolkata">
      <QueryClientProvider client={qc}>
        <ServicesProvider services={services ?? makeTestServices()}>{children}</ServicesProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, opts: { locale?: "hi" | "kn"; services?: Services } & Omit<RenderOptions, "wrapper"> = {}) {
  const services = opts.services ?? makeTestServices();
  const result = render(ui, { wrapper: ({ children }) => <TestProviders locale={opts.locale} services={services}>{children}</TestProviders>, ...opts });
  return { ...result, services };
}

/** Signs the fake gateway in as a seeded demo phone and marks the store signed in. */
export async function signInAs(services: Services, tenDigits: string) {
  const session = await services.auth.verifyOtp(`+91${tenDigits}`, "123456");
  useAuthStore.getState().setSession(session);
  return session;
}

export function resetAuthStore() {
  useAuthStore.setState({ status: "restoring", session: null });
}
