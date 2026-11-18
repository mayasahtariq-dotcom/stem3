"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui";
import type { TermMap } from "@/features/learning/content";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import type { Tri } from "@/lib/i18n/use-tri";
import {
  useAssignCourse,
  useClassCourse,
  useCourse,
  useCourses,
  useDashboard,
  usePublishLesson,
  useRegenerateQuestion,
  useRejectQuestion,
  useRenameCourse,
  useReviewLesson,
  useSaveQuestion,
  useSchoolConsent,
  useSelectedClass,
  useStudentDetail,
} from "./api";
import { CourseDetailScreen } from "./CourseDetailScreen";
import { CoursesScreen } from "./CoursesScreen";
import { LessonReviewScreen } from "./LessonReviewScreen";
import { OverviewScreen } from "./OverviewScreen";
import { AllClassesPanel, MaterialsPanel } from "./OverviewPanels";
import { ClassDetailScreen, ClassesScreen } from "./ClassesScreen";
import { useClassInsights, useCreateClass, useDeleteUpload, useMaterials, useTeacherOverview } from "./insights-api";
import { useClassStore } from "./class-store";
import { useDeleteNote, useTeacherNotes } from "@/features/notes/api";
import { StudentParentLinkCard } from "@/features/parent/share-link";
import type { Schemas } from "@mooshala/api-client";
import { optionLabels, publishBlock, reviewItems } from "./review";
import { StudentDetailScreen } from "./StudentDetailScreen";
import { StudentsScreen } from "./StudentsScreen";
import type { StudentFilter, StudentSort } from "./students";
import { kindForFile, type PageDraft, type UploadMeta } from "./upload";
import { UploadScreen } from "./UploadScreen";
import { useUpload } from "./use-upload";

const useErrorToast = () => {
  const errors = useBilingual("errors");
  return (e: unknown) => toast("error", errors(asApiError(e).code));
};

export function OverviewRoute() {
  const router = useRouter();
  const t = useBilingual("teacher");
  const onError = useErrorToast();
  const { classes, classId } = useSelectedClass();
  const dash = useDashboard(classId);
  const consent = useSchoolConsent(classId);
  const all = useTeacherOverview();
  const locale = useLocale();
  return (
    <>
      {classes.data && classes.data.length > 0 && (
        <AllClassesPanel
          data={all.data}
          loading={all.isLoading}
          error={all.error}
          onRetry={() => void all.refetch()}
          formatTime={(iso) =>
            new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "hi-IN", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Asia/Kolkata",
            }).format(new Date(iso))
          }
        />
      )}
      <OverviewScreen
        data={dash.data}
        loading={classes.isLoading || dash.isLoading}
        error={classes.error ?? dash.error}
        noClasses={classes.data?.length === 0}
        consentSaving={consent.isPending}
        onToggleConsent={(enabled) =>
          consent.mutate(enabled, {
            onSuccess: () => toast("success", t(enabled ? "consentSavedOn" : "consentSavedOff")),
            onError,
          })
        }
        onOpenStudent={(id) => router.push(`/teacher/students/${id}`)}
        onRetry={() => void (classes.error ? classes.refetch() : dash.refetch())}
      />
    </>
  );
}

async function copyCode(code: string, done: () => void) {
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    /* clipboard blocked: the code is on screen to read out */
  }
  done();
}

export function ClassesRoute() {
  const t = useBilingual("classes");
  const onError = useErrorToast();
  const { classes } = useSelectedClass();
  const create = useCreateClass();
  const setClassId = useClassStore((s) => s.setClassId);
  const [created, setCreated] = useState<Schemas["ClassroomOut"] | null>(null);
  return (
    <ClassesScreen
      classes={classes.data}
      loading={classes.isLoading}
      error={classes.error}
      onRetry={() => void classes.refetch()}
      creating={create.isPending}
      created={created}
      onCloseCreated={() => setCreated(null)}
      onCreate={(c) =>
        create.mutate(c, {
          onSuccess: (out) => {
            setCreated(out);
            setClassId(out.id);
            toast("success", t("createdToast", { name: out.name }));
          },
          onError,
        })
      }
      onCopy={(code) => void copyCode(code, () => toast("success", t("copied", { code })))}
    />
  );
}

export function ClassDetailRoute({ classId }: { classId: string }) {
  const t = useBilingual("classes");
  const router = useRouter();
  const { classes } = useSelectedClass();
  const setClassId = useClassStore((s) => s.setClassId);
  const dash = useDashboard(classId);
  const insights = useClassInsights(classId);
  const classroom = classes.data?.find((c) => c.id === classId) ?? null;
  const courses = useCourses();
  const toggle = useClassCourse(classId);
  const notes = useTeacherNotes();
  const delNote = useDeleteNote();
  const nt = useBilingual("notes");
  const onError = useErrorToast();
  return (
    <ClassDetailScreen
      notes={notes.data?.filter((n) => n.classroom_id === classId)}
      deletingNoteId={delNote.isPending ? delNote.variables : null}
      onDeleteNote={(note) => {
        if (!window.confirm(`${nt("deleteConfirm", { title: note.title }).regional}
${nt("deleteConfirm", { title: note.title }).english}`)) return;
        delNote.mutate(note.id, { onSuccess: () => toast("success", nt("deleted")), onError });
      }}
      onShareNotes={() => {
        setClassId(classId);
        router.push("/teacher/notes");
      }}
      onMakeCourse={() => {
        setClassId(classId);
        router.push("/teacher/courses/new");
      }}
      courses={courses.data}
      courseIds={dash.data?.courses.map((c) => c.id) ?? []}
      courseBusyId={toggle.isPending ? toggle.variables.courseId : null}
      onToggleCourse={(courseId, add) =>
        toggle.mutate({ courseId, add }, { onSuccess: () => toast("success", add ? t("courseAdded") : t("courseRemoved")), onError })
      }
      classroom={classroom}
      insights={insights.data}
      students={dash.data?.students}
      loading={classes.isLoading || dash.isLoading}
      error={
        classes.error ?? dash.error ?? (classes.data && !classroom ? new Error("NOT_FOUND") : null)
      }
      onRetry={() => void (classes.refetch(), dash.refetch(), insights.refetch())}
      onCopy={(code) => void copyCode(code, () => toast("success", t("copied", { code })))}
      onOpenStudent={(id) => {
        setClassId(classId);
        router.push(`/teacher/students/${id}`);
      }}
    />
  );
}

export function StudentsRoute() {
  const router = useRouter();
  const { classes, classId } = useSelectedClass();
  const dash = useDashboard(classId);
  const [filter, setFilter] = useState<StudentFilter>("all");
  const [sort, setSort] = useState<StudentSort>("name");
  const [query, setQuery] = useState("");
  return (
    <StudentsScreen
      rows={dash.data?.students}
      loading={classes.isLoading || dash.isLoading}
      error={classes.error ?? dash.error}
      noClasses={classes.data?.length === 0}
      filter={filter}
      sort={sort}
      query={query}
      onFilter={setFilter}
      onSort={setSort}
      onQuery={setQuery}
      onOpen={(id) => router.push(`/teacher/students/${id}`)}
      onRetry={() => void (classes.error ? classes.refetch() : dash.refetch())}
    />
  );
}

export function StudentDetailRoute({ studentId }: { studentId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const { classes, classId } = useSelectedClass();
  const detail = useStudentDetail(classId, studentId);
  return (
    <div className="flex flex-col gap-5">
    <StudentDetailScreen
      data={detail.data}
      loading={classes.isLoading || detail.isLoading}
      error={classes.error ?? detail.error}
      onBack={() => router.push("/teacher/students")}
      onRetry={() => void detail.refetch()}
      formatDate={(iso) =>
        new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "hi-IN", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata",
        }).format(new Date(iso))
      }
    />
    {detail.data && <StudentParentLinkCard classId={classId} studentId={studentId} name={detail.data.name} />}
    </div>
  );
}

export function CoursesRoute() {
  const courses = useCourses();
  const materials = useMaterials();
  const delUpload = useDeleteUpload();
  const mt = useBilingual("materials");
  const onDeleteError = useErrorToast();
  return (
    <>
      <MaterialsPanel
        items={materials.data}
        loading={materials.isLoading}
        error={materials.error}
        onRetry={() => void materials.refetch()}
        deletingId={delUpload.isPending ? delUpload.variables : null}
        onDelete={(m) => {
          if (!window.confirm(`${mt(m.course_id ? "deleteConfirmCourse" : "deleteConfirm").regional}
${mt(m.course_id ? "deleteConfirmCourse" : "deleteConfirm").english}`)) return;
          delUpload.mutate(m.id, { onSuccess: () => toast("success", mt("deleted")), onError: onDeleteError });
        }}
      />
      <CoursesScreen
        courses={courses.data}
        loading={courses.isLoading}
        error={courses.error}
        onRetry={() => void courses.refetch()}
      />
    </>
  );
}

export function CourseDetailRoute({ courseId }: { courseId: string }) {
  const t = useBilingual("teacher");
  const onError = useErrorToast();
  const course = useCourse(courseId);
  const { classes, classId } = useSelectedClass();
  const publish = usePublishLesson(courseId);
  const assign = useAssignCourse(courseId);
  const rename = useRenameCourse(courseId);
  return (
    <CourseDetailScreen
      course={course.data}
      loading={course.isLoading}
      error={course.error}
      classes={classes.data ?? []}
      publishingId={publish.isPending ? (publish.variables?.lessonId ?? null) : null}
      assigning={assign.isPending}
      renaming={rename.isPending}
      onPublish={(lessonId) => {
        if (publish.isPending) return; // one publish at a time: no double taps
        publish.mutate(
          { lessonId, classroomId: course.data?.is_personal ? null : classId || null },
          { onSuccess: () => toast("success", t("published")), onError },
        );
      }}
      onAssign={(ids, dueAt) =>
        assign.mutate(
          { classroom_ids: ids, due_at: dueAt },
          { onSuccess: () => toast("success", t("assigned")), onError },
        )
      }
      onRename={(en) => {
        const cur = (course.data?.title ?? {}) as Partial<Tri>;
        rename.mutate(
          { en, hi: cur.en === en ? (cur.hi ?? en) : en, kn: cur.en === en ? (cur.kn ?? en) : en },
          { onError },
        );
      }}
      onRetry={() => void course.refetch()}
    />
  );
}

export function LessonReviewRoute({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const t = useBilingual("teacher");
  const onError = useErrorToast();
  const lesson = useReviewLesson(lessonId);
  const { classId } = useSelectedClass();
  const course = useCourse(courseId);
  const save = useSaveQuestion(lessonId, courseId);
  const reject = useRejectQuestion(lessonId, courseId);
  const regen = useRegenerateQuestion(lessonId, courseId);
  const publish = usePublishLesson(courseId);
  const terms = (lesson.data?.terms ?? {}) as TermMap;
  const busyId = save.isPending
    ? save.variables.id
    : reject.isPending
      ? reject.variables
      : regen.isPending
        ? regen.variables
        : null;
  return (
    <LessonReviewScreen
      courseId={courseId}
      title={(lesson.data?.title as Tri | undefined) ?? null}
      items={lesson.data ? reviewItems(lesson.data) : undefined}
      optionLabels={(item) => optionLabels(item, terms)}
      published={Boolean(lesson.data?.published)}
      block={lesson.data ? publishBlock(lesson.data) : "notReady"}
      loading={lesson.isLoading}
      error={lesson.error}
      busyId={busyId}
      publishing={publish.isPending}
      onSave={async (item, question) => {
        try {
          await save.mutateAsync({ id: item.id, question });
          toast("success", t("questionSaved"));
          return true;
        } catch (e) {
          onError(e);
          return false;
        }
      }}
      onApprove={(item) =>
        save.mutate(
          { id: item.id, question: item.content },
          { onSuccess: () => toast("success", t("questionApproved")), onError },
        )
      }
      onReject={(item) =>
        reject.mutate(item.id, { onSuccess: () => toast("info", t("questionRejected")), onError })
      }
      onRegenerate={(item) =>
        regen.mutate(item.id, {
          onSuccess: () => toast("success", t("questionRegenerated")),
          onError,
        })
      }
      onPublish={() => {
        if (publish.isPending || lesson.data?.published) return;
        publish.mutate(
          { lessonId, classroomId: course.data?.is_personal ? null : classId || null },
          { onSuccess: () => toast("success", t("published")), onError },
        );
      }}
      onRetry={() => void lesson.refetch()}
    />
  );
}

let pageSeq = 0;

export function UploadRoute() {
  const t = useBilingual("teacher");
  const { classes, classId } = useSelectedClass();
  const upload = useUpload();
  const [pages, setPages] = useState<PageDraft[]>([]);
  const [typed, setTyped] = useState("");
  const [meta, setMeta] = useState<UploadMeta | null>(null);
  const current: UploadMeta = meta ?? {
    subject: classes.data?.find((c) => c.id === classId)?.subject ?? "BI",
    grade: classes.data?.find((c) => c.id === classId)?.grade ?? 9,
    classroomId: classId || null,
  };
  return (
    <UploadScreen
      pages={pages}
      meta={current}
      classes={classes.data ?? []}
      typed={typed}
      run={upload.run}
      pollError={upload.pollError}
      onTyped={setTyped}
      onAddTyped={() => {
        setPages((x) => [
          ...x,
          {
            key: `p${pageSeq++}`,
            kind: "text",
            name: `${t("typedPage").english}: ${typed.trim().slice(0, 40)}`,
            size: typed.length,
            text: typed,
          },
        ]);
        setTyped("");
      }}
      onFiles={(files) => {
        const drafts = files.map((f) => {
          const kind = kindForFile(f);
          return {
            key: `p${pageSeq++}`,
            kind: kind ?? "photo",
            name: f.name,
            size: f.size,
            file: kind === "text" ? undefined : f,
            unsupported: !kind,
          } satisfies PageDraft;
        });
        setPages((x) => [...x, ...drafts]);
        // Text documents: read the words in, so they upload as a typed page.
        drafts.forEach((d, i) => {
          if (d.kind !== "text") return;
          void files[i]!.text().then((text) =>
            setPages((x) => x.map((p) => (p.key === d.key ? { ...p, text } : p))),
          );
        });
      }}
      onRemove={(key) => setPages((x) => x.filter((p) => p.key !== key))}
      onMeta={setMeta}
      onSubmit={() => void upload.submit(pages, current)}
      onRetryPage={(i) => void upload.retryPage(i)}
      onRetryStart={() => void upload.retryStart()}
      onReset={() => {
        upload.reset();
        setPages([]);
      }}
    />
  );
}
