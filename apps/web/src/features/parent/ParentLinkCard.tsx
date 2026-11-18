"use client";
import { useLocale } from "next-intl";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, Pill, StickerIcon, toast } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useCreateLinkCode, useMyParents, useRemoveParent } from "./api";
import { MyParentLinkCard } from "./share-link";

export interface ParentLinkPanelProps {
  parents: Schemas["ParentOut"][] | undefined;
  parentsError: unknown;
  code: Schemas["LinkCodeOut"] | undefined;
  creating: boolean;
  removingId: string | null;
  onCreate: () => void;
  onRemove: (id: string) => void;
  formatTime: (iso: string) => string;
}

/** Student profile: make a code for a parent, and see or remove linked parents. */
export function ParentLinkPanel(p: ParentLinkPanelProps) {
  const t = useBilingual("parent");
  return (
    <Card className="flex flex-col gap-3" data-testid="parent-link-panel">
      <BilingualText as="h2" size="lg" text={t("studentPanelTitle")} />
      <BilingualText size="sm" text={t("studentPanelHint")} className="text-stone" />
      {p.code ? (
        <div className="rounded-card bg-white p-4 text-center shadow-float-1">
          <p className="font-mono text-4xl font-extrabold tracking-[0.3em]" data-testid="my-link-code">
            {p.code.code}
          </p>
          <BilingualText size="sm" align="center" text={t("codeExpires", { time: p.formatTime(p.code.expires_at) })} />
        </div>
      ) : (
        <ChunkyButton onClick={p.onCreate} loading={p.creating} className="self-start" data-testid="make-link-code">
          <BilingualText as="span" size="sm" tone="inverse" text={t("makeCode")} />
        </ChunkyButton>
      )}
      {p.parents && p.parents.length > 0 && (
        <ul className="flex flex-col gap-2">
          {p.parents.map((x) => (
            <li key={x.id} className="flex items-center gap-2 rounded-card bg-white p-2">
              <StickerIcon name="people" size={24} />
              <span className="font-bold">{x.name}</span>
              <span className="text-sm text-stone">···{x.phone_last4}</span>
              <Pill tone={x.consented ? "good" : "info"}>{(x.consented ? t("parentApproved") : t("parentNotYet")).regional}</Pill>
              <ChunkyButton size="sm" variant="ghost" className="ml-auto" loading={p.removingId === x.id} onClick={() => p.onRemove(x.id)} aria-label={t("removeParent", { name: x.name }).english}>
                <StickerIcon name="trash" size={18} />
              </ChunkyButton>
            </li>
          ))}
        </ul>
      )}
      {p.parentsError !== null && p.parentsError !== undefined && <BilingualText size="sm" text={t("parentsLoadFailed")} className="text-coral-strong" />}
    </Card>
  );
}

export function ParentLinkCard() {
  const errors = useBilingual("errors");
  const locale = useLocale();
  const parents = useMyParents();
  const create = useCreateLinkCode();
  const remove = useRemoveParent();
  const onError = (e: unknown) => toast("error", errors(asApiError(e).code));
  return (
    <>
      <MyParentLinkCard />
      <ParentLinkPanel
      parents={parents.data}
      parentsError={parents.error}
      code={create.data}
      creating={create.isPending}
      removingId={remove.isPending ? remove.variables : null}
      onCreate={() => !create.isPending && create.mutate(undefined, { onError })}
      onRemove={(id) => remove.mutate(id, { onError })}
      formatTime={(iso) => new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "hi-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso))}
      />
    </>
  );
}
