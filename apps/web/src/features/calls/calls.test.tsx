import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { callsState, setDemoClock } from "@/mocks/calls/state";
import { DEMO } from "@/mocks/fake-db";
import { fakeNow, setFakeClock } from "@/mocks/learning/state";
import { router } from "@/test/navigation";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { AddCallStudentRoute, CallsRoute } from "./routes";

let now = 0;
beforeEach(() => {
  resetAuthStore();
  // The next 6 pm India time on a calling day, then a controllable clock from there.
  setDemoClock("evening");
  now = fakeNow();
  setFakeClock(() => now);
  // Keep Sunil's 15 minutes inside the (demo) week.
  callsState().students.find((s) => s.id === "cs-sunil")!.calls[0]!.startedAt = now - 3600_000;
  callsState().students.find((s) => s.id === "cs-lakshmi")!.calls[0]!.startedAt = now - 3600_000;
});
afterEach(() => setDemoClock("real"));

async function asRavi() {
  const services = makeTestServices();
  await signInAs(services, DEMO.teacherPhone);
  return services;
}
const tick = async (ms: number) => {
  await act(async () => {
    now += ms;
  });
};
const panel = () => screen.getByTestId("call-panel");

describe("call console", () => {
  it("lists phone students with their status and locks Call now when it can't go ahead", async () => {
    renderWithProviders(<CallsRoute />, { services: await asRavi() });
    const raju = await screen.findByTestId("call-student-cs-raju");
    expect(within(raju).getByText("सहमति का इंतज़ार")).toBeInTheDocument();
    expect(within(screen.getByTestId("call-student-cs-meera")).getByText("संपर्क नहीं हो सका")).toBeInTheDocument();
    expect(within(screen.getByTestId("call-student-cs-sunil")).getByText("15 of 15 minutes this week")).toBeInTheDocument();
    fireEvent.click(raju);
    expect(screen.getByTestId("call-now")).toBeDisabled();
    fireEvent.click(screen.getByTestId("call-student-cs-sunil"));
    expect(screen.getByTestId("call-now")).toBeDisabled();
  });

  it("shows 'connected' only after the server says so, and starts one call for a double tap", async () => {
    renderWithProviders(<CallsRoute />, { services: await asRavi() });
    fireEvent.click(await screen.findByTestId("call-student-cs-lakshmi"));
    const btn = screen.getByTestId("call-now");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "dialing"));
    expect(screen.queryByText(/Connected/)).not.toBeInTheDocument();
    expect(screen.getByTestId("call-now")).toBeDisabled();
    await tick(3000);
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "ringing"), { timeout: 3000 });
    expect(screen.queryByText(/Connected/)).not.toBeInTheDocument();
    await tick(3000);
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "connected"), { timeout: 3000 });
    expect(screen.getByText(/Connected. The lesson is playing./)).toBeInTheDocument();
    await tick(15_000);
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "completed"), { timeout: 3000 });
    const lakshmi = callsState().students.find((s) => s.id === "cs-lakshmi")!;
    expect(lakshmi.calls).toHaveLength(2);
    expect(await within(screen.getByTestId("call-student-cs-lakshmi")).findByText("6 of 15 minutes this week")).toBeInTheDocument();
  });

  it("refuses calls outside the student's hours", async () => {
    renderWithProviders(<CallsRoute />, { services: await asRavi() });
    fireEvent.click(await screen.findByTestId("call-student-cs-lakshmi"));
    await tick(3.5 * 3600_000); // 9:30 pm
    fireEvent.click(screen.getByTestId("call-now"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Calls can only be made between 9 am and 9 pm.");
    expect(callsState().students.find((s) => s.id === "cs-lakshmi")!.calls).toHaveLength(1);
  });

  it("an unanswered call is retried after 20 minutes", async () => {
    renderWithProviders(<CallsRoute />, { services: await asRavi() });
    fireEvent.click(await screen.findByTestId("call-student-cs-meera"));
    fireEvent.click(screen.getByTestId("call-now"));
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "dialing"));
    await tick(6000);
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "no_answer"), { timeout: 3000 });
    expect(await within(screen.getByTestId("call-student-cs-meera")).findByText("फिर कोशिश होगी")).toBeInTheDocument();
    await tick(20 * 60_000);
    const meera = callsState().students.find((s) => s.id === "cs-meera")!;
    const { settle } = await import("@/mocks/calls/state");
    settle(meera);
    expect(meera.calls.at(-1)!.attempt).toBe(2);
  });

  it("pauses and resumes a student's calls", async () => {
    renderWithProviders(<CallsRoute />, { services: await asRavi() });
    fireEvent.click(await screen.findByTestId("call-student-cs-lakshmi"));
    fireEvent.click(screen.getByTestId("toggle-pause"));
    expect(await within(screen.getByTestId("call-student-cs-lakshmi")).findByText("रुका हुआ")).toBeInTheDocument();
    expect(screen.getByTestId("call-now")).toBeDisabled();
    fireEvent.click(screen.getByTestId("toggle-pause"));
    await waitFor(() => expect(screen.getByTestId("call-now")).toBeEnabled());
  });
});

describe("add a student without the app", () => {
  const fill = (name: string, phone: string) => {
    fireEvent.change(screen.getByTestId("cs-name"), { target: { value: name } });
    fireEvent.change(screen.getByTestId("cs-phone"), { target: { value: phone } });
  };

  it("validates, refuses a duplicate phone, confirms, then saves", async () => {
    renderWithProviders(<AddCallStudentRoute />, { services: await asRavi() });
    await screen.findByTestId("cs-name");
    await waitFor(() => expect(screen.getByText(/as part of Class 9-A Science/)).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("cs-end"), { target: { value: "21:30" } });
    fireEvent.click(screen.getByTestId("cs-next"));
    expect(screen.getByText("Please write the student's name.")).toBeInTheDocument();
    expect(screen.getByText(/Enter a 10-digit mobile number/)).toBeInTheDocument();
    expect(screen.getByText(/Calls must be between 9 am and 9 pm./)).toBeInTheDocument();
    expect(screen.queryByTestId("cs-confirm")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("cs-end"), { target: { value: "19:00" } });
    fill("Kiran", "98450 11111"); // Lakshmi's parent's number
    fireEvent.click(screen.getByTestId("cs-next"));
    expect(screen.getByTestId("cs-confirm")).toHaveTextContent("+919845011111");
    fireEvent.click(screen.getByTestId("cs-confirm-save"));
    expect(await screen.findByText("A student with this phone number is already in this class.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    fill("Kiran", "9845055555");
    fireEvent.click(screen.getByTestId("cs-next"));
    fireEvent.click(screen.getByTestId("cs-confirm-save"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/teacher/calls"));
    const kiran = callsState().students.find((s) => s.name === "Kiran")!;
    expect(kiran).toMatchObject({ phone: "+919845055555", window: { start: "17:00", end: "19:00" }, days: [1, 2, 3, 4, 5, 6], consentAt: null });
  });
});
