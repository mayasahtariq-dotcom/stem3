import { screen, waitFor } from "@testing-library/react";
import { DEMO } from "@/mocks/fake-db";
import { renderWithProviders, resetAuthStore, signInAs, makeTestServices } from "@/test/render";
import { nav, router } from "@/test/navigation";
import { useAuthStore } from "./auth-store";
import { EntryGate } from "./EntryGate";
import { RoleGate } from "./RoleGate";

beforeEach(resetAuthStore);

describe("RoleGate", () => {
  it("sends signed-out visitors to login with a return link", async () => {
    nav.pathname = "/farm";
    useAuthStore.getState().setSession(null);
    renderWithProviders(<RoleGate role="student">secret farm</RoleGate>);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?next=%2Ffarm"));
    expect(screen.queryByText("secret farm")).not.toBeInTheDocument();
  });

  it("lets a student into the student area", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(<RoleGate role="student">secret farm</RoleGate>, { services });
    expect(await screen.findByText("secret farm")).toBeInTheDocument();
  });

  it("redirects a student away from the teacher area", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(<RoleGate role="teacher">teacher tools</RoleGate>, { services });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/farm"));
    expect(screen.queryByText("teacher tools")).not.toBeInTheDocument();
  });
});

describe("EntryGate (app start)", () => {
  it("starts onboarding when no language is stored", async () => {
    useAuthStore.getState().setSession(null);
    renderWithProviders(<EntryGate />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/language"));
  });

  it("goes to the mode picker when a language is stored but nobody is signed in", async () => {
    document.cookie = "mooshala_lang=kannada; path=/";
    useAuthStore.getState().setSession(null);
    renderWithProviders(<EntryGate />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/role"));
  });

  it("sends a returning parent home", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.parentPhone);
    renderWithProviders(<EntryGate />, { services });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/parent"));
  });
});
