"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CallStudent } from "@mooshala/api-client";
import { toast } from "@/components/ui";
import { useSelectedClass } from "@/features/teacher/api";
import { asApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { AddCallStudentScreen } from "./AddCallStudentScreen";
import { useAddCallStudent, useCallStudents, useDemoClock, useLiveCall, usePatchCallStudent, useTwin } from "./api";
import { CallsScreen } from "./CallsScreen";
import { CALL_RULES, draftProblems, normalizePhone, type CallStudentDraft } from "./rules";

const useFormatDateTime = () => {
  const locale = useLocale();
  return (iso: string) =>
    new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "hi-IN", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
};

export function CallsRoute() {
  const t = useBilingual("calls");
  const errors = useBilingual("errors");
  const fmt = useFormatDateTime();
  const { classes, classId } = useSelectedClass();
  const list = useCallStudents(classId);
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? list.data?.[0]?.id ?? null;
  const live = useLiveCall(classId, selectedId);
  const twin = useTwin(selectedId);
  const patch = usePatchCallStudent(classId);
  const demo = useDemoClock(classId);
  const [callError, setCallError] = useState<unknown>(null);
  const onError = (e: unknown) => toast("error", errors(asApiError(e).code));
  return (
    <CallsScreen
      students={list.data}
      loading={classes.isLoading || list.isLoading}
      error={classes.error ?? list.error}
      noClasses={classes.data?.length === 0}
      selectedId={selectedId}
      call={live.call}
      starting={live.starting}
      callError={callError ?? live.pollError}
      twin={twin.data}
      twinLoading={twin.isLoading}
      twinError={twin.error}
      pausingId={patch.isPending ? patch.variables.id : null}
      demo={
        env.useFakes
          ? {
              now: demo.data?.now ?? null,
              busy: demo.isPending,
              onEvening: () => demo.mutate("evening", { onSuccess: () => toast("info", t("demoMoved")) }),
              onReal: () => demo.mutate("real"),
            }
          : null
      }
      onSelect={(id) => {
        setPicked(id);
        setCallError(null);
      }}
      onCallNow={(id) => {
        setCallError(null);
        live.callNow(id, setCallError);
      }}
      onTogglePause={(s: CallStudent) =>
        patch.mutate({ id: s.id, patch: { paused: s.status !== "paused" } }, { onSuccess: (out) => toast("info", out.status === "paused" ? t("pausedToast") : t("resumedToast")), onError })
      }
      onRetry={() => void (classes.error ? classes.refetch() : list.refetch())}
      formatDateTime={fmt}
    />
  );
}

export const emptyDraft = (language: "hindi" | "kannada" = "hindi"): CallStudentDraft => ({ name: "", phone: "", language, window: { ...CALL_RULES.defaultWindow }, days: [...CALL_RULES.allowedDays] });

export function AddCallStudentRoute() {
  const t = useBilingual("calls");
  const router = useRouter();
  const { classId, classroom } = useSelectedClass();
  const add = useAddCallStudent(classId);
  const [draft, setDraft] = useState<CallStudentDraft>(() => emptyDraft());
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [showProblems, setShowProblems] = useState(false);
  const problems = draftProblems(draft);
  return (
    <AddCallStudentScreen
      draft={draft}
      step={step}
      problems={problems}
      showProblems={showProblems}
      classroomName={classroom?.name ?? ""}
      saving={add.isPending}
      saveError={add.error}
      onDraft={(d) => {
        setDraft(d);
        if (add.error) add.reset();
      }}
      onNext={() => {
        setShowProblems(true);
        if (Object.keys(problems).length === 0 && classId) setStep("confirm");
      }}
      onBack={() => setStep("form")}
      onConfirm={() => {
        if (add.isPending) return;
        add.mutate(
          { name: draft.name.trim(), parent_phone: normalizePhone(draft.phone)!, language: draft.language, window: draft.window, days: draft.days },
          {
            onSuccess: (s) => {
              toast("success", t("added", { name: s.name }));
              router.push("/teacher/calls");
            },
            // Duplicate phone and validation errors are fixed on the form.
            onError: () => setStep("form"),
          },
        );
      }}
    />
  );
}
