"use client";
import Link from "next/link";
import type { Schemas } from "@mooshala/api-client";
import { Hero, IconBubble } from "@/components/playful";
import { BilingualText, Card, ChunkyButton, EmptyState, ErrorState, GoluMascot, LoadingState, Pill, SpeechBubble, TextField } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { consentTone } from "./progress-view";

export interface ParentHomeScreenProps {
  kids: Schemas["ChildOut"][] | undefined;
  loading: boolean;
  error: unknown;
  code: string;
  preview: Schemas["ChildPreview"] | undefined;
  previewLoading: boolean;
  previewError: unknown;
  linking: boolean;
  linkError: unknown;
  onCode: (code: string) => void;
  onLink: () => void;
  onCancelLink: () => void;
  onRetry: () => void;
}

/** Parent home: linked children with their consent status, and linking a child by code. */
export function ParentHomeScreen(p: ParentHomeScreenProps) {
  const t = useBilingual("parent");
  const errors = useBilingual("errors");
  const c = useBilingual("common");
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.kids) return <LoadingState className="min-h-[50vh]" />;
  return (
    <div className="flex flex-col gap-5">
      <Hero tone="lavender" pose="wave" title={t("homeTitle")} subtitle={t("heroTitle")} />
      {p.kids.length === 0 ? (
        <EmptyState message={t("noChildren")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {p.kids.map((ch, i) => (
            <li key={ch.id}>
              <Link href={`/parent/child/${ch.id}`} className="block rounded-card focus-visible:outline-4" data-testid={`child-${ch.id}`}>
                <Card className="flex items-center gap-3 transition-transform hover:-translate-y-0.5">
                  <IconBubble icon="backpack" pastel={(["lavender", "peach", "sky", "mint"] as const)[i % 4]} size={34} />
                  <div className="flex-1">
                    <p className="text-lg font-extrabold">{ch.name}</p>
                    <p className="text-sm text-stone">{ch.classes.map((x) => x.name).join(", ")}</p>
                  </div>
                  <Pill tone={consentTone(ch.consent_status)}>{t(`consent_${ch.consent_status}`).regional}</Pill>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card className="flex flex-col gap-3">
        <BilingualText as="h2" size="lg" text={t("linkTitle")} />
        <BilingualText size="sm" text={t("linkHint")} className="text-stone" />
        <TextField
          label={t("codeLabel")}
          value={p.code}
          onChange={(e) => p.onCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          className="font-mono tracking-[0.3em]"
          maxLength={7}
          error={p.previewError ? errors(asApiError(p.previewError).code) : null}
          data-testid="link-code"
        />
        {p.previewLoading && <LoadingState message={t("checkingCode")} />}
        {p.preview && (
          <div className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-float-1" data-testid="link-preview">
            <div className="flex items-center gap-3">
              <GoluMascot pose="wave" size={64} />
              <SpeechBubble>
                <BilingualText text={t("isThisYourChild", { name: p.preview.name })} />
              </SpeechBubble>
            </div>
            {p.preview.classes.length > 0 && (
              <ul className="text-sm">
                {p.preview.classes.map((x) => (
                  <li key={x.id}>
                    {x.name} · {x.teacher_name}
                  </li>
                ))}
              </ul>
            )}
            {p.linkError !== null && p.linkError !== undefined && (
              <p role="alert" className="text-sm font-bold text-coral-strong">
                {errors(asApiError(p.linkError).code).regional} · {errors(asApiError(p.linkError).code).english}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <ChunkyButton onClick={p.onLink} loading={p.linking} data-testid="confirm-link">
                <BilingualText as="span" size="sm" tone="inverse" text={t("yesLink")} />
              </ChunkyButton>
              <ChunkyButton variant="ghost" onClick={p.onCancelLink}>
                <BilingualText as="span" size="sm" text={c("cancel")} />
              </ChunkyButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
