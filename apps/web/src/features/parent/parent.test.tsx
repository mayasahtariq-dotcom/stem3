import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DEMO, fakeDb } from "@/mocks/fake-db";
import { DEMO_CODES, mayStartLessons, parentState } from "@/mocks/parent/state";
import { teacherState } from "@/mocks/teacher/state";
import { router } from "@/test/navigation";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { normalizeCode } from "./api";
import { ParentLinkCard } from "./ParentLinkCard";
import { achievements, farmPicture } from "./progress-view";
import { ChildRoute, ParentHomeRoute } from "./routes";

beforeEach(resetAuthStore);

async function as(phone: string) {
  const services = makeTestServices();
  await signInAs(services, phone);
  return services;
}

/** Links Meena to Asha straight in the fake db (the UI flow has its own test). */
function linkMeena(consent = false) {
  parentState().links.push({ parentId: "u-meena", studentId: "u-asha", linkedAt: Date.now(), active: true, consentAt: consent ? Date.now() : null });
  if (consent) parentState().consent["u-asha"] = "approved";
}

describe("parent linking", () => {
  it("normalises typed codes", () => {
    expect(normalizeCode(" k7m-4px ")).toBe("K7M4PX");
  });

  it("explains a wrong or expired code, then previews and links the right child", async () => {
    renderWithProviders(<ParentHomeRoute />, { services: await as(DEMO.parentPhone), locale: "kn" });
    expect(await screen.findByText(/No child linked yet/)).toBeInTheDocument();
    const field = screen.getByTestId("link-code");
    fireEvent.change(field, { target: { value: "ZZZZZZ" } });
    expect(await screen.findByText(/We couldn't find that code/)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: DEMO_CODES.expired } });
    expect(await screen.findByText(/That code has expired/)).toBeInTheDocument();
    expect(screen.queryByTestId("link-preview")).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: DEMO_CODES.asha.toLowerCase() } });
    expect(await screen.findByTestId("link-preview")).toHaveTextContent("Asha");
    fireEvent.click(screen.getByTestId("confirm-link"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/parent/child/u-asha"));
    expect(parentState().links.some((l) => l.parentId === "u-meena" && l.studentId === "u-asha" && l.active)).toBe(true);
    expect(parentState().codes[DEMO_CODES.asha]!.usedAt).not.toBeNull();
  });

  it("refuses a third parent", async () => {
    renderWithProviders(<ParentHomeRoute />, { services: await as(DEMO.parentPhone) });
    fireEvent.change(await screen.findByTestId("link-code"), { target: { value: DEMO_CODES.full } });
    expect(await screen.findByTestId("link-preview")).toHaveTextContent("Bharat");
    fireEvent.click(screen.getByTestId("confirm-link"));
    expect(await screen.findByText(/already has two parents linked/)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("consent", () => {
  it("approving lets the child learn; pausing blocks lessons until approved again", async () => {
    teacherState().schoolConsent["c-bio9a"] = false;
    linkMeena();
    expect(mayStartLessons("u-asha")).toBe(false);
    renderWithProviders(<ChildRoute childId="u-asha" />, { services: await as(DEMO.parentPhone) });
    fireEvent.click(await screen.findByTestId("approve-consent"));
    await waitFor(() => expect(parentState().consent["u-asha"]).toBe("approved"));
    expect(mayStartLessons("u-asha")).toBe(true);
    fireEvent.click(await screen.findByTestId("revoke-consent"));
    fireEvent.click(await screen.findByTestId("confirm-action"));
    await waitFor(() => expect(parentState().consent["u-asha"]).toBe("revoked"));
    expect(mayStartLessons("u-asha")).toBe(false);
    expect(await screen.findByTestId("approve-consent")).toBeInTheDocument();
  });

  it("the lesson start endpoint answers CONSENT_REQUIRED when paused", async () => {
    parentState().consent["u-asha"] = "revoked";
    const services = await as(DEMO.studentPhone);
    await expect(services.api.POST("/lessons/{lesson_id}/start", { params: { path: { lesson_id: "lesson-2" } } })).rejects.toMatchObject({ code: "CONSENT_REQUIRED", status: 403 });
  });
});

describe("child dashboard", () => {
  it("shows the week, the spoken summary, support areas and the farm picture", async () => {
    linkMeena(true);
    renderWithProviders(<ChildRoute childId="u-asha" />, { services: await as(DEMO.parentPhone) });
    expect(await screen.findByText("This week in short")).toBeInTheDocument();
    expect(screen.getByText(/Asha finished 1 lessons this week/)).toBeInTheDocument();
    expect(screen.getByText(/Practise Mitochondria together/)).toBeInTheDocument();
    expect(screen.getByTestId("farm-picture")).toBeInTheDocument();
    expect(screen.getByText("The Cell")).toBeInTheDocument();
  });

  it("asks before requesting deletion and shows the date it completes by", async () => {
    linkMeena(true);
    renderWithProviders(<ChildRoute childId="u-asha" />, { services: await as(DEMO.parentPhone) });
    fireEvent.click(await screen.findByTestId("request-deletion"));
    expect(await screen.findByText("Delete all of your child's data?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-action"));
    expect(await screen.findByText(/Deletion requested/)).toBeInTheDocument();
    expect(parentState().deletions).toHaveLength(1);
    expect(screen.getByTestId("request-deletion")).toBeDisabled();
  });

  it("derives the farm picture and milestones only from dashboard numbers", () => {
    const week = { lessons_this_week: 9, lessons_last_week: 0, arrow: "up" as const, minutes_this_week: 40, streak: 3 };
    expect(farmPicture({ week, accuracy: { this_week: 0.9, last_week: null, word: "improving" } })).toEqual({ crops: 7, flowers: 3, plant: "growing" });
    const a = achievements({ week, accuracy: { this_week: 0.9, last_week: null, word: "improving" }, assignments: [], child: { id: "x", name: "x", consent_status: "approved", consent_given_by_me: true, classes: [] }, has_activity: true, subjects: [], classes: [], summary: {} });
    expect(a.filter((x) => x.earned).map((x) => x.key)).toEqual(["streak3", "lessons3", "accuracy80"]);
  });
});

describe("student side", () => {
  it("makes a one-time link code and lists linked parents", async () => {
    linkMeena(true);
    renderWithProviders(<ParentLinkCard />, { services: await as(DEMO.studentPhone) });
    expect(await screen.findByText("Meena")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("make-link-code"));
    const code = await screen.findByTestId("my-link-code");
    expect(code.textContent).toMatch(/^[A-Z2-9]{6}$/);
    expect(parentState().codes[code.textContent!]!.studentId).toBe("u-asha");
    expect(fakeDb()).toBeTruthy();
  });
});
