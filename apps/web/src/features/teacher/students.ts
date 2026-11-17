import type { Schemas } from "@mooshala/api-client";

/** Who needs the teacher's attention first: overdue work, low accuracy, then long idle. */
export function needsHelp(rows: Schemas["StudentRow"][]): Schemas["StudentRow"][] {
  const score = (s: Schemas["StudentRow"]) => s.overdue * 3 + (s.accuracy !== null && s.accuracy < 0.6 ? 2 : 0) + (s.idle ? 1 + s.idle_days / 30 : 0);
  return rows.filter((s) => s.behind || s.idle).sort((a, b) => score(b) - score(a));
}

export type StudentFilter = "all" | "help";
export type StudentSort = "name" | "accuracy" | "streak";

export function filterStudents(rows: Schemas["StudentRow"][], filter: StudentFilter, query: string, sort: StudentSort): Schemas["StudentRow"][] {
  const q = query.trim().toLowerCase();
  const base = filter === "help" ? needsHelp(rows) : rows;
  const found = base.filter((s) => !q || s.name.toLowerCase().includes(q));
  if (filter === "help" && sort === "name") return found;
  return [...found].sort((a, b) =>
    sort === "accuracy" ? (a.accuracy ?? -1) - (b.accuracy ?? -1) : sort === "streak" ? b.streak - a.streak : a.name.localeCompare(b.name),
  );
}
