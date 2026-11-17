import { screen, waitFor, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useAuthStore } from "@/features/auth/auth-store";
import { MESSAGES, makeTestServices, resetAuthStore } from "@/test/render";
import { AppProviders } from "./providers";

beforeEach(resetAuthStore);

describe("application startup", () => {
  it("renders the app and finishes restoring the session (signed out)", async () => {
    render(
      <NextIntlClientProvider locale="hi" messages={MESSAGES.hi} timeZone="Asia/Kolkata">
        <AppProviders services={makeTestServices()}>
          <p>app body</p>
        </AppProviders>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("app body")).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().status).toBe("signedOut"));
  });

  it("restores a stored session at startup", async () => {
    const services = makeTestServices();
    await services.auth.verifyOtp("+919876543210", "123456");
    render(
      <NextIntlClientProvider locale="kn" messages={MESSAGES.kn} timeZone="Asia/Kolkata">
        <AppProviders services={services}>
          <p>app body</p>
        </AppProviders>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(useAuthStore.getState().status).toBe("signedIn"));
  });
});
