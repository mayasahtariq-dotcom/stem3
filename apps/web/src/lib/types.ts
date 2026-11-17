// Shapes returned by the backend (see packages/api-client/openapi.json and backend routers).
export type Bi = { regional?: string; english?: string; hi?: string; kn?: string; en?: string } | string;
export type LessonKind = "quiz" | "video" | "reading" | "interactive";
export type QuestionKind = "mcq" | "true_false" | "match" | "fill_in";

export interface Stats { xp: number; streak: number; hearts: number; gems: number; daily_goal: number;
  today_xp: number; freezes: number; stage: "calf" | "cow" | "champion"; league_tier: string }
export interface PathLesson { id: string; title: string; kind: LessonKind; state: "completed" | "current" | "locked" }
export interface Path { id: string; title: string; subject: string; units: { id: string; title: string; lessons: PathLesson[] }[] }
export interface Home { stats: Stats; continue: { course_id: string; course_title: string; lesson_id: string; lesson_title: string } | null;
  courses: { id: string; title: string }[] }
export interface Question { id: string; kind: QuestionKind; prompt: Bi; options: unknown[] | null; concept: string | null }
export interface LessonStart { lesson: { id: string; title: string; kind: LessonKind; content: Record<string, unknown> }; questions: Question[] }
export interface AttemptResult { correct: boolean; first_try: boolean; feedback: "correct" | "not_quite"; correct_answer: unknown;
  xp_gained: number; combo: number; hearts: number; suspicious: boolean; badges?: string[]; quests_completed?: string[] }
export interface CompleteResult { xp_gained: number; perfect: boolean; gems_gained: number; practice: boolean; stats: Stats;
  badges?: string[]; quests_completed?: string[]; pot_id?: string; mascot_stage?: string;
  course_completed?: { course_id: string; parent_sms: string } }
export interface Quest { code: string; kind: "daily" | "weekly" | "revision"; target: number; gems: number; progress: number;
  completed: boolean; concepts?: string[] }
export interface League { enabled: boolean; tier: string; xp: number; rank: number | null; week_start: string;
  promote_zone?: number; demote_zone?: number; pod: { rank: number; name: string; xp: number; is_call: boolean; me: boolean }[] }
export interface Badge { code: string; title: { en: string; hi?: string; kn?: string }; earned: boolean; awarded_at: string | null }
export interface Term { id: string; regional: string; english: string; definition: Record<string, string> | null; saved?: boolean }
export interface Doubt { id: string; text?: string; answer: string; citation: { course?: string; term?: string; page?: number } | null }
export interface Mascot { stage: string; outfit: { owned?: string[]; stickers?: string[]; scenes?: string[] }; xp: number; next_unlock_at_xp: number | null }
