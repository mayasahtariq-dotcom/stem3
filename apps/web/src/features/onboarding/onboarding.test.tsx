import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinRoute } from "@/features/classroom/JoinRoute";
import LanguagePage from "@/app/(auth)/language/page";
import RolePage from "@/app/(auth)/role/page";
import WelcomePage from "@/app/(auth)/welcome/page";
import { readLanguageCookie } from "@/lib/i18n/language";
import { useAppStore } from "@/lib/store/app-store";
import { DEMO } from "@/mocks/fake-db";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { router } from "@/test/navigation";

beforeEach(() => {
  resetAuthStore();
  useAppStore.setState({ draftLanguage: null, draftRole: null, lastRole: null });
});

it("language choice is stored (not taken from the browser) and leads to the role screen", async () => {
  renderWithProviders(<LanguagePage />);
  await userEvent.click(screen.getByRole("button", { name: /ಕನ್ನಡ/ }));
  expect(readLanguageCookie()).toBe("kannada");
  expect(useAppStore.getState().draftLanguage).toBe("kannada");
  expect(router.push).toHaveBeenCalledWith("/role");
});

it("choosing a mode opens that mode straight away (demo sign-in, no phone step)", async () => {
  renderWithProviders(<RolePage />);
  await userEvent.click(screen.getByRole("button", { name: /Teacher/ }));
  expect(useAppStore.getState().draftRole).toBe("teacher");
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/teacher"));
  expect(router.push).not.toHaveBeenCalledWith("/login");
});

it("a new student names themselves, which creates the profile, then joins a class", async () => {
  useAppStore.setState({ draftLanguage: "kannada", draftRole: "student" });
  const services = makeTestServices();
  await signInAs(services, DEMO.newPhone);
  renderWithProviders(<WelcomePage />, { services });
  await userEvent.click(await screen.findByRole("button", { name: /Let's go/ }));
  expect(await screen.findByText("Please type your name.")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Your name/), "Kiran");
  await userEvent.click(screen.getByRole("button", { name: /Let's go/ }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/join"));
  const me = await services.api.GET("/me");
  expect(me.data).toMatchObject({ name: "Kiran", roles: ["student"], language_mode: "kannada", registered: true });
});

describe("join a class", () => {
  it("opens a join link with the key filled in and previews it", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    // Asha is already in BI09-K4X2 (seeded).
    renderWithProviders(<JoinRoute initialKey={DEMO.validKey} />, { services });
    // Already a member: the preview shows the backend's ALREADY_MEMBER error, bilingually.
    expect(await screen.findByText("You are already in this class.")).toBeInTheDocument();
  });

  it("shows join errors (expired key, wrong language) and validates the key format", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(<JoinRoute />, { services });
    const input = await screen.findByLabelText(/Class key/);
    await userEvent.type(input, "BI09");
    await userEvent.click(screen.getByRole("button", { name: /Find class/ }));
    expect(await screen.findByText("A class key looks like BI09-K4X2.")).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, DEMO.expiredKey);
    await userEvent.click(screen.getByRole("button", { name: /Find class/ }));
    expect(await screen.findByText(/This class key has expired/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, DEMO.kannadaOnlyKey);
    await userEvent.click(screen.getByRole("button", { name: /Find class/ }));
    expect(await screen.findByText(/doesn't use your language/)).toBeInTheDocument();
  });

  it("joins a new class and goes to the farm", async () => {
    const services = makeTestServices();
    useAppStore.setState({ draftLanguage: "kannada", draftRole: "student" });
    await signInAs(services, DEMO.newPhone);
    await services.api.PUT("/me", { body: { name: "Kiran", language_mode: "kannada", roles: ["student"] } });
    renderWithProviders(<JoinRoute initialKey={"ch10knda"} />, { services });
    expect(await screen.findByTestId("class-preview")).toHaveTextContent("Class 10-B Chemistry");
    await userEvent.click(screen.getByRole("button", { name: /Join this class/ }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/farm"));
  });
});
