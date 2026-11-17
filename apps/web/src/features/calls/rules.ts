import type { CallSession, CallState, CallStudent, CallWindow } from "@mooshala/api-client";

/**
 * Call-mode rules from the web spec. Pure functions, shared by the console
 * and the fake backend so both apply the same numbers. The real backend
 * enforces them too; the console only uses them to explain and to disable
 * buttons, never to decide on the server's behalf.
 */
export const CALL_RULES = {
  /** the outer limits every window must sit inside (India time) */
  earliest: "09:00",
  latest: "21:00",
  defaultWindow: { start: "17:00", end: "19:00" } as CallWindow,
  /** Monday to Saturday (ISO weekdays) */
  allowedDays: [1, 2, 3, 4, 5, 6],
  minWindowMinutes: 30,
  weeklyCapMinutes: 15,
  retryAfterMinutes: 20,
  maxRetries: 2,
};

const IST_OFFSET_MS = 5.5 * 3600_000;

export function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "17:00" -> "5:00 pm" */
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// ---- phone -----------------------------------------------------------------------------------

/** Indian mobile numbers: ten digits starting 6 to 9, with or without +91 / 0. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

// ---- window and days ---------------------------------------------------------------------------

export type WindowProblem = "format" | "outsideHours" | "endBeforeStart" | "tooShort";

export function windowProblem(w: CallWindow): WindowProblem | null {
  const s = toMinutes(w.start);
  const e = toMinutes(w.end);
  if (s === null || e === null) return "format";
  if (e <= s) return "endBeforeStart";
  if (s < toMinutes(CALL_RULES.earliest)! || e > toMinutes(CALL_RULES.latest)!) return "outsideHours";
  if (e - s < CALL_RULES.minWindowMinutes) return "tooShort";
  return null;
}

export type DaysProblem = "noDays" | "sunday";

export function daysProblem(days: number[]): DaysProblem | null {
  if (!days.length) return "noDays";
  if (days.some((d) => !CALL_RULES.allowedDays.includes(d))) return "sunday";
  return null;
}

export interface CallStudentDraft {
  name: string;
  phone: string;
  language: "hindi" | "kannada";
  window: CallWindow;
  days: number[];
}

export type DraftField = "name" | "phone" | "window" | "days";
export type DraftProblem = "nameMissing" | "phoneInvalid" | WindowProblem | DaysProblem;

export function draftProblems(d: CallStudentDraft): Partial<Record<DraftField, DraftProblem>> {
  const out: Partial<Record<DraftField, DraftProblem>> = {};
  if (d.name.trim().length < 2) out.name = "nameMissing";
  if (!normalizePhone(d.phone)) out.phone = "phoneInvalid";
  const w = windowProblem(d.window);
  if (w) out.window = w;
  const days = daysProblem(d.days);
  if (days) out.days = days;
  return out;
}

// ---- time in India -------------------------------------------------------------------------------

/** ISO weekday (1 = Monday, 7 = Sunday) and minutes since midnight in India time. */
export function istParts(ms: number): { weekday: number; minutes: number } {
  const d = new Date(ms + IST_OFFSET_MS);
  const day = d.getUTCDay();
  return { weekday: day === 0 ? 7 : day, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** Start of the current India-time week (Monday 00:00 IST), in ms. */
export function weekStart(ms: number): number {
  const { weekday } = istParts(ms);
  const shifted = new Date(ms + IST_OFFSET_MS);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET_MS;
  return midnight - (weekday - 1) * 86400_000;
}

export function insideWindow(ms: number, w: CallWindow, days: number[]): boolean {
  const { weekday, minutes } = istParts(ms);
  const s = toMinutes(w.start);
  const e = toMinutes(w.end);
  if (s === null || e === null) return false;
  if (!days.includes(weekday) || !CALL_RULES.allowedDays.includes(weekday)) return false;
  if (minutes < toMinutes(CALL_RULES.earliest)! || minutes >= toMinutes(CALL_RULES.latest)!) return false;
  return minutes >= s && minutes < e;
}

// ---- cap and retries -----------------------------------------------------------------------------

export const minutesLeft = (used: number, cap = CALL_RULES.weeklyCapMinutes) => Math.max(0, cap - used);

/**
 * After an unanswered attempt: when to try again, or null when the student
 * becomes "not reachable" (first try plus two retries, 20 minutes apart).
 */
export function retryAt(attempt: number, endedAtMs: number): number | null {
  return attempt <= CALL_RULES.maxRetries ? endedAtMs + CALL_RULES.retryAfterMinutes * 60_000 : null;
}

// ---- call now ------------------------------------------------------------------------------------

export type CallBlock = "CALLS_PAUSED" | "CONSENT_PENDING" | "WEEKLY_CAP_REACHED" | "OUTSIDE_CALL_HOURS" | "CALL_IN_PROGRESS";

/** Why "Call now" can't go ahead (null when it can). Same order as the fake server. */
export function callBlock(
  s: Pick<CallStudent, "status" | "minutes_this_week" | "weekly_cap_minutes" | "window" | "days">,
  nowMs: number,
  live: boolean,
): CallBlock | null {
  if (live || s.status === "in_call") return "CALL_IN_PROGRESS";
  if (s.status === "paused") return "CALLS_PAUSED";
  if (s.status === "waiting_consent") return "CONSENT_PENDING";
  if (s.minutes_this_week >= s.weekly_cap_minutes) return "WEEKLY_CAP_REACHED";
  if (!insideWindow(nowMs, s.window, s.days)) return "OUTSIDE_CALL_HOURS";
  return null;
}

// ---- the call's own states ----------------------------------------------------------------------

export const LIVE_STATES: CallState[] = ["dialing", "ringing", "connected"];
export const isLive = (s: CallState | null | undefined) => Boolean(s && LIVE_STATES.includes(s));

/** A call only moves forward; a poll may skip a step it missed (dialing -> no_answer). */
const RANK: Record<CallState, number> = { dialing: 0, ringing: 1, connected: 2, completed: 3, no_answer: 3, failed: 3 };
const NEVER: [CallState, CallState][] = [["connected", "no_answer"]];

/** Whether the server's new state can follow what the console last showed. */
export const canMove = (from: CallState, to: CallState) =>
  from === to || (RANK[to] > RANK[from] && RANK[from] < 3 && !NEVER.some(([a, b]) => a === from && b === to));

/**
 * The call the console shows. It follows the server, never ahead of it: a
 * stale or out-of-order poll (e.g. "ringing" after "connected") is ignored.
 */
export function shownCall(previous: CallSession | null, incoming: CallSession): CallSession {
  if (!previous) return incoming;
  // A reply about an older call (e.g. a cached poll) never replaces the newer one.
  if (previous.id !== incoming.id) return Date.parse(incoming.started_at) >= Date.parse(previous.started_at) ? incoming : previous;
  return canMove(previous.state, incoming.state) ? incoming : previous;
}

/**
 * The reasons the console can know from the server's status alone. The time
 * window is left to the server (it owns the clock), which answers
 * OUTSIDE_CALL_HOURS when needed.
 */
export function statusBlock(s: Pick<CallStudent, "status" | "minutes_this_week" | "weekly_cap_minutes">, live: boolean): CallBlock | null {
  if (live || s.status === "in_call") return "CALL_IN_PROGRESS";
  if (s.status === "paused") return "CALLS_PAUSED";
  if (s.status === "waiting_consent") return "CONSENT_PENDING";
  if (s.minutes_this_week >= s.weekly_cap_minutes) return "WEEKLY_CAP_REACHED";
  return null;
}

/** ISO weekday -> message key. */
export const DAY_KEYS: Record<number, string> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
