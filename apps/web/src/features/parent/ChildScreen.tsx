"use client";
import Link from "next/link";
import { useState } from "react";
import type { Schemas } from "@mooshala/api-client";
import { IconBubble } from "@/components/playful";
import { BilingualText, Card, ChunkyButton, Dialog, ErrorState, LoadingState, Pill, StickerIcon, type StickerIconName } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { achievements, consentTone, farmPicture } from "./progress-view";

export interface ChildScreenProps {
  data: Schemas["ChildDashboard"] | undefined;
  loading: boolean;
  error: unknown;
  consentBusy: boolean;
  removing: boolean;
  deletion: Schemas["DeletionOut"] | null;
  speaking: boolean;
  onApprove: () => void;
  onRevoke: () => void;
  onUnlink: () => void;
  onDelete: () => void;
  onListen: (text: string) => void;
  onRetry: () => void;
  formatDate: (iso: string) => string;
}

const SUBJECT = { BI: "subjectBI", CH: "subjectCH", PH: "subjectPH" } as const;
const ACH_ICON: Record<string, StickerIconName> = { streak3: "flame", streak7: "trophy", lessons3: "book", accuracy80: "target", allDone: "party" };

/** One child: consent first, then this week, accuracy, subjects, assignments, the spoken summary and the farm picture. */
export function ChildScreen(p: ChildScreenProps) {
  const t = useBilingual("parent");
  const c = useBilingual("common");
  const tri = useTri();
  const [confirm, setConfirm] = useState<"revoke" | "unlink" | "delete" | null>(null);
  const back = (
    <ChunkyButton asChild size="sm" variant="ghost" className="self-start">
      <Link href="/parent">
        <BilingualText as="span" size="sm" text={t("backToChildren")} />
      </Link>
    </ChunkyButton>
  );
  if (p.error) return <div className="flex flex-col gap-3">{back}<ErrorState error={p.error} onRetry={p.onRetry} /></div>;
  if (p.loading || !p.data) return <LoadingState className="min-h-[50vh]" />;
  const d = p.data;
  const status = d.child.consent_status as "pending" | "approved" | "revoked";
  const farm = farmPicture(d);
  const summary = tri(d.summary);
  const arrowIcon = { up: "↑", down: "↓", same: "→" }[d.week.arrow];
  const confirmText = confirm && { title: t(`confirm_${confirm}`), body: t(`confirm_${confirm}_hint`) };

  return (
    <div className="flex flex-col gap-4">
      {back}
      <header className="relative flex items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#e3dbff] via-[#efeaff] to-[#f7f5ff] p-4 shadow-[0_8px_22px_rgb(80_60_160/0.10)]">
        <IconBubble icon="backpack" pastel="lavender" size={36} />
        <h1 className="text-3xl font-extrabold">{d.child.name}</h1>
        <span className="ml-auto">
          <Pill tone={consentTone(status)}>{t(`consent_${status}`).regional}</Pill>
        </span>
      </header>

      <Card className={cn("flex flex-col gap-3", status !== "approved" && "border-sun bg-sun-soft")} data-testid="consent-card">
        <BilingualText as="h2" size="lg" text={t("consentTitle")} />
        <BilingualText size="sm" text={t(`consentBody_${status}`, { name: d.child.name })} />
        {p.deletion && <BilingualText size="sm" text={t("deletionRequested", { date: p.formatDate(p.deletion.complete_by) })} className="font-bold" />}
        {status !== "approved" ? (
          <ChunkyButton onClick={p.onApprove} loading={p.consentBusy} data-testid="approve-consent" className="self-start">
            <BilingualText as="span" size="sm" tone="inverse" text={t("iApprove")} />
          </ChunkyButton>
        ) : (
          <ChunkyButton variant="white" size="sm" onClick={() => setConfirm("revoke")} disabled={p.consentBusy} className="self-start" data-testid="revoke-consent">
            <BilingualText as="span" size="sm" text={t("revoke")} />
          </ChunkyButton>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BilingualText as="h2" size="lg" text={t("summaryTitle")} className="flex-1" />
          <ChunkyButton size="sm" variant="white" onClick={() => p.onListen(summary.regional)} loading={p.speaking} data-testid="listen-summary">
            <StickerIcon name="speaker" size={18} />
            <BilingualText as="span" size="sm" text={t("listen")} />
          </ChunkyButton>
        </div>
        <BilingualText text={summary} />
      </Card>

      {!d.has_activity ? (
        <Card>
          <BilingualText text={t("noActivity", { name: d.child.name })} />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3" aria-label={t("thisWeek").english}>
            <Card className="p-4">
              <p className="text-2xl font-extrabold tabular-nums">
                {d.week.lessons_this_week} <span aria-hidden>{arrowIcon}</span>
              </p>
              <BilingualText size="sm" text={t("lessonsThisWeek", { last: d.week.lessons_last_week })} />
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-extrabold tabular-nums">{d.week.minutes_this_week}</p>
              <BilingualText size="sm" text={t("minutes")} />
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-1 text-2xl font-extrabold tabular-nums">
                <StickerIcon name="flame" size={24} /> {d.week.streak}
              </p>
              <BilingualText size="sm" text={t("streak")} />
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-extrabold tabular-nums">{d.accuracy.this_week === null ? "–" : `${Math.round(d.accuracy.this_week * 100)}%`}</p>
              <BilingualText size="sm" text={t(`word_${d.accuracy.word}`)} />
            </Card>
          </section>

          {d.subjects.length > 0 && (
            <Card className="flex flex-col gap-3">
              <BilingualText as="h2" size="lg" text={t("supportAreas")} />
              <ul className="flex flex-col gap-2">
                {d.subjects.map((s) => (
                  <li key={s.subject} className="flex flex-col gap-1">
                    <BilingualText as="span" size="sm" text={t(SUBJECT[s.subject as keyof typeof SUBJECT] ?? "subjectBI")} className="font-bold" />
                    {s.strongest && <BilingualText size="sm" text={t("strongest", { topic: tri(s.strongest).regional, topicEn: tri(s.strongest).english })} />}
                    {s.weakest && <BilingualText size="sm" text={t("needsPractice", { topic: tri(s.weakest).regional, topicEn: tri(s.weakest).english })} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <BilingualText as="h2" size="lg" text={t("achievements")} />
            <ul className="grid grid-cols-2 gap-2 tablet:grid-cols-3">
              {achievements(d).map((a) => (
                <li key={a.key} className={cn("flex items-center gap-2 rounded-card p-2", a.earned ? "bg-white" : "border-2 border-dashed border-line bg-cloud")}>
                  <StickerIcon name={a.earned ? ACH_ICON[a.key]! : "lock"} size={24} />
                  <BilingualText as="span" size="sm" text={t(`ach_${a.key}`)} />
                  <span className="sr-only">{a.earned ? t("earned").english : t("notYet").english}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card className="flex flex-col gap-3">
        <BilingualText as="h2" size="lg" text={t("assignments")} />
        {d.assignments.length === 0 ? (
          <BilingualText size="sm" text={t("noAssignments")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {d.assignments.map((a) => (
              <li key={`${a.course_id}-${a.classroom}`} className="flex flex-wrap items-center gap-2">
                <BilingualText as="span" size="sm" text={tri(a.title)} className="flex-1" />
                <span className="text-sm text-stone">{a.classroom}</span>
                {a.due_at && <span className="text-sm">{t("due", { date: p.formatDate(a.due_at) }).regional}</span>}
                <Pill tone={a.status === "done" ? "good" : a.status === "overdue" ? "warn" : "info"}>{t(`status_${a.status}`).regional}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-2" data-testid="farm-picture">
        <BilingualText as="h2" size="lg" text={t("farmTitle", { name: d.child.name })} />
        <BilingualText size="sm" text={t("farmHint")} className="text-stone" />
        <div className="relative h-28 overflow-hidden rounded-card bg-gradient-to-b from-sky-soft to-meadow" role="img" aria-label={t("farmAlt", { crops: farm.crops, flowers: farm.flowers }).english}>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-around px-3 pb-2">
            {Array.from({ length: Math.max(1, farm.crops) }, (_, i) => (
              <StickerIcon key={`c${i}`} name={farm.crops ? (farm.plant === "thirsty" ? "leaf" : "corn") : "seeds"} size={farm.plant === "growing" ? 40 : 32} />
            ))}
          </div>
          <div className="absolute left-3 top-2 flex gap-1">
            {Array.from({ length: farm.flowers }, (_, i) => (
              <StickerIcon key={`f${i}`} name="sprout" size={20} />
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <BilingualText as="h2" size="lg" text={t("privacyTitle")} />
        <div className="flex flex-wrap gap-2">
          <ChunkyButton size="sm" variant="white" onClick={() => setConfirm("unlink")} loading={p.removing}>
            <BilingualText as="span" size="sm" text={t("unlink")} />
          </ChunkyButton>
          <ChunkyButton size="sm" variant="ghost" onClick={() => setConfirm("delete")} disabled={Boolean(p.deletion)} data-testid="request-deletion">
            <StickerIcon name="trash" size={18} />
            <BilingualText as="span" size="sm" text={t("deleteData")} />
          </ChunkyButton>
        </div>
      </Card>

      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirmText ? confirmText.title : t("confirm_revoke")}
        description={confirmText ? confirmText.body : undefined}
        actions={
          <>
            <ChunkyButton size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              <BilingualText as="span" size="sm" text={c("cancel")} />
            </ChunkyButton>
            <ChunkyButton
              size="sm"
              data-testid="confirm-action"
              onClick={() => {
                if (confirm === "revoke") p.onRevoke();
                if (confirm === "unlink") p.onUnlink();
                if (confirm === "delete") p.onDelete();
                setConfirm(null);
              }}
            >
              <BilingualText as="span" size="sm" tone="inverse" text={t("yesContinue")} />
            </ChunkyButton>
          </>
        }
      />
    </div>
  );
}
