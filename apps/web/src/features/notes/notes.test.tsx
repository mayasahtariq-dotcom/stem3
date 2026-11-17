import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ClassNote } from "@mooshala/api-client";
import { DEMO } from "@/mocks/fake-db";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { noteProblem } from "./api";
import { StudentNotesRoute, TeacherNotesRoute } from "./routes";

beforeEach(() => resetAuthStore());

async function as(phone: string) {
  const s = makeTestServices();
  await signInAs(s, phone);
  return s;
}

describe("class notes", () => {
  it("checks the form: class, title, and some text or a file", () => {
    expect(noteProblem({ classId: "", title: "x", body: "y", file: null })).toBe("classMissing");
    expect(noteProblem({ classId: "c", title: " ", body: "y", file: null })).toBe("titleMissing");
    expect(noteProblem({ classId: "c", title: "x", body: " ", file: null })).toBe("contentMissing");
    expect(noteProblem({ classId: "c", title: "x", body: "", file: { size: 2_000_000 } })).toBe("fileTooBig");
    expect(noteProblem({ classId: "c", title: "x", body: "", file: { size: 1000 } })).toBeNull();
  });

  it("a teacher shares notes from the Notes page and a student in that class reads them", async () => {
    const ravi = await as(DEMO.teacherPhone);
    renderWithProviders(<TeacherNotesRoute />, { services: ravi });
    fireEvent.change(await screen.findByLabelText(/Title/), { target: { value: "Photosynthesis" } });
    fireEvent.change(screen.getByLabelText(/Notes \(type here\)/), { target: { value: "Plants make food from sunlight." } });
    fireEvent.click(screen.getByTestId("share-note"));
    await waitFor(async () => expect((await ravi.pending.get<ClassNote[]>("/teacher/notes")).map((n) => n.title)).toContain("Photosynthesis"));

    resetAuthStore();
    const asha = await as(DEMO.studentPhone);
    renderWithProviders(<StudentNotesRoute />, { services: asha });
    expect(await screen.findByText("Photosynthesis")).toBeInTheDocument();
    expect(screen.getByText("Plants make food from sunlight.")).toBeInTheDocument();
    expect(screen.getAllByText(/Ravi Sir · Class 9-A Science/)).toHaveLength(2);
  });

  it("only teachers can share, and students only see notes from their own classes", async () => {
    const asha = await as(DEMO.studentPhone);
    await expect(asha.pending.post(`/classrooms/c-bio9a/notes`, { title: "x", body: "y" })).rejects.toMatchObject({ status: 403 });
    resetAuthStore();
    const kiran = await as(DEMO.newPhone);
    expect(await kiran.pending.get<ClassNote[]>("/me/notes")).toEqual([]);
  });

  it("shows the empty state when there are no notes yet", async () => {
    const kiran = await as(DEMO.newPhone);
    renderWithProviders(<StudentNotesRoute />, { services: kiran });
    expect(await screen.findByText(/No notes yet/)).toBeInTheDocument();
  });
});
