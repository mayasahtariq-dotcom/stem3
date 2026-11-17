"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The class the teacher is looking at, shared by the shell's switcher and every page. */
interface ClassState {
  classId: string;
  setClassId: (id: string) => void;
}

export const useClassStore = create<ClassState>()(
  persist((set) => ({ classId: "", setClassId: (classId) => set({ classId }) }), {
    name: "mooshala.teacherClass",
    storage: createJSONStorage(() => localStorage),
  }),
);

/** The selected class id, falling back to the first class the teacher has. */
export function pickClass(stored: string, classes: { id: string }[] | undefined): string {
  if (!classes?.length) return "";
  return classes.some((c) => c.id === stored) ? stored : classes[0]!.id;
}
