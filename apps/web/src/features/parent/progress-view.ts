import type { Schemas } from "@mooshala/api-client";

/**
 * The parent's supplementary "farm" picture, derived only from the dashboard
 * numbers (no invented data): one crop per lesson this week, flowers for the
 * streak, and the plant's look from the accuracy word.
 */
export interface FarmPicture {
  crops: number;
  flowers: number;
  plant: "growing" | "steady" | "thirsty";
}

export function farmPicture(d: Pick<Schemas["ChildDashboard"], "week" | "accuracy">): FarmPicture {
  return {
    crops: Math.min(7, d.week.lessons_this_week),
    flowers: Math.min(7, d.week.streak),
    plant: d.accuracy.word === "improving" ? "growing" : d.accuracy.word === "needs_practice" ? "thirsty" : "steady",
  };
}

export type Achievement = { key: "streak3" | "streak7" | "lessons3" | "accuracy80" | "allDone"; earned: boolean };

/** Small milestones a parent can celebrate, each read straight off the dashboard. */
export function achievements(d: Schemas["ChildDashboard"]): Achievement[] {
  return [
    { key: "streak3", earned: d.week.streak >= 3 },
    { key: "streak7", earned: d.week.streak >= 7 },
    { key: "lessons3", earned: d.week.lessons_this_week >= 3 },
    { key: "accuracy80", earned: (d.accuracy.this_week ?? 0) >= 0.8 },
    { key: "allDone", earned: d.assignments.length > 0 && d.assignments.every((a) => a.status === "done") },
  ];
}

export const consentTone = (status: string) => (status === "approved" ? "good" : status === "revoked" ? "warn" : "info");
