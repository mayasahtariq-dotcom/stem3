/**
 * Pure upload rules, mirroring backend/app/routers/courses.py: at most ten
 * pages; photos (JPG) up to 12 MB, PDFs up to 10 MB; typed text can't be empty.
 */
export const UPLOAD_RULES = { maxPages: 10, photoBytes: 12 * 1024 * 1024, pdfBytes: 10 * 1024 * 1024 };
export const ACCEPT = "image/jpeg,application/pdf,text/plain,.txt";

export type PageKind = "photo" | "pdf" | "text";

export interface PageDraft {
  key: string;
  kind: PageKind;
  name: string;
  size: number;
  file?: File;
  text?: string;
  /** a file that isn't a JPG or PDF */
  unsupported?: boolean;
}

export type PageProblem = "wrongType" | "tooLarge" | "emptyText";

export function kindForFile(file: Pick<File, "type" | "name">): PageKind | null {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) return "photo";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  // A text document becomes a typed page (its text is read in the browser).
  if (file.type === "text/plain" || /\.txt$/i.test(file.name)) return "text";
  return null;
}

export function pageProblem(p: PageDraft): PageProblem | null {
  if (p.unsupported) return "wrongType";
  if (p.kind === "text") return (p.text ?? "").trim() ? null : "emptyText";
  if (p.kind === "photo" && p.size > UPLOAD_RULES.photoBytes) return "tooLarge";
  if (p.kind === "pdf" && p.size > UPLOAD_RULES.pdfBytes) return "tooLarge";
  return null;
}

export interface UploadMeta {
  subject: "BI" | "CH" | "PH";
  grade: number;
  classroomId: string | null;
}

export type FormProblem = "noPages" | "tooManyPages" | "pageProblem" | "gradeRange" | null;

export function formProblem(pages: PageDraft[], meta: UploadMeta): FormProblem {
  if (!pages.length) return "noPages";
  if (pages.length > UPLOAD_RULES.maxPages) return "tooManyPages";
  if (pages.some((p) => pageProblem(p))) return "pageProblem";
  if (!Number.isInteger(meta.grade) || meta.grade < 6 || meta.grade > 12) return "gradeRange";
  return null;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

// ---- the upload run, as a pure reducer --------------------------------------------------------

export type PageRun = { state: "waiting" | "uploading" | "done" | "error"; progress: number };

export type UploadPhase = "editing" | "creating" | "uploading" | "starting" | "processing" | "ready" | "failed";

export interface UploadRun {
  phase: UploadPhase;
  uploadId: string | null;
  pages: PageRun[];
  steps: string[];
  courseId: string | null;
  firstLessonId: string | null;
  /** an API error (creating/starting/polling) */
  error: unknown;
  /** the pipeline's own failure message */
  pipelineError: string | null;
}

export const initialRun: UploadRun = { phase: "editing", uploadId: null, pages: [], steps: [], courseId: null, firstLessonId: null, error: null, pipelineError: null };

export type RunEvent =
  | { type: "create"; pageCount: number }
  | { type: "created"; uploadId: string; textPages: number[] }
  | { type: "createFailed"; error: unknown }
  | { type: "pageProgress"; index: number; progress: number }
  | { type: "pageDone"; index: number }
  | { type: "pageFailed"; index: number }
  | { type: "start" }
  | { type: "startFailed"; error: unknown }
  | { type: "status"; status: { status: string; steps: string[]; error: string | null; course_id: string | null; first_lesson_id: string | null } }
  | { type: "reset" };

export const allPagesDone = (r: UploadRun) => r.pages.length > 0 && r.pages.every((p) => p.state === "done");

export function runReducer(r: UploadRun, e: RunEvent): UploadRun {
  switch (e.type) {
    case "create":
      return { ...initialRun, phase: "creating", pages: Array.from({ length: e.pageCount }, () => ({ state: "waiting", progress: 0 })) };
    case "created":
      return { ...r, phase: "uploading", uploadId: e.uploadId, pages: r.pages.map((p, i) => (e.textPages.includes(i) ? { state: "done", progress: 1 } : p)) };
    case "createFailed":
      return { ...r, phase: "editing", error: e.error };
    case "pageProgress":
      return { ...r, pages: r.pages.map((p, i) => (i === e.index ? { state: "uploading", progress: Math.max(0, Math.min(1, e.progress)) } : p)) };
    case "pageDone":
      return { ...r, pages: r.pages.map((p, i) => (i === e.index ? { state: "done", progress: 1 } : p)) };
    case "pageFailed":
      return { ...r, pages: r.pages.map((p, i) => (i === e.index ? { state: "error", progress: 0 } : p)) };
    case "start":
      return allPagesDone(r) ? { ...r, phase: "starting", error: null } : r;
    case "startFailed":
      return { ...r, phase: "uploading", error: e.error };
    case "status": {
      const s = e.status;
      // Never claim success early: ready needs the server's "ready" and a course to open.
      if (s.status === "ready" && s.course_id) return { ...r, phase: "ready", steps: s.steps, courseId: s.course_id, firstLessonId: s.first_lesson_id };
      if (s.status === "failed" || s.status === "needs_review") return { ...r, phase: "failed", steps: s.steps, pipelineError: s.error ?? s.status };
      return { ...r, phase: "processing", steps: s.steps, courseId: s.course_id, firstLessonId: s.first_lesson_id };
    }
    case "reset":
      return initialRun;
  }
}
