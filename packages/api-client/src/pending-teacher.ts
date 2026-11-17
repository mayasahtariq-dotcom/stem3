/**
 * Teacher analytics and materials endpoints the web app needs but the backend
 * hasn't built yet. The fake backend serves them (apps/web/src/mocks/teacher);
 * see docs/web/backend-handoff.md.
 */
type Tri = { en: string; hi: string; kn: string };

export interface TeacherStudentRef {
  id: string;
  name: string;
  accuracy: number | null;
  streak: number;
  idle_days: number;
  behind: boolean;
  idle: boolean;
}

export interface ActivityItem {
  student: string;
  kind: "lesson" | "answers";
  title: Tri;
  accuracy: number | null;
  at: string;
}

/** GET /teacher/overview */
export interface TeacherOverview {
  class_count: number;
  student_count: number;
  accuracy: number | null;
  completion: number;
  classes: { id: string; name: string; subject: "BI" | "CH" | "PH"; grade: number; join_key: string; student_count: number; accuracy: number | null; completion: number }[];
  subjects: { subject: "BI" | "CH" | "PH"; accuracy: number | null; classes: number }[];
  doing_well: TeacherStudentRef[];
  needs_attention: TeacherStudentRef[];
  recent: ActivityItem[];
}

/** GET /classrooms/{id}/insights */
export interface ClassInsights {
  classroom_id: string;
  student_count: number;
  accuracy: number | null;
  completion: number;
  trend: { week: number; accuracy: number }[];
  topics: { name: Tri; accuracy: number | null }[];
  doing_well: TeacherStudentRef[];
  needs_attention: TeacherStudentRef[];
  missed: { question_id: string; prompt: Tri; lesson: Tri; wrong_rate: number; answers: number }[];
}

/** GET /teacher/materials */
export interface Material {
  id: string;
  files: { name: string; kind: "photo" | "pdf" | "text" }[];
  classroom: string | null;
  subject: "BI" | "CH" | "PH";
  course_id: string | null;
  status: "draft" | "processing" | "review" | "published";
  created_at: string;
}
