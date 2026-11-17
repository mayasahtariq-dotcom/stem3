"use client";
import Link from "next/link";
import { useState } from "react";
import { BilingualText, Card, ChunkyButton, Dialog, EmptyState, ErrorState, LoadingState, SourceChip, StickerIcon } from "@/components/ui";
import type { Tri } from "@/lib/i18n/use-tri";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { draftProblem, draftToQuestion, isFlagged, LOW_CONFIDENCE, toDraft, type PublishBlock, type QuestionDraft, type ReviewItem } from "./review";
import { PageTitle, Pill, pct } from "./shared";

export interface LessonReviewScreenProps {
  courseId: string;
  title: Tri | null;
  items: ReviewItem[] | undefined;
  optionLabels: (item: ReviewItem) => Tri[];
  published: boolean;
  block: PublishBlock;
  loading: boolean;
  error: unknown;
  /** question id with a request in flight */
  busyId: string | null;
  publishing: boolean;
  onSave: (item: ReviewItem, question: Record<string, unknown>) => Promise<boolean>;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
  onRegenerate: (item: ReviewItem) => void;
  onPublish: () => void;
  onRetry: () => void;
}

const TYPE_ICON = { multiple_choice: "puzzle", true_false: "sparkle", fill_formula: "flask", match_pairs: "copy" } as const;

export function LessonReviewScreen(p: LessonReviewScreenProps) {
  const t = useBilingual("teacher");
  const c = useBilingual("common");
  const tri = useTri();
  const [editing, setEditing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.items || !p.title) return <LoadingState className="min-h-[50vh]" />;
  const flagged = p.items.filter(isFlagged).length;
  const blockMsg = p.block ? t(`block_${p.block}`) : null;
  return (
    <div className="flex flex-col gap-5">
      <ChunkyButton asChild size="sm" variant="ghost" className="self-start">
        <Link href={`/teacher/courses/${p.courseId}`}>
          <BilingualText as="span" size="sm" text={t("backToCourse")} />
        </Link>
      </ChunkyButton>
      <PageTitle text={tri(p.title)} icon="pencil" />
      <Card className="flex flex-wrap items-center gap-3" aria-live="polite">
        <StickerIcon name={p.published ? "party" : flagged ? "warn" : "sparkle"} size={32} />
        <BilingualText
          className="flex-1"
          text={p.published ? t("lessonLive") : flagged ? t("flaggedLeft", { n: flagged }) : blockMsg ?? t("readyToPublish")}
        />
        {p.published ? (
          <Pill tone="good">{t("statusPublished").regional}</Pill>
        ) : (
          <ChunkyButton onClick={p.onPublish} disabled={Boolean(p.block)} loading={p.publishing} data-testid="publish-lesson">
            <BilingualText as="span" size="sm" tone="inverse" text={t("publish")} />
          </ChunkyButton>
        )}
      </Card>
      {p.items.length === 0 ? (
        <EmptyState message={t("noQuestionsLeft")} />
      ) : (
        <ol className="flex flex-col gap-3">
          {p.items.map((item) => (
            <li key={item.id} data-testid={`question-${item.id}`}>
              <Card className={cn("flex flex-col gap-3", isFlagged(item) && "border-coral")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-sun-soft font-extrabold">{item.position}</span>
                  <StickerIcon name={TYPE_ICON[item.type]} size={22} />
                  <BilingualText as="span" size="sm" text={t(`type_${item.type}`)} />
                  <SourceChip label={t("page", { n: item.sourcePage }).regional} />
                  {item.edited && <Pill tone="info">{t("edited").regional}</Pill>}
                  {item.confidence < LOW_CONFIDENCE && <Pill tone="warn">{t("confidence", { n: pct(item.confidence) }).regional}</Pill>}
                </div>
                {isFlagged(item) && (
                  <p role="note" className="flex items-start gap-2 rounded-card bg-coral/10 p-3 text-sm font-semibold">
                    <StickerIcon name="warn" size={20} />
                    <span>
                      {t("flagReason").regional}: {item.flagReason}
                    </span>
                  </p>
                )}
                {editing === item.id ? (
                  <QuestionEditor
                    item={item}
                    options={p.optionLabels(item)}
                    saving={p.busyId === item.id}
                    onCancel={() => setEditing(null)}
                    onSave={async (q) => {
                      if (await p.onSave(item, q)) setEditing(null);
                    }}
                  />
                ) : (
                  <>
                    <BilingualText size="lg" text={tri(item.prompt)} />
                    <div className="rounded-card bg-grass/10 p-3">
                      <BilingualText as="span" size="sm" text={t("correctAnswer")} className="text-stone" />
                      <BilingualText text={tri(item.answer)} />
                    </div>
                    <BilingualText size="sm" text={tri(item.explanation)} className="text-stone" />
                    <div className="flex flex-wrap gap-2">
                      {isFlagged(item) && (
                        <ChunkyButton size="sm" onClick={() => p.onApprove(item)} loading={p.busyId === item.id} disabled={p.busyId !== null} data-testid="approve-question">
                          <BilingualText as="span" size="sm" tone="inverse" text={t("approve")} />
                        </ChunkyButton>
                      )}
                      <ChunkyButton size="sm" variant="white" onClick={() => setEditing(item.id)} disabled={p.busyId !== null} data-testid="edit-question">
                        <StickerIcon name="pencil" size={18} />
                        <BilingualText as="span" size="sm" text={t("edit")} />
                      </ChunkyButton>
                      <ChunkyButton size="sm" variant="white" onClick={() => p.onRegenerate(item)} disabled={p.busyId !== null}>
                        <StickerIcon name="refresh" size={18} />
                        <BilingualText as="span" size="sm" text={t("regenerate")} />
                      </ChunkyButton>
                      <ChunkyButton size="sm" variant="ghost" onClick={() => setRejecting(item)} disabled={p.busyId !== null} data-testid="reject-question">
                        <StickerIcon name="trash" size={18} />
                        <BilingualText as="span" size="sm" text={t("reject")} />
                      </ChunkyButton>
                    </div>
                  </>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}
      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={t("rejectTitle")}
        description={t("rejectHint")}
        actions={
          <>
            <ChunkyButton size="sm" variant="ghost" onClick={() => setRejecting(null)}>
              <BilingualText as="span" size="sm" text={c("cancel")} />
            </ChunkyButton>
            <ChunkyButton
              size="sm"
              onClick={() => {
                if (rejecting) p.onReject(rejecting);
                setRejecting(null);
              }}
              data-testid="confirm-reject"
            >
              <BilingualText as="span" size="sm" tone="inverse" text={t("reject")} />
            </ChunkyButton>
          </>
        }
      />
    </div>
  );
}

function TriFields({ label, value, onChange, multiline }: { label: string; value: Tri; onChange: (v: Tri) => void; multiline?: boolean }) {
  const Field = multiline ? "textarea" : "input";
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      {(["en", "hi", "kn"] as const).map((k) => (
        <label key={k} className="flex items-start gap-2 text-sm">
          <span className="w-8 pt-3 font-bold uppercase text-stone">{k}</span>
          <Field
            value={value[k]}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value })}
            lang={k}
            className="min-h-11 flex-1 rounded-button border-2 border-line bg-white px-3 py-2"
            aria-label={`${label} (${k})`}
          />
        </label>
      ))}
    </fieldset>
  );
}

function QuestionEditor({ item, options, saving, onSave, onCancel }: { item: ReviewItem; options: Tri[]; saving: boolean; onSave: (q: Record<string, unknown>) => void; onCancel: () => void }) {
  const t = useBilingual("teacher");
  const c = useBilingual("common");
  const tri = useTri();
  const [d, setD] = useState<QuestionDraft>(() => toDraft(item));
  const problem = draftProblem(d, item);
  const set = (patch: Partial<QuestionDraft>) => setD((x) => ({ ...x, ...patch }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem) onSave(draftToQuestion(d, item));
      }}
    >
      {d.type !== "true_false" && <TriFields label={t("fieldPrompt").regional} value={d.prompt} onChange={(prompt) => set({ prompt })} />}
      {d.type === "true_false" && (
        <>
          <TriFields label={t("fieldStatement").regional} value={d.statement} onChange={(statement) => set({ statement })} />
          <fieldset className="flex gap-4">
            <legend className="mb-1 text-sm font-bold">{t("correctAnswer").regional}</legend>
            {[true, false].map((v) => (
              <label key={String(v)} className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="radio" name={`tf-${item.id}`} checked={d.answerBool === v} onChange={() => set({ answerBool: v })} className="h-5 w-5" />
                {(v ? t("true") : t("false")).regional}
              </label>
            ))}
          </fieldset>
        </>
      )}
      {d.type === "multiple_choice" && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-bold">{t("correctAnswer").regional}</legend>
          {options.map((o, i) => (
            <label key={i} className="flex min-h-11 items-center gap-2">
              <input type="radio" name={`mc-${item.id}`} checked={d.correctIndex === i} onChange={() => set({ correctIndex: i })} className="h-5 w-5" />
              <BilingualText as="span" size="sm" text={tri(o)} />
            </label>
          ))}
        </fieldset>
      )}
      {d.type === "fill_formula" && (
        <>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t("fieldFormula").regional}
            <input value={d.formula} onChange={(e) => set({ formula: e.target.value })} className="min-h-11 rounded-button border-2 border-line bg-white px-3 font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t("correctAnswer").regional}
            <select value={d.answerChip} onChange={(e) => set({ answerChip: e.target.value })} className="min-h-11 rounded-button border-2 border-line bg-white px-3">
              {((item.content.chips ?? []) as string[]).map((chip) => (
                <option key={chip}>{chip}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {d.type === "match_pairs" && <BilingualText size="sm" text={t("pairsFixed")} className="text-stone" />}
      <TriFields label={t("fieldExplanation").regional} value={d.explanation} onChange={(explanation) => set({ explanation })} multiline />
      {problem && (
        <p role="alert" className="text-sm font-bold text-coral-strong">
          {t(`problem_${problem}`).regional} · {t(`problem_${problem}`).english}
        </p>
      )}
      <div className="flex gap-2">
        <ChunkyButton type="submit" size="sm" disabled={Boolean(problem)} loading={saving} data-testid="save-question">
          <BilingualText as="span" size="sm" tone="inverse" text={c("save")} />
        </ChunkyButton>
        <ChunkyButton size="sm" variant="ghost" onClick={onCancel}>
          <BilingualText as="span" size="sm" text={c("cancel")} />
        </ChunkyButton>
      </div>
    </form>
  );
}
