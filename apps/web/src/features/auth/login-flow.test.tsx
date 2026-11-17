import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";
import SchoolLoginPage from "@/app/(auth)/login/school/page";
import { DEMO } from "@/mocks/fake-db";
import { renderWithProviders, resetAuthStore } from "@/test/render";
import { nav, router } from "@/test/navigation";
import { useAuthStore } from "./auth-store";

beforeEach(resetAuthStore);

describe("phone OTP login", () => {
  it("validates the number before sending", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Phone number/), "12345");
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    expect(await screen.findByText("Enter a 10-digit mobile number.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number/)).toHaveAttribute("aria-invalid", "true");
  });

  it("says 'Not quite' for a wrong code, then signs in and opens the student farm", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Phone number/), DEMO.studentPhone);
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    const code = await screen.findByLabelText(/6-digit code/);
    await userEvent.type(code, "111111");
    await userEvent.click(screen.getByRole("button", { name: /Verify/ }));
    expect(await screen.findByText(/Not quite/)).toBeInTheDocument();
    expect(screen.queryByText(/Wrong/i)).not.toBeInTheDocument();

    await userEvent.clear(code);
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: /Verify/ }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/farm"));
    expect(useAuthStore.getState().status).toBe("signedIn");
  });

  it("sends a teacher to the teacher shell and a new number to the name screen", async () => {
    for (const [phone, dest] of [
      [DEMO.teacherPhone, "/teacher"],
      [DEMO.newPhone, "/welcome"],
    ] as const) {
      const { unmount } = renderWithProviders(<LoginPage />);
      await userEvent.type(screen.getByLabelText(/Phone number/), phone);
      await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
      await userEvent.type(await screen.findByLabelText(/6-digit code/), "123456");
      await userEvent.click(screen.getByRole("button", { name: /Verify/ }));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith(dest));
      unmount();
      router.replace.mockReset();
    }
  });

  it("honours a safe ?next= link and ignores off-site ones", async () => {
    nav.search = new URLSearchParams("next=//evil.example");
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Phone number/), DEMO.studentPhone);
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    await userEvent.type(await screen.findByLabelText(/6-digit code/), "123456");
    await userEvent.click(screen.getByRole("button", { name: /Verify/ }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/farm"));
  });

  it("shows the resend countdown after a code is sent", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Phone number/), DEMO.studentPhone);
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    expect(await screen.findByRole("button", { name: /सेकंड में फिर से कोड भेजें/ })).toBeDisabled();
  });
});

describe("school computer login", () => {
  it("validates key and name", async () => {
    renderWithProviders(<SchoolLoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    expect(await screen.findByText("A class key looks like BI09-K4X2.")).toBeInTheDocument();
    expect(screen.getByText("Please type your name.")).toBeInTheDocument();
  });

  it("signs in by class key and name", async () => {
    renderWithProviders(<SchoolLoginPage />);
    await userEvent.type(screen.getByLabelText(/Class key/), "bi09k4x2");
    expect(screen.getByLabelText(/Class key/)).toHaveValue("BI09-K4X2");
    await userEvent.type(screen.getByLabelText(/Your name/), "Ravi");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/farm"));
    expect(useAuthStore.getState().session?.method).toBe("class-key");
  });

  it("shows a bilingual error for an unknown key", async () => {
    renderWithProviders(<SchoolLoginPage />, { locale: "kn" });
    await userEvent.type(screen.getByLabelText(/Class key/), "PH09-ZZZZ");
    await userEvent.type(screen.getByLabelText(/Your name/), "Ravi");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ಈ ಕೀ ಇರುವ ತರಗತಿ ಇಲ್ಲ");
    expect(alert).toHaveTextContent("No class has this key");
  });
});
