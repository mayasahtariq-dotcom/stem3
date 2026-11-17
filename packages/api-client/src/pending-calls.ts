/**
 * Call mode: students without the app learn by phone (Exotel on the backend).
 *
 * PENDING CONTRACT. The web spec names POST /classrooms/{id}/call-students,
 * PATCH /call-students/{id}, POST /call-students/{id}/call-now and
 * GET /call-students/{id}/twin, but the backend has none of them yet, and the
 * spec gives no payloads. The shapes below are the web's assumption, written
 * up in docs/web/backend-handoff.md. GET /classrooms/{id}/call-students (list)
 * and GET /call-students/{id}/call (live status) are additions the console
 * needs: the UI never shows "connected" until this status says so.
 *
 * Rules from the spec: calls only between 9 am and 9 pm IST, inside the
 * student's window (default 5 to 7 pm), Monday to Saturday; 15 minutes a week
 * at most; a call nobody answers is retried after 20 minutes, up to twice.
 * Errors: DUPLICATE_PHONE, OUTSIDE_CALL_HOURS, CALL_IN_PROGRESS,
 * CONSENT_PENDING, CALLS_PAUSED, WEEKLY_CAP_REACHED.
 */
export type CallLanguage = "hindi" | "kannada";

/** "HH:MM" in India time. */
export interface CallWindow {
  start: string;
  end: string;
}

export type CallStudentStatus =
  /** the parent hasn't consented yet (SMS/IVR consent on the backend) */
  | "waiting_consent"
  /** ready; calls happen in the window */
  | "scheduled"
  /** a call is being placed or is live */
  | "in_call"
  /** a missed call will be retried at next_call_at */
  | "retry_pending"
  /** three attempts in a row went unanswered */
  | "not_reachable"
  | "paused"
  | "cap_reached";

export interface LastCall {
  at: string;
  outcome: "completed" | "no_answer";
  minutes: number;
}

export interface CallStudent {
  id: string;
  classroom_id: string;
  name: string;
  /** only the last four digits ever reach the browser */
  phone_last4: string;
  language: CallLanguage;
  window: CallWindow;
  /** ISO weekdays, 1 = Monday ... 6 = Saturday */
  days: number[];
  status: CallStudentStatus;
  minutes_this_week: number;
  weekly_cap_minutes: number;
  next_call_at: string | null;
  last_call: LastCall | null;
  created_at: string;
}

export interface CallStudentCreate {
  name: string;
  /** "+91" and ten digits */
  parent_phone: string;
  language: CallLanguage;
  window: CallWindow;
  days: number[];
}

export interface CallStudentPatch {
  paused?: boolean;
  language?: CallLanguage;
  window?: CallWindow;
  days?: number[];
}

export type CallState = "dialing" | "ringing" | "connected" | "completed" | "no_answer" | "failed";

export interface CallSession {
  id: string;
  call_student_id: string;
  state: CallState;
  /** 1 for the first try, 2 and 3 for the retries */
  attempt: number;
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  minutes: number;
  retry_at: string | null;
}

type Tri = { en: string; hi: string; kn: string };

/** What the student's learning twin knows from their calls. */
export interface CallTwin {
  call_student_id: string;
  lessons_heard: number;
  last_topic: Tri | null;
  strong: Tri[];
  weak: Tri[];
  summary: Tri;
}

export const CALL_PATHS = {
  list: (classroomId: string) => `/classrooms/${encodeURIComponent(classroomId)}/call-students`,
  create: (classroomId: string) => `/classrooms/${encodeURIComponent(classroomId)}/call-students`,
  patch: (id: string) => `/call-students/${encodeURIComponent(id)}`,
  callNow: (id: string) => `/call-students/${encodeURIComponent(id)}/call-now`,
  call: (id: string) => `/call-students/${encodeURIComponent(id)}/call`,
  twin: (id: string) => `/call-students/${encodeURIComponent(id)}/twin`,
} as const;
