"use client";
import Link from "next/link";
import { BilingualText, Card, ChunkyButton, TextField } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { CALL_RULES, DAY_KEYS, formatTime, normalizePhone, type CallStudentDraft, type DraftField, type DraftProblem } from "./rules";

export interface AddCallStudentScreenProps {
  draft: CallStudentDraft;
  step: "form" | "confirm";
  /** problems are only shown after the first "Next" */
  problems: Partial<Record<DraftField, DraftProblem>>;
  showProblems: boolean;
  classroomName: string;
  saving: boolean;
  saveError: unknown;
  onDraft: (d: CallStudentDraft) => void;
  onNext: () => void;
  onBack: () => void;
  onConfirm: () => void;
}

/** "Add student without app": details, then a confirmation step before anything is saved. */
export function AddCallStudentScreen(p: AddCallStudentScreenProps) {
  const t = useBilingual("calls");
  const errors = useBilingual("errors");
  const d = p.draft;
  const err = (f: DraftField) => (p.showProblems && p.problems[f] ? t(`problem_${p.problems[f]}`) : null);
  const serverCode = p.saveError ? asApiError(p.saveError).code : null;
  const phoneError = serverCode === "DUPLICATE_PHONE" ? errors("DUPLICATE_PHONE") : err("phone");
  const set = (patch: Partial<CallStudentDraft>) => p.onDraft({ ...d, ...patch });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ChunkyButton asChild size="sm" variant="ghost" className="self-start">
        <Link href="/teacher/calls">
          <BilingualText as="span" size="sm" text={t("backToCalls")} />
        </Link>
      </ChunkyButton>
      <BilingualText as="h1" size="2xl" text={t("addTitle")} />
      <BilingualText size="sm" text={t("addHint", { cls: p.classroomName })} className="text-stone" />

      {p.step === "form" ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onNext();
          }}
        >
          <Card className="flex flex-col gap-4">
            <TextField label={t("studentName")} value={d.name} onChange={(e) => set({ name: e.target.value })} error={err("name")} autoComplete="off" data-testid="cs-name" />
            <TextField label={t("parentPhone")} prefix="+91" inputMode="numeric" value={d.phone} onChange={(e) => set({ phone: e.target.value })} error={phoneError} hint={t("phoneHint")} data-testid="cs-phone" />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1">
                <BilingualText as="span" size="sm" text={t("language")} />
              </legend>
              <div className="flex flex-wrap gap-4">
                {(["hindi", "kannada"] as const).map((l) => (
                  <label key={l} className="flex min-h-11 items-center gap-2 font-semibold">
                    <input type="radio" name="cs-lang" className="h-5 w-5" checked={d.language === l} onChange={() => set({ language: l })} />
                    {t(`lang_${l}`).regional} · {t(`lang_${l}`).english}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1">
                <BilingualText as="span" size="sm" text={t("window")} />
              </legend>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 font-semibold">
                  {t("from").regional}
                  <input type="time" step={900} min={CALL_RULES.earliest} max={CALL_RULES.latest} value={d.window.start} onChange={(e) => set({ window: { ...d.window, start: e.target.value } })} className="min-h-11 rounded-button border-2 border-line bg-white px-3" aria-label={t("from").english} data-testid="cs-start" />
                </label>
                <label className="flex items-center gap-2 font-semibold">
                  {t("to").regional}
                  <input type="time" step={900} min={CALL_RULES.earliest} max={CALL_RULES.latest} value={d.window.end} onChange={(e) => set({ window: { ...d.window, end: e.target.value } })} className="min-h-11 rounded-button border-2 border-line bg-white px-3" aria-label={t("to").english} data-testid="cs-end" />
                </label>
              </div>
              <BilingualText size="sm" text={t("windowHint")} className="text-stone" />
              {err("window") && (
                <p role="alert" className="text-sm font-bold text-coral-strong">
                  {err("window")!.regional} · {err("window")!.english}
                </p>
              )}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1">
                <BilingualText as="span" size="sm" text={t("days")} />
              </legend>
              <div className="flex flex-wrap gap-3">
                {CALL_RULES.allowedDays.map((day) => (
                  <label key={day} className="flex min-h-11 items-center gap-2 font-semibold">
                    <input type="checkbox" className="h-5 w-5" checked={d.days.includes(day)} onChange={(e) => set({ days: e.target.checked ? [...d.days, day].sort() : d.days.filter((x) => x !== day) })} />
                    {t(DAY_KEYS[day]!).regional}
                  </label>
                ))}
              </div>
              <BilingualText size="sm" text={t("noSunday")} className="text-stone" />
              {err("days") && (
                <p role="alert" className="text-sm font-bold text-coral-strong">
                  {err("days")!.regional} · {err("days")!.english}
                </p>
              )}
            </fieldset>
          </Card>
          {serverCode && serverCode !== "DUPLICATE_PHONE" && (
            <p role="alert" className="font-bold text-coral-strong">
              {errors(serverCode).regional} · {errors(serverCode).english}
            </p>
          )}
          <ChunkyButton type="submit" block data-testid="cs-next">
            <BilingualText as="span" tone="inverse" text={t("next")} />
          </ChunkyButton>
        </form>
      ) : (
        <Card className="flex flex-col gap-3" data-testid="cs-confirm">
          <BilingualText as="h2" size="lg" text={t("confirmTitle")} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-bold">{t("studentName").regional}</dt>
            <dd>{d.name.trim()}</dd>
            <dt className="font-bold">{t("parentPhone").regional}</dt>
            <dd>{normalizePhone(d.phone)}</dd>
            <dt className="font-bold">{t("language").regional}</dt>
            <dd>{t(`lang_${d.language}`).regional}</dd>
            <dt className="font-bold">{t("window").regional}</dt>
            <dd>
              {formatTime(d.window.start)} – {formatTime(d.window.end)}
            </dd>
            <dt className="font-bold">{t("days").regional}</dt>
            <dd>{d.days.map((x) => t(DAY_KEYS[x]!).regional).join(", ")}</dd>
          </dl>
          <BilingualText size="sm" text={t("confirmHint")} />
          <div className="flex flex-wrap gap-2">
            <ChunkyButton onClick={p.onConfirm} loading={p.saving} data-testid="cs-confirm-save">
              <BilingualText as="span" size="sm" tone="inverse" text={t("confirmSave")} />
            </ChunkyButton>
            <ChunkyButton variant="ghost" onClick={p.onBack} disabled={p.saving}>
              <BilingualText as="span" size="sm" text={t("edit")} />
            </ChunkyButton>
          </div>
        </Card>
      )}
    </div>
  );
}
