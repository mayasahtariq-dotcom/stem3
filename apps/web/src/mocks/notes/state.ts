import type { ClassNote } from "@mooshala/api-client";
import { onFakeDbReset, registerFakeStore } from "../fake-db";
import { fakeNow } from "../learning/state";

type FakeNote = Omit<ClassNote, "classroom" | "teacher_name"> & { ownerId: string; teacherName: string };
let st: { notes: FakeNote[]; seq: number } = { notes: [], seq: 1 };

onFakeDbReset(() => {
  st = {
    notes: [
      {
        id: "note-1",
        ownerId: "u-ravi",
        teacherName: "Ravi Sir",
        classroom_id: "c-bio9a",
        title: "Cell: quick revision",
        body: "The cell is the basic unit of life.\n\n- Nucleus: controls the cell.\n- Ribosome: makes proteins.\n- Cell wall: found only in plant cells.\n- Cell membrane: lets some things in and out.",
        file: null,
        created_at: new Date(Date.UTC(2026, 10, 12, 9)).toISOString(),
      },
    ],
    seq: 2,
  };
});
registerFakeStore("notes", () => st, (v) => (st = v));

export const notesState = () => st;
export function addNote(n: Omit<FakeNote, "id" | "created_at">): FakeNote {
  const note = { ...n, id: `note-${st.seq++}`, created_at: new Date(fakeNow()).toISOString() };
  st.notes.unshift(note);
  return note;
}
