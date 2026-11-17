/**
 * Class notes: a teacher shares notes (typed text and/or one small file) with a
 * class, and students in that class read them. Not in the backend yet; the fake
 * backend serves it (apps/web/src/mocks/notes). See docs/web/backend-handoff.md.
 */
export interface NoteFile {
  name: string;
  type: string;
  /** data: URL in the fake backend; a signed storage URL in the real one. */
  url: string;
  size: number;
}

export interface ClassNote {
  id: string;
  classroom_id: string;
  classroom: string;
  teacher_name: string;
  title: string;
  body: string;
  file: NoteFile | null;
  created_at: string;
}

/** POST /classrooms/{id}/notes */
export interface NoteCreate {
  title: string;
  body?: string;
  file?: { name: string; type: string; data_url: string } | null;
}

export const NOTE_LIMITS = { titleMax: 120, bodyMax: 20_000, fileMaxBytes: 1_500_000 } as const;
