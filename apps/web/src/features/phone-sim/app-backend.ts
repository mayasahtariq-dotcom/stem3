import type { ApiClient } from "@mooshala/api-client";
import type { AuthGateway } from "@/features/auth/gateway";
import { fetchProfile } from "@/features/auth/profile-api";
import { AuthError, type Session } from "@/features/auth/types";
import { optionText, toPlayableLesson, type PlayableQuestion } from "@/features/learning/content";
import { unwrap } from "@/lib/api/client";
import type { PendingClient } from "@/lib/api/pending-client";
import type { Tri } from "@/lib/i18n/use-tri";
import {
  MAX_CHOICES,
  SimAuthError,
  type CallBackend,
  type ResumePoint,
  type ResumeStore,
  type SimQuestion,
} from "./engine";

/** Sent with every simulator answer so the server records the channel as PHONE_SIMULATOR. */
export const CHANNEL_HEADER = { "X-Channel": "phone_simulator" };

const TRUE: Tri = { en: "True", hi: "सही", kn: "ಸರಿ" };
const FALSE: Tri = { en: "False", hi: "गलत", kn: "ತಪ್ಪು" };
const same = (s: string): Tri => ({ en: s, hi: s, kn: s });

/** Phone-friendly questions (pick one of a few spoken options); match-the-pairs needs a screen and is skipped. */
export function toSimQuestion(
  q: PlayableQuestion,
  terms: Parameters<typeof optionText>[1],
): SimQuestion | null {
  const c = q.content;
  if (c.type === "multiple_choice") {
    if (c.options.length > MAX_CHOICES) return null;
    return {
      id: q.id,
      prompt: c.prompt,
      options: c.options.map((o) => optionText(o, terms)),
      maxSelections: 1,
      toAnswer: ([i]) => ({ index: i }),
      correctIndex: (a) => (typeof a.index === "number" ? a.index : null),
    };
  }
  if (c.type === "true_false") {
    return {
      id: q.id,
      prompt: c.statement.en ? c.statement : c.prompt,
      options: [TRUE, FALSE],
      maxSelections: 1,
      toAnswer: ([i]) => ({ value: i === 0 }),
      correctIndex: (a) => (typeof a.value === "boolean" ? (a.value ? 0 : 1) : null),
    };
  }
  if (c.type === "fill_formula") {
    if (c.chips.length > MAX_CHOICES) return null;
    return {
      id: q.id,
      prompt: {
        en: `${c.prompt.en} ${c.formula}`,
        hi: `${c.prompt.hi} ${c.formula}`,
        kn: `${c.prompt.kn} ${c.formula}`,
      },
      options: c.chips.map(same),
      maxSelections: 1,
      toAnswer: ([i]) => ({ chip: c.chips[i!] }),
      correctIndex: (a) => {
        const right =
          typeof a.chip === "string"
            ? a.chip
            : typeof a.text === "object" && a.text
              ? (a.text as Tri).en
              : null;
        const i = right === null ? -1 : c.chips.indexOf(right);
        return i >= 0 ? i : null;
      },
    };
  }
  return null;
}

const e164 = (id: string) => `+91${id}`;

/**
 * The simulator's backend: the same endpoints the app uses, so one student, one set of attempts,
 * one XP total (the unified digital twin). Signing in with the student ID (their phone number)
 * and PIN (their login code) signs this browser in as that student.
 */
export function appCallBackend(deps: {
  api: ApiClient;
  pending: PendingClient;
  auth: AuthGateway;
  setSession: (s: Session | null) => void;
  afterChange?: () => void;
}): CallBackend {
  const { api, pending, auth } = deps;
  return {
    async checkId(id) {
      try {
        await auth.requestOtp(e164(id));
      } catch (e) {
        throw new SimAuthError(
          e instanceof AuthError && e.code === "invalid_phone" ? "unknown_id" : "failed",
        );
      }
    },
    async signIn(id, pin) {
      let session: Session;
      try {
        session = await auth.verifyOtp(e164(id), pin);
      } catch (e) {
        throw new SimAuthError(
          e instanceof AuthError && (e.code === "invalid_code" || e.code === "code_expired")
            ? "bad_pin"
            : "failed",
        );
      }
      deps.setSession(session);
      const me = await fetchProfile(api).catch(() => null);
      // only existing, registered students: the simulator never creates a second record
      if (!me || !me.registered || !me.roles.includes("student")) {
        await auth.signOut().catch(() => {});
        deps.setSession(null);
        throw new SimAuthError("not_student");
      }
      return { name: (me.name ?? "").split(" ")[0] || id, language: me.languageMode };
    },
    async courses() {
      const home = unwrap(await api.GET("/me/home"));
      return {
        courses: home.courses.map((c) => ({ id: c.id, title: c.title as Tri })),
        continueLesson: home.continue_lesson
          ? {
              courseId: home.continue_lesson.course_id,
              lessonId: home.continue_lesson.lesson_id,
              title: home.continue_lesson.lesson_title as Tri,
            }
          : null,
      };
    },
    async lessons(courseId) {
      const path = unwrap(
        await api.GET("/courses/{course_id}/path", { params: { path: { course_id: courseId } } }),
      );
      return path.units
        .flatMap((u) => u.lessons)
        .filter((l) => l.state !== "locked" && l.question_count > 0)
        .map((l) => ({ id: l.id, title: l.title as Tri, done: l.state === "done" }));
    },
    async openLesson(lessonId, resume) {
      const out = resume
        ? unwrap(
            await api.GET("/lessons/{lesson_id}", { params: { path: { lesson_id: lessonId } } }),
          )
        : unwrap(
            await api.POST("/lessons/{lesson_id}/start", {
              params: { path: { lesson_id: lessonId } },
            }),
          ).lesson;
      const lesson = toPlayableLesson(out);
      return {
        title: lesson.title,
        questions: lesson.questions
          .map((q) => toSimQuestion(q, lesson.terms))
          .filter((q): q is SimQuestion => q !== null),
      };
    },
    async submit(questionId, answer, elapsedMs, retry) {
      const res = unwrap(
        await api.POST("/attempts", {
          body: {
            question_id: questionId,
            answer,
            retry,
            time_ms: Math.min(3_600_000, Math.max(0, elapsedMs)),
          },
          headers: CHANNEL_HEADER,
        }),
      );
      deps.afterChange?.();
      const ex = res.explanation as Partial<Tri> | null;
      return {
        correct: res.correct,
        correctAnswer: res.correct_answer as Record<string, unknown>,
        explanation: ex?.en ? (ex as Tri) : null,
        xp: res.xp_delta,
      };
    },
    async complete(lessonId) {
      const res = unwrap(
        await api.POST("/lessons/{lesson_id}/complete", {
          params: { path: { lesson_id: lessonId } },
          headers: CHANNEL_HEADER,
        }),
      );
      deps.afterChange?.();
      return { xp: res.xp_earned, accuracy: res.accuracy };
    },
    async startSession(lessonId) {
      const s = await pending.post<{ id: string }>(
        "/sim/sessions",
        { lesson_id: lessonId },
        CHANNEL_HEADER,
      );
      return s.id;
    },
    async updateSession(id, patch) {
      await pending.patch(`/sim/sessions/${id}`, patch);
    },
  };
}

/** Where a student stopped, kept in this browser so the next call can resume. */
export const browserResumeStore: ResumeStore = {
  get(id) {
    try {
      const raw = localStorage.getItem(`phone-sim-resume:${id}`);
      return raw ? (JSON.parse(raw) as ResumePoint) : null;
    } catch {
      return null;
    }
  },
  set(id, p) {
    try {
      localStorage.setItem(`phone-sim-resume:${id}`, JSON.stringify(p));
    } catch {
      /* private mode: resume just won't be offered */
    }
  },
  clear(id) {
    try {
      localStorage.removeItem(`phone-sim-resume:${id}`);
    } catch {
      /* ignore */
    }
  },
};
