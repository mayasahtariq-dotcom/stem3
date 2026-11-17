import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ClassInsights, TeacherOverview } from "@mooshala/api-client";
import { DEMO } from "@/mocks/fake-db";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { ClassesRoute } from "./routes";

beforeEach(() => resetAuthStore());

async function as(phone: string) {
  const s = makeTestServices();
  await signInAs(s, phone);
  return s;
}

describe("one connected platform (fake backend)", () => {
  it("teacher creates a class, a student joins with its code, and the teacher sees their work", async () => {
    const ravi = await as(DEMO.teacherPhone);
    const created = (await ravi.api.POST("/classrooms", { body: { name: "Class 8-B Science", subject: "BI", grade: 8, allowed_language_modes: ["hindi", "kannada"] } })).data!;
    expect(created.join_key).toMatch(/^BI08-[A-Z2-9]{4}$/);

    // A unique code each time.
    const second = (await ravi.api.POST("/classrooms", { body: { name: "Class 8-C Science", subject: "BI", grade: 8, allowed_language_modes: ["hindi"] } })).data!;
    expect(second.join_key).not.toBe(created.join_key);

    // Asha joins with the class code (not her parent link code).
    resetAuthStore();
    const asha = await as(DEMO.studentPhone);
    const joined = await asha.api.POST("/classrooms/join", { body: { key: created.join_key } });
    expect(joined.response.status).toBe(201);
    await asha.api.POST("/lessons/{lesson_id}/start", { params: { path: { lesson_id: "lesson-2" } } });
    await asha.api.POST("/attempts", { body: { question_id: "q-2-1", answer: { index: 0 }, retry: false, time_ms: 900 } });

    // The teacher sees her in the new class, with the question she missed.
    resetAuthStore();
    const ravi2 = await as(DEMO.teacherPhone);
    const dash = (await ravi2.api.GET("/classrooms/{classroom_id}/dashboard", { params: { path: { classroom_id: created.id } } })).data!;
    expect(dash.students.map((s) => s.name)).toEqual(["Asha"]);
    const ins = await ravi2.pending.get<ClassInsights>(`/classrooms/${created.id}/insights`);
    expect(ins.missed[0]?.question_id).toBe("q-2-1");
    const all = await ravi2.pending.get<TeacherOverview>("/teacher/overview");
    expect(all.classes.find((c) => c.id === created.id)?.student_count).toBe(1);
  });

  it("only teachers can create classes, and a class needs a name", async () => {
    const asha = await as(DEMO.studentPhone);
    await expect(asha.api.POST("/classrooms", { body: { name: "Mine", subject: "BI", grade: 8, allowed_language_modes: ["hindi"] } })).rejects.toMatchObject({ code: "NOT_A_TEACHER", status: 403 });
    resetAuthStore();
    const ravi = await as(DEMO.teacherPhone);
    await expect(ravi.api.POST("/classrooms", { body: { name: "  ", subject: "BI", grade: 8, allowed_language_modes: ["hindi"] } })).rejects.toMatchObject({ status: 422 });
  });

  it("the Classes screen creates a class and shows its join code", async () => {
    renderWithProviders(<ClassesRoute />, { services: await as(DEMO.teacherPhone) });
    fireEvent.click(await screen.findByTestId("new-class"));
    fireEvent.change(screen.getByLabelText(/Class name/), { target: { value: "Class 7-A Science" } });
    fireEvent.click(screen.getByTestId("create-class"));
    const dialog = await screen.findByRole("dialog", { name: /Class 7-A Science is ready/ });
    expect(within(dialog).getByTestId("class-join-code").textContent).toMatch(/^BI09-/);
    await waitFor(() => expect(screen.getAllByText("Class 7-A Science").length).toBeGreaterThan(0));
  });
});
