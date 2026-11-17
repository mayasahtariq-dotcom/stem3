"use client";
import { toast } from "@/components/ui";
import { useSelectedClass } from "@/features/teacher/api";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { readAsDataUrl, useMyNotes, useShareNote, useTeacherNotes } from "./api";
import { StudentNotesScreen, TeacherNotesScreen, type NoteDraft } from "./NotesScreens";

export function TeacherNotesRoute() {
  const t = useBilingual("notes");
  const errors = useBilingual("errors");
  const { classes, classId } = useSelectedClass();
  const notes = useTeacherNotes();
  const share = useShareNote();
  const onShare = async (d: NoteDraft) => {
    try {
      const file = d.file ? { name: d.file.name, type: d.file.type || "application/octet-stream", data_url: await readAsDataUrl(d.file) } : null;
      await share.mutateAsync({ classId: d.classId, note: { title: d.title.trim(), body: d.body.trim(), file } });
      toast("success", t("sharedToast"));
      return true;
    } catch (e) {
      toast("error", errors(asApiError(e).code));
      return false;
    }
  };
  return (
    <TeacherNotesScreen
      classes={classes.data}
      notes={notes.data}
      loading={classes.isLoading || notes.isLoading}
      error={classes.error ?? notes.error}
      onRetry={() => {
        void classes.refetch();
        void notes.refetch();
      }}
      defaultClassId={classId}
      sharing={share.isPending}
      onShare={onShare}
    />
  );
}

export function StudentNotesRoute() {
  const q = useMyNotes();
  return <StudentNotesScreen notes={q.data} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} />;
}
