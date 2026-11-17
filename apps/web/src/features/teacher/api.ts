"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useServices } from "@/lib/services";
import { useAuthStore } from "@/features/auth/auth-store";
import { useTeacherClassrooms } from "@/features/classroom/api";
import { pickClass, useClassStore } from "./class-store";

/** Server state for the teacher portal. Only documented backend endpoints. */
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

/** The selected class (store + the teacher's class list). */
export function useSelectedClass() {
  const classes = useTeacherClassrooms();
  const stored = useClassStore((s) => s.classId);
  const classId = pickClass(stored, classes.data);
  return { classes, classId, classroom: classes.data?.find((c) => c.id === classId) ?? null };
}

/** GET /classrooms/{id}/dashboard */
export function useDashboard(classId: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.teacher.dashboard(classId),
    enabled: useSignedIn() && Boolean(classId),
    queryFn: async () => unwrap(await api.GET("/classrooms/{classroom_id}/dashboard", { params: { path: { classroom_id: classId } } })),
  });
}

/** GET /classrooms/{id}/students/{student_id} */
export function useStudentDetail(classId: string, studentId: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.teacher.student(classId, studentId),
    enabled: useSignedIn() && Boolean(classId && studentId),
    queryFn: async () =>
      unwrap(await api.GET("/classrooms/{classroom_id}/students/{student_id}", { params: { path: { classroom_id: classId, student_id: studentId } } })),
  });
}

/** PUT /classrooms/{id}/school-consent */
export function useSchoolConsent(classId: string) {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) =>
      unwrap(await api.PUT("/classrooms/{classroom_id}/school-consent", { params: { path: { classroom_id: classId } }, body: { enabled } })),
    onSuccess: (out) =>
      qc.setQueryData<Schemas["DashboardOut"]>(queryKeys.teacher.dashboard(classId), (d) => (d ? { ...d, school_consent: out.school_consent } : d)),
  });
}

/** GET /courses (courses this teacher owns) */
export function useCourses() {
  const { api } = useServices();
  return useQuery({ queryKey: queryKeys.teacher.courses, enabled: useSignedIn(), queryFn: async () => unwrap(await api.GET("/courses")) });
}

/** GET /courses/{id} (owner view with units, lessons and flagged counts) */
export function useCourse(id: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.teacher.course(id),
    enabled: useSignedIn() && Boolean(id),
    queryFn: async () => unwrap(await api.GET("/courses/{course_id}", { params: { path: { course_id: id } } })),
  });
}

/** PUT /courses/{id} (rename) */
export function useRenameCourse(id: string) {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: Record<string, string>) => unwrap(await api.PUT("/courses/{course_id}", { params: { path: { course_id: id } }, body: { title } })),
    onSuccess: (c) => {
      qc.setQueryData(queryKeys.teacher.course(id), c);
      void qc.invalidateQueries({ queryKey: queryKeys.teacher.courses });
    },
  });
}

/** POST /courses/{id}/assign */
export function useAssignCourse(id: string) {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { classroom_ids: string[]; due_at: string | null }) =>
      unwrap(await api.POST("/courses/{course_id}/assign", { params: { path: { course_id: id } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.teacher.course(id) });
      void qc.invalidateQueries({ queryKey: ["classrooms"] });
    },
  });
}

/** GET /lessons/{id} (as the owner: answers, confidence and flags included) */
export function useReviewLesson(lessonId: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.lesson(lessonId),
    enabled: useSignedIn() && Boolean(lessonId),
    queryFn: async () => unwrap(await api.GET("/lessons/{lesson_id}", { params: { path: { lesson_id: lessonId } } })),
  });
}

function useLessonCache(lessonId: string, courseId: string) {
  const qc = useQueryClient();
  return {
    replaceQuestion: (q: Schemas["QuestionOut"]) =>
      qc.setQueryData<Schemas["LessonOut"]>(queryKeys.lesson(lessonId), (l) => (l ? { ...l, questions: l.questions.map((x) => (x.id === q.id ? q : x)) } : l)),
    dropQuestion: (id: string) =>
      qc.setQueryData<Schemas["LessonOut"]>(queryKeys.lesson(lessonId), (l) => (l ? { ...l, questions: l.questions.filter((x) => x.id !== id) } : l)),
    refreshCourse: () => void qc.invalidateQueries({ queryKey: queryKeys.teacher.course(courseId) }),
  };
}

/** PUT /questions/{id}: saving (even unchanged) approves it: the server clears the flag. */
export function useSaveQuestion(lessonId: string, courseId: string) {
  const { api } = useServices();
  const cache = useLessonCache(lessonId, courseId);
  return useMutation({
    mutationFn: async ({ id, question }: { id: string; question: Record<string, unknown> }) =>
      unwrap(await api.PUT("/questions/{question_id}", { params: { path: { question_id: id } }, body: { question } })),
    onSuccess: (q) => {
      cache.replaceQuestion(q);
      cache.refreshCourse();
    },
  });
}

/** DELETE /questions/{id} (reject) */
export function useRejectQuestion(lessonId: string, courseId: string) {
  const { api } = useServices();
  const cache = useLessonCache(lessonId, courseId);
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await api.DELETE("/questions/{question_id}", { params: { path: { question_id: id } } }));
      return id;
    },
    onSuccess: (id) => {
      cache.dropQuestion(id);
      cache.refreshCourse();
    },
  });
}

/** POST /questions/{id}/regenerate */
export function useRegenerateQuestion(lessonId: string, courseId: string) {
  const { api } = useServices();
  const cache = useLessonCache(lessonId, courseId);
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.POST("/questions/{question_id}/regenerate", { params: { path: { question_id: id } } })),
    onSuccess: (q) => {
      cache.replaceQuestion(q);
      cache.refreshCourse();
    },
  });
}

/** POST /lessons/{id}/publish (idempotent on the server; the button also locks while pending) */
export function usePublishLesson(courseId: string) {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lessonId, classroomId }: { lessonId: string; classroomId: string | null }) =>
      unwrap(await api.POST("/lessons/{lesson_id}/publish", { params: { path: { lesson_id: lessonId } }, body: { classroom_id: classroomId } })),
    onSuccess: (summary) => {
      qc.setQueryData<Schemas["LessonOut"]>(queryKeys.lesson(summary.id), (l) => (l ? { ...l, published: true } : l));
      void qc.invalidateQueries({ queryKey: queryKeys.teacher.course(courseId) });
      void qc.invalidateQueries({ queryKey: queryKeys.teacher.courses });
      void qc.invalidateQueries({ queryKey: ["classrooms"] });
    },
  });
}

/** GET /classrooms/{id} (members) */
export function useClassroomDetail(classId: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.teacher.classroom(classId),
    enabled: useSignedIn() && Boolean(classId),
    queryFn: async () => unwrap(await api.GET("/classrooms/{classroom_id}", { params: { path: { classroom_id: classId } } })),
  });
}
