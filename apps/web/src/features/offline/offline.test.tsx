import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { DEMO } from "@/mocks/fake-db";
import { learner } from "@/mocks/learning/state";
import { server } from "@/mocks/node";
import { FAKE_API_BASE_URL } from "@/lib/env";
import { flushOutbox, useOutbox, type OutboxItem } from "@/lib/offline/outbox";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { LessonRoute } from "@/features/learning/LessonRoute";
import { useLessonSessions } from "@/features/learning/session-store";
import { OfflineBanner } from "./OfflineBanner";

let online = true;
function setOnline(v: boolean) {
  online = v;
  act(() => {
    window.dispatchEvent(new Event(v ? "online" : "offline"));
  });
}

beforeAll(() => {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
});
beforeEach(() => {
  online = true;
  resetAuthStore();
  useLessonSessions.setState({ sessions: {} });
  useOutbox.setState({ items: [], dropped: 0, lastSyncedAt: null });
});

async function signedInApi() {
  const services = makeTestServices();
  await signInAs(services, DEMO.studentPhone);
  await services.api.POST("/lessons/{lesson_id}/start", { params: { path: { lesson_id: "lesson-2" } } });
  return services;
}

const attempt = (id: string, questionId: string, answer: Record<string, unknown>, userId = "u-asha"): OutboxItem => ({
  id,
  userId,
  kind: "attempt",
  lessonId: "lesson-2",
  body: { question_id: questionId, answer, retry: false, time_ms: 1000 },
  createdAt: 1,
});

describe("offline outbox", () => {
  it("never pays XP twice when the same saved answer is sent again", async () => {
    const { api } = await signedInApi();
    const before = learner("u-asha").xpTotal;
    useOutbox.setState({ items: [attempt("k-1", "q-2-1", { index: 1 })] });
    const first = await flushOutbox(api, "u-asha");
    expect(first).toMatchObject({ sent: 1, dropped: 0, stopped: false });
    expect(learner("u-asha").xpTotal).toBe(before + 10);
    expect(useOutbox.getState().items).toHaveLength(0);

    // The response was lost and the phone sends the same item again.
    useOutbox.setState({ items: [attempt("k-1", "q-2-1", { index: 1 })] });
    await flushOutbox(api, "u-asha");
    expect(learner("u-asha").xpTotal).toBe(before + 10);
    expect(learner("u-asha").attempts.filter((a) => a.questionId === "q-2-1")).toHaveLength(1);
  });

  it("never pays the lesson bonus twice for a replayed completion", async () => {
    const { api } = await signedInApi();
    const done: OutboxItem = { id: "c-1", userId: "u-asha", kind: "complete", lessonId: "lesson-2", createdAt: 1 };
    useOutbox.setState({ items: [done] });
    await flushOutbox(api, "u-asha");
    const after = learner("u-asha").xpTotal;
    useOutbox.setState({ items: [done] });
    await flushOutbox(api, "u-asha");
    expect(learner("u-asha").xpTotal).toBe(after);
  });

  it("keeps items when the network fails, in order, and stops", async () => {
    const { api } = await signedInApi();
    server.use(http.post(`${FAKE_API_BASE_URL}/attempts`, () => HttpResponse.error()));
    useOutbox.setState({ items: [attempt("a", "q-2-1", { index: 1 }), attempt("b", "q-2-3", { index: 0 })] });
    const r = await flushOutbox(api, "u-asha");
    expect(r).toMatchObject({ sent: 0, stopped: true });
    expect(useOutbox.getState().items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("drops an item the server refuses for good, and counts it", async () => {
    const { api } = await signedInApi();
    useOutbox.setState({ items: [attempt("x", "no-such-question", { index: 0 }), attempt("y", "q-2-1", { index: 1 })] });
    const r = await flushOutbox(api, "u-asha");
    expect(r).toMatchObject({ sent: 1, dropped: 1, stopped: false });
    expect(useOutbox.getState().dropped).toBe(1);
  });

  it("never sends another student's saved answers (shared school computer)", async () => {
    const { api } = await signedInApi();
    useOutbox.setState({ items: [attempt("other", "q-2-1", { index: 1 }, "u-ravi-student")] });
    const r = await flushOutbox(api, "u-asha");
    expect(r.sent).toBe(0);
    expect(useOutbox.getState().items).toHaveLength(1);
  });
});

describe("playing a lesson offline", () => {
  it("saves answers on the phone, then the server grades them once when back online", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(
      <>
        <OfflineBanner />
        <LessonRoute lessonId="lesson-2" />
      </>,
      { services },
    );
    await screen.findByText("Which part controls the cell?");
    const before = learner("u-asha").xpTotal;

    setOnline(false);
    expect(await screen.findByTestId("offline-banner")).toHaveAttribute("data-state", "offline");
    fireEvent.click(screen.getByRole("button", { name: /Nucleus/ }));
    fireEvent.click(screen.getByTestId("check-answer"));
    const sheet = await screen.findByTestId("feedback-sheet");
    expect(sheet).toHaveAttribute("data-queued", "true");
    expect(within(sheet).getByText("Saved on this phone")).toBeInTheDocument();
    expect(screen.queryByText(/Not quite/)).not.toBeInTheDocument();
    expect(learner("u-asha").xpTotal).toBe(before);
    expect(useOutbox.getState().items).toHaveLength(1);
    expect(await screen.findByText(/1 saved on this phone/)).toBeInTheDocument();

    setOnline(true);
    await waitFor(() => expect(useOutbox.getState().items).toHaveLength(0));
    expect(learner("u-asha").xpTotal).toBe(before + 10);
    await waitFor(() => expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument());
  });

  it("finishes a lesson offline and gets its rewards after sync", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(
      <>
        <OfflineBanner />
        <LessonRoute lessonId="lesson-2" />
      </>,
      { services },
    );
    await screen.findByText("Which part controls the cell?");
    const streak = learner("u-asha").streak;
    setOnline(false);
    for (let i = 0; i < 12 && !screen.queryByTestId("lesson-done-offline"); i++) {
      const cont = screen.queryByTestId("feedback-continue");
      if (cont) {
        fireEvent.click(cont);
        continue;
      }
      if (screen.queryByTestId("match-right-0")) {
        const lefts = within(screen.getByRole("list", { name: "Parts" })).getAllByRole("button");
        lefts.forEach((b, k) => {
          fireEvent.click(b);
          fireEvent.click(screen.getByTestId(`match-right-${k}`));
        });
      } else {
        fireEvent.click(within(screen.getByRole("radiogroup")).getAllByRole("button")[0]!);
        fireEvent.click(screen.getByTestId("check-answer"));
      }
      await waitFor(() => expect(screen.queryByTestId("feedback-continue") ?? screen.queryByTestId("lesson-done-offline")).toBeTruthy());
    }
    expect(await screen.findByTestId("lesson-done-offline")).toBeInTheDocument();
    const items = useOutbox.getState().items;
    expect(items.at(-1)?.kind).toBe("complete");
    const asked = items.flatMap((i) => (i.kind === "attempt" ? [i.body.question_id] : []));
    // One saved answer per question: offline answers are never queued as retries.
    expect(new Set(asked).size).toBe(asked.length);
    expect(asked.length).toBeGreaterThanOrEqual(4);

    setOnline(true);
    await waitFor(() => expect(useOutbox.getState().items).toHaveLength(0));
    expect(learner("u-asha").progress.get("lesson-2")?.completedAt).toBeTruthy();
    expect(learner("u-asha").streak).toBe(streak + 1);
  });
});
