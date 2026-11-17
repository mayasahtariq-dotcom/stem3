/** Query key factory. Every server-state query key lives here. */
export const queryKeys = {
  me: ["me"] as const,
  myClassrooms: ["me", "classrooms"] as const,
  teacherClassrooms: ["classrooms"] as const,
  classroomPreview: (key: string) => ["classrooms", "preview", key] as const,
  home: ["me", "home"] as const,
  stats: ["me", "stats"] as const,
  path: (courseId: string) => ["courses", courseId, "path"] as const,
  terms: (courseId: string) => ["courses", courseId, "terms"] as const,
  lesson: (lessonId: string) => ["lessons", lessonId] as const,
  teacher: {
    dashboard: (classId: string) => ["classrooms", classId, "dashboard"] as const,
    classroom: (classId: string) => ["classrooms", classId, "detail"] as const,
    student: (classId: string, studentId: string) => ["classrooms", classId, "students", studentId] as const,
    courses: ["teacher", "courses"] as const,
    course: (id: string) => ["teacher", "courses", id] as const,
    upload: (id: string) => ["uploads", id] as const,
  },
  parent: {
    children: ["parent", "children"] as const,
    child: (id: string) => ["parent", "children", id] as const,
    preview: (code: string) => ["parent", "link", code] as const,
  },
  myParents: ["me", "parents"] as const,
  game: {
    stats: ["game", "stats"] as const,
    shop: ["game", "shop"] as const,
    quests: ["game", "quests"] as const,
    league: ["game", "league"] as const,
    badges: ["game", "badges"] as const,
  },
};
