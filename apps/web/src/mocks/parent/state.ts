import type { Schemas } from "@mooshala/api-client";
import { fakeDb, onFakeDbReset, registerFakeStore } from "../fake-db";
import { COURSE_ID } from "../learning/course-data";
import { fakeLessons, fakeNow, learner } from "../learning/state";
import { teacherState } from "../teacher/state";

/**
 * Parent-mode fake state (backend/app/routers/parents.py): six-character link
 * codes that last 24 hours and work once, at most two parents per child, and
 * the DPDP consent status (pending, approved, revoked) that gates lessons.
 */
export const PARENT_RULES = { codeTtlMs: 24 * 3600_000, maxParents: 2, deletionDays: 7 };
export const DEMO_CODES = { asha: "K7M4PX", expired: "EXP1RD", full: "FULL22" } as const;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface Link {
  parentId: string;
  studentId: string;
  linkedAt: number;
  active: boolean;
  consentAt: number | null;
}

interface ParentState {
  codes: Record<string, { studentId: string; expiresAt: number; usedAt: number | null }>;
  links: Link[];
  consent: Record<string, "pending" | "approved" | "revoked">;
  names: Record<string, { name: string; phoneLast4: string }>;
  deletions: string[];
}

let st: ParentState;

onFakeDbReset(() => {
  const now = Date.now();
  st = {
    codes: {
      [DEMO_CODES.asha]: { studentId: "u-asha", expiresAt: now + 30 * 86400_000, usedAt: null },
      [DEMO_CODES.expired]: { studentId: "u-asha", expiresAt: now - 3600_000, usedAt: null },
      [DEMO_CODES.full]: { studentId: "s-bharat", expiresAt: now + PARENT_RULES.codeTtlMs, usedAt: null },
    },
    links: [
      { parentId: "p-bharat-1", studentId: "s-bharat", linkedAt: now - 9 * 86400_000, active: true, consentAt: now - 9 * 86400_000 },
      { parentId: "p-bharat-2", studentId: "s-bharat", linkedAt: now - 8 * 86400_000, active: true, consentAt: null },
    ],
    consent: { "u-asha": "pending", "s-bharat": "approved" },
    names: { "u-asha": { name: "Asha", phoneLast4: "3210" }, "s-bharat": { name: "Bharat", phoneLast4: "1111" }, "u-meena": { name: "Meena", phoneLast4: "0002" } },
    deletions: [],
  };
});

registerFakeStore("parent", () => st, (v) => (st = v));

export const parentState = () => st;
export const consentOf = (studentId: string) => st.consent[studentId] ?? "pending";

/** require_consent: approved, or not revoked and in a class whose school collected consent. */
export function mayStartLessons(studentId: string): boolean {
  const status = consentOf(studentId);
  if (status === "approved") return true;
  if (status === "revoked") return false;
  const classes = fakeDb().memberships.get(studentId) ?? new Set<string>();
  return [...classes].some((c) => teacherState().schoolConsent[c]);
}

export function newCode(studentId: string) {
  let code = "";
  do code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  while (st.codes[code]);
  const expiresAt = fakeNow() + PARENT_RULES.codeTtlMs;
  st.codes[code] = { studentId, expiresAt, usedAt: null };
  return { code, expires_at: new Date(expiresAt).toISOString() };
}

export function validCode(raw: string) {
  const code = raw.trim().toUpperCase();
  const c = st.codes[code];
  if (!c) return { error: "CODE_NOT_FOUND" as const };
  if (c.usedAt !== null || c.expiresAt <= fakeNow()) return { error: "CODE_EXPIRED" as const };
  return { code, entry: c };
}

export function activeLink(parentId: string, studentId: string) {
  return st.links.find((l) => l.parentId === parentId && l.studentId === studentId && l.active);
}

/** _refresh_consent: a child stays approved while at least one active parent has consented. */
export function refreshConsent(studentId: string) {
  if (consentOf(studentId) === "revoked") return;
  st.consent[studentId] = st.links.some((l) => l.studentId === studentId && l.active && l.consentAt !== null) ? "approved" : "pending";
}

export function classesOf(studentId: string): Schemas["ClassOut"][] {
  const db = fakeDb();
  const ids = db.memberships.get(studentId) ?? new Set<string>();
  const fromRoster = Object.entries(teacherState().roster)
    .filter(([, r]) => r.some((s) => s.id === studentId))
    .map(([c]) => c);
  return db.classrooms.filter((c) => ids.has(c.id) || fromRoster.includes(c.id)).map((c) => ({ id: c.id, name: c.name, teacher_name: c.teacher_name }));
}

export function childOut(studentId: string, link: Link): Schemas["ChildOut"] {
  return { id: studentId, name: st.names[studentId]?.name ?? "Student", consent_status: consentOf(studentId), consent_given_by_me: link.consentAt !== null, classes: classesOf(studentId) };
}

const tri = (en: string, hi: string, kn: string) => ({ en, hi, kn });
const WORDS = { improving: ["improving", "सुधर रही है", "ಸುಧಾರಿಸುತ್ತಿದೆ"], steady: ["steady", "स्थिर है", "ಸ್ಥಿರವಾಗಿದೆ"], needs_practice: ["needs practice", "और अभ्यास चाहिए", "ಇನ್ನಷ್ಟು ಅಭ್ಯಾಸ ಬೇಕು"] } as const;

/** Port of parents.summary(): three short sentences per language, read aloud by Listen. */
export function summary(name: string, week: Schemas["WeekCard"], word: keyof typeof WORDS, weakest: Record<string, string> | null, pending: number, overdue: number, total: number) {
  const n = week.lessons_this_week;
  const last = week.lessons_last_week;
  const s1 =
    n === 0
      ? [`${name} hasn't finished a lesson this week yet.`, `${name} ने इस हफ़्ते अभी तक कोई पाठ पूरा नहीं किया है।`, `${name} ಈ ವಾರ ಇನ್ನೂ ಯಾವ ಪಾಠವನ್ನೂ ಮುಗಿಸಿಲ್ಲ.`]
      : [
          `${name} finished ${n} lessons this week, ${n > last ? "more than" : n < last ? "fewer than" : "the same as"} last week.`,
          `${name} ने इस हफ़्ते ${n} पाठ पूरे किए, ${n > last ? "पिछले हफ़्ते से ज़्यादा" : n < last ? "पिछले हफ़्ते से कम" : "पिछले हफ़्ते जितने"}।`,
          `${name} ಈ ವಾರ ${n} ಪಾಠಗಳನ್ನು ಮುಗಿಸಿದರು, ${n > last ? "ಕಳೆದ ವಾರಕ್ಕಿಂತ ಹೆಚ್ಚು" : n < last ? "ಕಳೆದ ವಾರಕ್ಕಿಂತ ಕಡಿಮೆ" : "ಕಳೆದ ವಾರದಷ್ಟೇ"}.`,
        ];
  const w = WORDS[word];
  const s2 = weakest
    ? [`Their accuracy is ${w[0]}; ${weakest.en} needs more practice.`, `सही जवाबों की दर ${w[1]}; ${weakest.hi} पर और अभ्यास चाहिए।`, `ಸರಿ ಉತ್ತರಗಳ ಪ್ರಮಾಣ ${w[2]}; ${weakest.kn} ಮೇಲೆ ಇನ್ನಷ್ಟು ಅಭ್ಯಾಸ ಬೇಕು.`]
    : [`Their accuracy is ${w[0]}.`, `सही जवाबों की दर ${w[1]}।`, `ಸರಿ ಉತ್ತರಗಳ ಪ್ರಮಾಣ ${w[2]}.`];
  const s3 = overdue
    ? [`${overdue} assignments are overdue.`, `${overdue} असाइनमेंट की तारीख निकल गई है।`, `${overdue} ಅಸೈನ್‌ಮೆಂಟ್‌ಗಳ ಗಡುವು ಮುಗಿದಿದೆ.`]
    : pending
      ? [`${pending} assignments are due soon.`, `${pending} असाइनमेंट जल्द पूरे करने हैं।`, `${pending} ಅಸೈನ್‌ಮೆಂಟ್‌ಗಳನ್ನು ಶೀಘ್ರದಲ್ಲೇ ಮುಗಿಸಬೇಕು.`]
      : total === 0
        ? ["No assignments yet.", "अभी कोई असाइनमेंट नहीं है।", "ಇನ್ನೂ ಯಾವ ಅಸೈನ್‌ಮೆಂಟ್ ಇಲ್ಲ."]
        : ["All assignments are done.", "सभी असाइनमेंट पूरे हो गए हैं।", "ಎಲ್ಲಾ ಅಸೈನ್‌ಮೆಂಟ್‌ಗಳು ಮುಗಿದಿವೆ."];
  return { en: [s1[0], s2[0], s3[0]].join(" "), hi: [s1[1], s2[1], s3[1]].join(" "), kn: [s1[2], s2[2], s3[2]].join(" ") };
}

const WEEK = 7 * 86400_000;

export function childDashboard(studentId: string, link: Link): Schemas["ChildDashboard"] {
  const now = fakeNow();
  const s = learner(studentId);
  const done = [...s.progress.values()].map((p) => p.completedAt).filter((x): x is number => Boolean(x));
  const thisWeek = done.filter((t) => t > now - WEEK).length;
  const lastWeek = done.filter((t) => t <= now - WEEK && t > now - 2 * WEEK).length;
  const accIn = (from: number, to: number) => {
    const a = s.attempts.filter((x) => x.firstTry && x.at > from && x.at <= to);
    return a.length ? Math.round((a.filter((x) => x.correct).length / a.length) * 100) / 100 : null;
  };
  const accThis = accIn(now - WEEK, now) ?? (thisWeek ? ([...s.progress.values()].find((p) => p.completedAt && p.completedAt > now - WEEK)?.bestAccuracy ?? null) : null);
  const accLast = accIn(now - 2 * WEEK, now - WEEK);
  const word: keyof typeof WORDS = accThis === null ? "steady" : accLast !== null && accThis > accLast + 0.05 ? "improving" : accThis < 0.6 ? "needs_practice" : accLast === null && accThis >= 0.8 ? "improving" : "steady";
  const week: Schemas["WeekCard"] = {
    lessons_this_week: thisWeek,
    lessons_last_week: lastWeek,
    arrow: thisWeek > lastWeek ? "up" : thisWeek < lastWeek ? "down" : "same",
    minutes_this_week: thisWeek * 6 + Math.round(s.attempts.filter((a) => a.at > now - WEEK).length * 0.4),
    streak: s.streak,
  };
  const classes = classesOf(studentId);
  const classIds = new Set(classes.map((c) => c.id));
  const lessonsDone = new Set([...s.progress.entries()].filter(([, p]) => p.completedAt).map(([id]) => id));
  const assignments: Schemas["AssignmentOut"][] = teacherState()
    .courses.flatMap((c) => Object.entries(c.assigned).filter(([cl]) => classIds.has(cl)).map(([cl, due]) => ({ c, cl, due })))
    .map(({ c, cl, due }) => {
      const ls = fakeLessons(c.id).filter((l) => l.published);
      const complete = ls.length > 0 && ls.every((l) => lessonsDone.has(l.id));
      return { course_id: c.id, title: c.title, classroom: classes.find((x) => x.id === cl)!.name, due_at: due, status: complete ? "done" : due && Date.parse(due) < now ? "overdue" : "pending" };
    });
  const weakest = studentId === "u-asha" || s.attempts.length ? tri("Mitochondria", "माइटोकॉन्ड्रिया", "ಮೈಟೊಕಾಂಡ್ರಿಯಾ") : null;
  const hasActivity = done.length > 0 || s.attempts.length > 0;
  const name = st.names[studentId]?.name ?? "Student";
  return {
    child: childOut(studentId, link),
    has_activity: hasActivity,
    week,
    accuracy: { this_week: accThis, last_week: accLast, word },
    subjects: hasActivity && fakeLessons(COURSE_ID).length ? [{ subject: "BI", strongest: tri("Nucleus", "केंद्रक", "ಕೋಶಕೇಂದ್ರ"), weakest }] : [],
    assignments,
    classes,
    summary: summary(name, week, word, weakest, assignments.filter((a) => a.status === "pending").length, assignments.filter((a) => a.status === "overdue").length, assignments.length),
  };
}
