import type { CallSession } from "@mooshala/api-client";
import { CALL_RULES, callBlock, canMove, daysProblem, draftProblems, formatTime, insideWindow, istParts, minutesLeft, normalizePhone, retryAt, shownCall, statusBlock, weekStart, windowProblem } from "./rules";

/** 2026-11-18 is a Wednesday. Times below are India time (UTC+5:30). */
const ist = (isoLocal: string) => Date.parse(`${isoLocal}+05:30`);

describe("phone", () => {
  it("accepts Indian mobiles with or without +91 and rejects the rest", () => {
    expect(normalizePhone("98450 11111")).toBe("+919845011111");
    expect(normalizePhone("+91-98450-11111")).toBe("+919845011111");
    expect(normalizePhone("09845011111")).toBe("+919845011111");
    expect(normalizePhone("5845011111")).toBeNull();
    expect(normalizePhone("98450")).toBeNull();
  });
});

describe("call window", () => {
  it("must sit inside 9 am to 9 pm, end after start, and last 30 minutes", () => {
    expect(windowProblem(CALL_RULES.defaultWindow)).toBeNull();
    expect(windowProblem({ start: "08:30", end: "10:00" })).toBe("outsideHours");
    expect(windowProblem({ start: "20:00", end: "21:30" })).toBe("outsideHours");
    expect(windowProblem({ start: "19:00", end: "17:00" })).toBe("endBeforeStart");
    expect(windowProblem({ start: "17:00", end: "17:15" })).toBe("tooShort");
    expect(windowProblem({ start: "", end: "19:00" })).toBe("format");
    expect(windowProblem({ start: "09:00", end: "21:00" })).toBeNull();
  });
  it("only Monday to Saturday", () => {
    expect(daysProblem([])).toBe("noDays");
    expect(daysProblem([1, 7])).toBe("sunday");
    expect(daysProblem([1, 6])).toBeNull();
  });
  it("checks the whole draft", () => {
    expect(draftProblems({ name: "A", phone: "123", language: "hindi", window: { start: "22:00", end: "23:00" }, days: [] })).toEqual({ name: "nameMissing", phone: "phoneInvalid", window: "outsideHours", days: "noDays" });
    expect(draftProblems({ name: "Ravi", phone: "9845011111", language: "kannada", window: CALL_RULES.defaultWindow, days: [1] })).toEqual({});
  });
  it("knows India time, the week start and whether now is inside the window", () => {
    expect(istParts(ist("2026-11-18T18:30:00"))).toEqual({ weekday: 3, minutes: 18 * 60 + 30 });
    expect(weekStart(ist("2026-11-18T18:30:00"))).toBe(ist("2026-11-16T00:00:00"));
    expect(insideWindow(ist("2026-11-18T18:30:00"), CALL_RULES.defaultWindow, [3])).toBe(true);
    expect(insideWindow(ist("2026-11-18T19:00:00"), CALL_RULES.defaultWindow, [3])).toBe(false);
    expect(insideWindow(ist("2026-11-18T18:30:00"), CALL_RULES.defaultWindow, [1, 2])).toBe(false);
    expect(insideWindow(ist("2026-11-22T18:00:00"), CALL_RULES.defaultWindow, [1, 2, 3, 4, 5, 6])).toBe(false); // Sunday
    expect(formatTime("17:00")).toBe("5:00 pm");
    expect(formatTime("09:15")).toBe("9:15 am");
  });
});

describe("cap and retries", () => {
  it("allows 15 minutes a week", () => {
    expect(minutesLeft(4)).toBe(11);
    expect(minutesLeft(20)).toBe(0);
  });
  it("retries after 20 minutes, twice, then gives up", () => {
    expect(retryAt(1, 0)).toBe(20 * 60_000);
    expect(retryAt(2, 1000)).toBe(1000 + 20 * 60_000);
    expect(retryAt(3, 0)).toBeNull();
  });
});

describe("call now", () => {
  const s = { status: "scheduled" as const, minutes_this_week: 4, weekly_cap_minutes: 15, window: CALL_RULES.defaultWindow, days: [1, 2, 3, 4, 5, 6] };
  const evening = ist("2026-11-18T18:00:00");
  it("names the first reason a call can't start", () => {
    expect(callBlock(s, evening, false)).toBeNull();
    expect(callBlock(s, evening, true)).toBe("CALL_IN_PROGRESS");
    expect(callBlock({ ...s, status: "paused" }, evening, false)).toBe("CALLS_PAUSED");
    expect(callBlock({ ...s, status: "waiting_consent" }, evening, false)).toBe("CONSENT_PENDING");
    expect(callBlock({ ...s, minutes_this_week: 15 }, evening, false)).toBe("WEEKLY_CAP_REACHED");
    expect(callBlock(s, ist("2026-11-18T21:30:00"), false)).toBe("OUTSIDE_CALL_HOURS");
    expect(statusBlock(s, false)).toBeNull();
    expect(statusBlock({ ...s, status: "in_call" }, false)).toBe("CALL_IN_PROGRESS");
  });
});

describe("call states", () => {
  const call = (state: CallSession["state"], id = "c1", started = "2026-11-18T12:30:00Z"): CallSession => ({ id, call_student_id: "s", state, attempt: 1, started_at: started, connected_at: null, ended_at: null, minutes: 0, retry_at: null });
  it("only moves forward", () => {
    expect(canMove("dialing", "ringing")).toBe(true);
    expect(canMove("ringing", "connected")).toBe(true);
    expect(canMove("dialing", "no_answer")).toBe(true);
    expect(canMove("connected", "ringing")).toBe(false);
    expect(canMove("connected", "no_answer")).toBe(false);
    expect(canMove("completed", "ringing")).toBe(false);
  });
  it("never shows a stale poll over a newer state or an older call over a new one", () => {
    expect(shownCall(call("connected"), call("ringing")).state).toBe("connected");
    expect(shownCall(call("ringing"), call("connected")).state).toBe("connected");
    expect(shownCall(call("dialing", "c2", "2026-11-18T13:00:00Z"), call("completed", "c1")).id).toBe("c2");
    expect(shownCall(null, call("dialing")).state).toBe("dialing");
  });
});
