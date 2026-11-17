import type { CallSession, CallState, CallStudent, CallStudentStatus, CallTwin, CallWindow } from "@mooshala/api-client";
import { CALL_RULES, insideWindow, istParts, retryAt, toMinutes, weekStart } from "@/features/calls/rules";
import { onFakeDbReset, registerFakeStore } from "../fake-db";
import { fakeNow, setFakeClock } from "../learning/state";

/**
 * MOCK ONLY: call mode. The backend has no call-student endpoints yet
 * (contract: packages/api-client/src/pending-calls.ts). This fake plays the
 * part of the backend and Exotel: a call dials, rings, then connects or goes
 * unanswered, all on the fake clock, so the console can be shown honestly
 * (it only ever displays what this "server" reports).
 *
 * Demo conventions:
 * - a parent phone ending in 0 never answers (to show retries and "not reachable");
 * - a new student's parent "replies to the consent SMS" one minute after being added;
 * - a connected call lasts CONNECTED_MS and bills BILLED_MINUTES.
 */
export const CALL_TIMING = { dialMs: 2_000, ringMs: 3_000, connectedMs: 12_000, billedMinutes: 2, consentReplyMs: 60_000 };

export interface FakeCall {
  id: string;
  startedAt: number;
  attempt: number;
  noAnswer: boolean;
}

export interface FakeCallStudent {
  id: string;
  classroomId: string;
  name: string;
  phone: string;
  language: "hindi" | "kannada";
  window: CallWindow;
  days: number[];
  paused: boolean;
  consentAt: number | null;
  consentDueAt: number | null;
  createdAt: number;
  calls: FakeCall[];
  /** minutes billed per call id (completed calls) */
  billed: Record<string, number>;
}

interface CallsState {
  students: FakeCallStudent[];
  seq: number;
  /** demo-only offset applied to the fake clock ("pretend it's 6 pm") */
  clockOffsetMs: number;
}

let st: CallsState;

function applyClock() {
  if (st.clockOffsetMs) {
    const offset = st.clockOffsetMs;
    setFakeClock(() => Date.now() + offset);
  }
}

onFakeDbReset(() => {
  const now = Date.now();
  const wk = weekStart(now);
  const inWeek = wk + Math.min(3600_000, Math.floor((now - wk) / 2));
  const base = { classroomId: "c-bio9a", window: { ...CALL_RULES.defaultWindow }, days: [...CALL_RULES.allowedDays], paused: false, consentDueAt: null, createdAt: now - 7 * 86400_000, billed: {} };
  st = {
    seq: 1,
    clockOffsetMs: 0,
    students: [
      { ...base, id: "cs-lakshmi", name: "Lakshmi", phone: "+919845011111", language: "hindi", consentAt: now - 6 * 86400_000, calls: [{ id: "call-l1", startedAt: inWeek, attempt: 1, noAnswer: false }], billed: { "call-l1": 4 } },
      { ...base, id: "cs-raju", name: "Raju", phone: "+919845022222", language: "kannada", consentAt: null, calls: [] },
      {
        ...base,
        id: "cs-meera",
        name: "Meera",
        phone: "+919845033330",
        language: "kannada",
        consentAt: now - 6 * 86400_000,
        calls: [1, 2, 3].map((attempt) => ({ id: `call-m${attempt}`, startedAt: now - 86400_000 + (attempt - 1) * 20 * 60_000, attempt, noAnswer: true })),
      },
      { ...base, id: "cs-sunil", name: "Sunil", phone: "+919845044444", language: "hindi", consentAt: now - 6 * 86400_000, calls: [{ id: "call-s1", startedAt: inWeek, attempt: 1, noAnswer: false }], billed: { "call-s1": 15 } },
    ],
  };
});

registerFakeStore("calls", () => st, (v) => {
  st = v;
  applyClock();
});

export const callsState = () => st;
export const nextCallId = (p: string) => `${p}-${st.seq++}`;

/** Demo-only: move the fake clock to the next 6 pm India time on a calling day, or back to real time. */
export function setDemoClock(preset: "evening" | "real") {
  if (preset === "real") {
    st.clockOffsetMs = 0;
    setFakeClock(() => Date.now());
    return;
  }
  const now = Date.now();
  let target = now;
  for (let i = 0; i < 8; i++) {
    const day = now + i * 86400_000;
    const { weekday, minutes } = istParts(day);
    const at = day - minutes * 60_000 + 18 * 60 * 60_000;
    if (weekday <= 6 && at >= now - 60 * 60_000) {
      target = at;
      break;
    }
  }
  st.clockOffsetMs = target - now;
  applyClock();
}

// ---- derived state --------------------------------------------------------------------------------

export function callState(c: FakeCall, now: number): { state: CallState; connectedAt: number | null; endedAt: number | null } {
  const t = now - c.startedAt;
  const { dialMs, ringMs, connectedMs } = CALL_TIMING;
  if (t < dialMs) return { state: "dialing", connectedAt: null, endedAt: null };
  if (t < dialMs + ringMs) return { state: "ringing", connectedAt: null, endedAt: null };
  if (c.noAnswer) return { state: "no_answer", connectedAt: null, endedAt: c.startedAt + dialMs + ringMs };
  const connectedAt = c.startedAt + dialMs + ringMs;
  if (t < dialMs + ringMs + connectedMs) return { state: "connected", connectedAt, endedAt: null };
  return { state: "completed", connectedAt, endedAt: connectedAt + connectedMs };
}

const noAnswerFor = (phone: string) => phone.endsWith("0");

/** Runs what the backend's scheduler would have done by now: consent replies, bills, automatic retries. */
export function settle(s: FakeCallStudent) {
  const now = fakeNow();
  if (s.consentAt === null && s.consentDueAt !== null && now >= s.consentDueAt) s.consentAt = s.consentDueAt;
  for (let guard = 0; guard < 5; guard++) {
    const last = s.calls.at(-1);
    if (!last) break;
    const cs = callState(last, now);
    if (cs.state === "completed" && s.billed[last.id] === undefined) s.billed[last.id] = CALL_TIMING.billedMinutes;
    if (cs.state !== "no_answer" || s.paused) break;
    const next = retryAt(last.attempt, cs.endedAt!);
    if (next === null || next > now || !insideWindow(next, s.window, s.days)) break;
    s.calls.push({ id: nextCallId("call"), startedAt: next, attempt: last.attempt + 1, noAnswer: noAnswerFor(s.phone) });
  }
}

export function minutesThisWeek(s: FakeCallStudent, now = fakeNow()): number {
  const wk = weekStart(now);
  return s.calls.filter((c) => c.startedAt >= wk).reduce((n, c) => n + (s.billed[c.id] ?? 0), 0);
}

function nextWindowStart(s: FakeCallStudent, now: number): number | null {
  const start = toMinutes(s.window.start)!;
  for (let i = 0; i < 8; i++) {
    const day = now + i * 86400_000;
    const { weekday, minutes } = istParts(day);
    const at = day - minutes * 60_000 + start * 60_000;
    if (s.days.includes(weekday) && at > now) return Math.floor(at / 60_000) * 60_000;
  }
  return null;
}

export function studentStatus(s: FakeCallStudent): { status: CallStudentStatus; next: number | null } {
  const now = fakeNow();
  const last = s.calls.at(-1);
  const lastState = last ? callState(last, now) : null;
  if (lastState && ["dialing", "ringing", "connected"].includes(lastState.state)) return { status: "in_call", next: null };
  if (s.paused) return { status: "paused", next: null };
  if (s.consentAt === null) return { status: "waiting_consent", next: null };
  if (minutesThisWeek(s, now) >= CALL_RULES.weeklyCapMinutes) return { status: "cap_reached", next: weekStart(now) + 7 * 86400_000 };
  if (last && lastState?.state === "no_answer") {
    const next = retryAt(last.attempt, lastState.endedAt!);
    return next === null ? { status: "not_reachable", next: null } : { status: "retry_pending", next };
  }
  return { status: "scheduled", next: nextWindowStart(s, now) };
}

export function studentOut(s: FakeCallStudent): CallStudent {
  settle(s);
  const { status, next } = studentStatus(s);
  const last = [...s.calls].reverse().find((c) => {
    const x = callState(c, fakeNow()).state;
    return x === "completed" || x === "no_answer";
  });
  return {
    id: s.id,
    classroom_id: s.classroomId,
    name: s.name,
    phone_last4: s.phone.slice(-4),
    language: s.language,
    window: s.window,
    days: s.days,
    status,
    minutes_this_week: minutesThisWeek(s),
    weekly_cap_minutes: CALL_RULES.weeklyCapMinutes,
    next_call_at: next === null ? null : new Date(next).toISOString(),
    last_call: last ? { at: new Date(last.startedAt).toISOString(), outcome: callState(last, fakeNow()).state === "completed" ? "completed" : "no_answer", minutes: s.billed[last.id] ?? 0 } : null,
    created_at: new Date(s.createdAt).toISOString(),
  };
}

export function sessionOut(s: FakeCallStudent, c: FakeCall): CallSession {
  const cs = callState(c, fakeNow());
  const retry = cs.state === "no_answer" ? retryAt(c.attempt, cs.endedAt!) : null;
  return {
    id: c.id,
    call_student_id: s.id,
    state: cs.state,
    attempt: c.attempt,
    started_at: new Date(c.startedAt).toISOString(),
    connected_at: cs.connectedAt ? new Date(cs.connectedAt).toISOString() : null,
    ended_at: cs.endedAt ? new Date(cs.endedAt).toISOString() : null,
    minutes: s.billed[c.id] ?? 0,
    retry_at: retry ? new Date(retry).toISOString() : null,
  };
}

export function startCall(s: FakeCallStudent): FakeCall {
  const c = { id: nextCallId("call"), startedAt: fakeNow(), attempt: 1, noAnswer: noAnswerFor(s.phone) };
  s.calls.push(c);
  return c;
}

export function newStudent(classroomId: string, body: { name: string; phone: string; language: "hindi" | "kannada"; window: CallWindow; days: number[] }): FakeCallStudent {
  const now = fakeNow();
  const s: FakeCallStudent = { id: nextCallId("cs"), classroomId, name: body.name, phone: body.phone, language: body.language, window: body.window, days: [...body.days].sort(), paused: false, consentAt: null, consentDueAt: now + CALL_TIMING.consentReplyMs, createdAt: now, calls: [], billed: {} };
  st.students.push(s);
  return s;
}

const tri = (en: string, hi: string, kn: string) => ({ en, hi, kn });

export function twinOut(s: FakeCallStudent): CallTwin {
  settle(s);
  const heard = s.calls.filter((c) => callState(c, fakeNow()).state === "completed").length;
  return {
    call_student_id: s.id,
    lessons_heard: heard,
    last_topic: heard ? tri("Parts of a cell", "कोशिका के भाग", "ಜೀವಕೋಶದ ಭಾಗಗಳು") : null,
    strong: heard ? [tri("Nucleus", "केंद्रक", "ಕೋಶಕೇಂದ್ರ")] : [],
    weak: heard ? [tri("Mitochondria", "माइटोकॉन्ड्रिया", "ಮೈಟೊಕಾಂಡ್ರಿಯಾ")] : [],
    summary: heard
      ? tri(`${s.name} has heard ${heard} lessons by phone and answers nucleus questions well.`, `${s.name} ने फ़ोन पर ${heard} पाठ सुने हैं और केंद्रक के प्रश्न अच्छे से हल करते हैं।`, `${s.name} ಫೋನ್‌ನಲ್ಲಿ ${heard} ಪಾಠ ಕೇಳಿದ್ದಾರೆ, ಕೋಶಕೇಂದ್ರದ ಪ್ರಶ್ನೆಗಳಿಗೆ ಚೆನ್ನಾಗಿ ಉತ್ತರಿಸುತ್ತಾರೆ.`)
      : tri(`No calls with ${s.name} yet.`, `${s.name} से अभी कोई कॉल नहीं हुई।`, `${s.name} ಅವರೊಂದಿಗೆ ಇನ್ನೂ ಕರೆ ಆಗಿಲ್ಲ.`),
  };
}
