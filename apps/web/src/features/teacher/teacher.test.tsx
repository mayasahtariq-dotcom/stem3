import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useToastStore } from "@/components/ui";
import { DEMO } from "@/mocks/fake-db";
import { fakeLessons, setFakeClock } from "@/mocks/learning/state";
import { STEP_MS, teacherState } from "@/mocks/teacher/state";
import { router } from "@/test/navigation";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { CourseDetailRoute, LessonReviewRoute, OverviewRoute, StudentsRoute, UploadRoute } from "./routes";

beforeEach(() => {
  resetAuthStore();
  useToastStore.setState({ items: [] });
});
afterEach(() => setFakeClock(() => Date.now()));

async function asRavi() {
  const services = makeTestServices();
  await signInAs(services, DEMO.teacherPhone);
  return services;
}

describe("teacher overview", () => {
  it("shows this week's tiles, who needs help and weak topics from the dashboard", async () => {
    renderWithProviders(<OverviewRoute />, { services: await asRavi() });
    expect(await screen.findByText("Active this week")).toBeInTheDocument();
    expect(screen.getAllByText("Class 9-A Science").length).toBeGreaterThan(0);
    expect(screen.getByTestId("join-key")).toHaveTextContent(DEMO.validKey);
    // Dev (overdue, low accuracy) is listed before the idle students.
    const help = screen.getByText("Needs help").closest("div")!;
    const names = within(help).getAllByRole("button").map((b) => b.textContent);
    expect(names[0]).toContain("Dev");
    expect(screen.getAllByText("Mitochondria").length).toBeGreaterThan(0);
    fireEvent.click(within(help).getAllByRole("button")[0]!);
    expect(router.push).toHaveBeenCalledWith("/teacher/students/s-dev");
  });

  it("turns school consent off on the server", async () => {
    renderWithProviders(<OverviewRoute />, { services: await asRavi() });
    const toggle = await screen.findByTestId("school-consent");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(teacherState().schoolConsent["c-bio9a"]).toBe(false));
    await waitFor(() => expect(screen.getByTestId("school-consent")).toHaveAttribute("aria-pressed", "false"));
  });
});

describe("students list", () => {
  it("filters to students who need help and searches by name", async () => {
    renderWithProviders(<StudentsRoute />, { services: await asRavi() });
    expect(await screen.findByRole("button", { name: "Asha" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Needs help/ }));
    expect(screen.queryByRole("button", { name: "Bharat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Farhan" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Everyone/ }));
    fireEvent.change(screen.getByLabelText(/Search by name/), { target: { value: "zz" } });
    expect(screen.getByText("No student matches.")).toBeInTheDocument();
  });
});

describe("lesson review", () => {
  it("approves flagged questions, then publishes once", async () => {
    renderWithProviders(<LessonReviewRoute courseId="course-tissues" lessonId="tis-l1" />, { services: await asRavi() });
    const publish = await screen.findByTestId("publish-lesson");
    expect(publish).toBeDisabled();
    expect(screen.getByText(/2 questions need your check/)).toBeInTheDocument();
    for (const id of ["tis-q1-2", "tis-q1-4"]) {
      fireEvent.click(within(screen.getByTestId(`question-${id}`)).getByTestId("approve-question"));
      await waitFor(() => expect(within(screen.getByTestId(`question-${id}`)).queryByTestId("approve-question")).not.toBeInTheDocument());
    }
    expect(screen.getByTestId("publish-lesson")).toBeEnabled();
    fireEvent.click(screen.getByTestId("publish-lesson"));
    fireEvent.click(screen.getByTestId("publish-lesson")); // a double tap doesn't publish twice
    expect(await screen.findByText("This lesson is live for your students.")).toBeInTheDocument();
    expect(screen.queryByTestId("publish-lesson")).not.toBeInTheDocument();
    expect(fakeLessons("course-tissues")[0]!.published).toBe(true);
    expect(teacherState().courses.find((c) => c.id === "course-tissues")!.assigned).toHaveProperty("c-bio9a");
  });

  it("edits a question; the edit is what students get", async () => {
    renderWithProviders(<LessonReviewRoute courseId="course-tissues" lessonId="tis-l1" />, { services: await asRavi() });
    const card = await screen.findByTestId("question-tis-q1-1");
    fireEvent.click(within(card).getByTestId("edit-question"));
    const prompt = within(card).getByLabelText("प्रश्न (en)");
    fireEvent.change(prompt, { target: { value: "" } });
    expect(within(card).getByRole("alert")).toHaveTextContent("Write the question in English.");
    expect(within(card).getByTestId("save-question")).toBeDisabled();
    fireEvent.change(prompt, { target: { value: "Which part is the boss of the cell?" } });
    fireEvent.click(within(card).getByTestId("save-question"));
    expect(await within(card).findByText("Which part is the boss of the cell?")).toBeInTheDocument();
    expect(within(card).getByText("आपने बदला")).toBeInTheDocument();
    expect((fakeLessons("course-tissues")[0]!.questions[0]!.content.prompt as { en: string }).en).toBe("Which part is the boss of the cell?");
  });

  it("asks before removing a question", async () => {
    renderWithProviders(<LessonReviewRoute courseId="course-tissues" lessonId="tis-l1" />, { services: await asRavi() });
    const card = await screen.findByTestId("question-tis-q1-3");
    fireEvent.click(within(card).getByTestId("reject-question"));
    fireEvent.click(await screen.findByTestId("confirm-reject"));
    await waitFor(() => expect(screen.queryByTestId("question-tis-q1-3")).not.toBeInTheDocument());
    expect(fakeLessons("course-tissues")[0]!.questions.some((q) => q.id === "tis-q1-3")).toBe(false);
  });
});

describe("course detail", () => {
  it("assigns the course to a class with a due date", async () => {
    renderWithProviders(<CourseDetailRoute courseId="course-tissues" />, { services: await asRavi() });
    expect(await screen.findByText("Not assigned to a class yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("assign-course"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Class 9-A Science" }));
    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByTestId("confirm-assign"));
    expect(await screen.findByText(/Assigned to Class 9-A Science/)).toBeInTheDocument();
    expect(teacherState().courses.find((c) => c.id === "course-tissues")!.assigned["c-bio9a"]).toBe("2026-12-01T18:29:00.000Z");
  });
});

describe("upload", () => {
  it("uploads pages with progress, retries a failed page, then follows the AI steps to a course", async () => {
    let now = Date.now();
    setFakeClock(() => now);
    renderWithProviders(<UploadRoute />, { services: await asRavi() });
    const input = await screen.findByTestId("file-input");
    const bad = new File(["FAIL-bytes-of-a-photo"], "page1.jpg", { type: "image/jpeg" });
    const big = new File(["x"], "huge.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [bad, big] } });
    expect(screen.getByText("सिर्फ़ JPG या PDF")).toBeInTheDocument();
    expect(screen.getByTestId("start-upload")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove page 2" }));
    fireEvent.change(screen.getByTestId("typed-notes"), { target: { value: "Plant cells have a wall." } });
    fireEvent.click(screen.getByRole("button", { name: /Add as a page/ }));
    fireEvent.click(screen.getByTestId("start-upload"));

    // The fake storage fails the first PUT of a "FAIL" file: the page offers a retry.
    const retry = await screen.findByTestId("retry-page-0");
    expect(screen.getByTestId("page-progress-1")).toHaveAttribute("data-state", "done");
    fireEvent.click(retry);
    expect(await screen.findByTestId("pipeline-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("review-new-course")).not.toBeInTheDocument();

    await act(async () => {
      now += STEP_MS * 7;
    });
    const review = await screen.findByTestId("review-new-course", {}, { timeout: 3000 });
    const course = teacherState().courses.at(-1)!;
    expect(review).toHaveAttribute("href", `/teacher/courses/${course.id}/lessons/${course.id}-l1`);
    expect(course.status).toBe("draft");
  });

  it("shows the pipeline failure and lets the teacher start over", async () => {
    let now = Date.now();
    setFakeClock(() => now);
    renderWithProviders(<UploadRoute />, { services: await asRavi() });
    fireEvent.change(await screen.findByTestId("typed-notes"), { target: { value: "please fail" } });
    fireEvent.click(screen.getByRole("button", { name: /Add as a page/ }));
    fireEvent.click(screen.getByTestId("start-upload"));
    await screen.findByTestId("pipeline-steps");
    await act(async () => {
      now += STEP_MS * 2;
    });
    expect(await screen.findByText("No readable text found in the notes.", {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try different pages/ }));
    expect(screen.getByTestId("start-upload")).toBeInTheDocument();
  });
});
