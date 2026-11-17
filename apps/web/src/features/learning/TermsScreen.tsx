"use client";
import { useMemo } from "react";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, EmptyState, ErrorState, LoadingState, SourceChip, StickerIcon, TextField, WoodPanel } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri, type Tri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";

type TermContent = { forms?: Tri; meaning?: Tri; analogy?: Tri; formal?: Tri };
const content = (t: Schemas["TermOut"]) => t.content as TermContent;

/** Matches a search in any language (English, Hindi, Kannada) or the key. */
export function filterTerms(terms: Schemas["TermOut"][], query: string, savedOnly: boolean) {
  const q = query.trim().toLowerCase();
  return terms.filter((t) => {
    if (savedOnly && !t.saved) return false;
    if (!q) return true;
    const f = content(t).forms;
    return [t.key, f?.en, f?.hi, f?.kn, content(t).meaning?.en].some((s) => s?.toLowerCase().includes(q));
  });
}

export interface TermsScreenProps {
  terms: Schemas["TermOut"][] | undefined;
  loading: boolean;
  error: unknown;
  query: string;
  savedOnly: boolean;
  openKey: string | null;
  onQuery: (q: string) => void;
  onSavedOnly: (v: boolean) => void;
  onOpen: (key: string | null) => void;
  onToggleSave: (key: string, save: boolean) => void;
  onAsk: (key: string) => void;
  onSpeak: (text: string) => void;
  onRetry: () => void;
  noCourse: boolean;
}

/** The word book in the farmhouse: search, read and save key terms. */
export function TermsScreen(p: TermsScreenProps) {
  const t = useBilingual("terms");
  const tri = useTri();
  const shown = useMemo(() => filterTerms(p.terms ?? [], p.query, p.savedOnly), [p.terms, p.query, p.savedOnly]);
  if (p.noCourse) return <EmptyState className="h-full" message={t("noCourse")} />;
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="h-full" />;
  if (p.loading || !p.terms) return <LoadingState className="h-full" />;
  const open = p.openKey ? p.terms.find((x) => x.key === p.openKey) : null;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-32 pt-20 laptop:max-w-4xl laptop:px-8 laptop:pb-12 laptop:pt-8">
      <BilingualText as="h1" size="2xl" text={t("title")} />
      <TextField label={t("search")} value={p.query} onChange={(e) => p.onQuery(e.target.value)} type="search" inputMode="search" />
      <div className="flex gap-2" role="group" aria-label={t("filter").english}>
        {[false, true].map((v) => (
          <button key={String(v)} type="button" aria-pressed={p.savedOnly === v} onClick={() => p.onSavedOnly(v)} className={cn("min-h-11 rounded-full border-2 px-4 font-bold", p.savedOnly === v ? "border-sky-strong bg-sky-soft" : "border-line bg-white")}>
            {(v ? t("saved") : t("all")).regional} · {(v ? t("saved") : t("all")).english}
          </button>
        ))}
      </div>
      {open && (
        <WoodPanel aria-labelledby="term-open">
          <div className="flex flex-col gap-3" data-testid="term-detail">
            <div className="flex items-start gap-2">
              <BilingualText as="h2" size="xl" text={tri(content(open).forms)} className="flex-1" />
              <ChunkyButton variant="white" size="icon" onClick={() => p.onSpeak(tri(content(open).forms).regional)} aria-label={t("listen").english}>
                <StickerIcon name="speaker" size={22} />
              </ChunkyButton>
              <ChunkyButton variant="ghost" size="icon" onClick={() => p.onOpen(null)} aria-label={t("close").english}>
                <StickerIcon name="plus" size={22} className="rotate-45" />
              </ChunkyButton>
            </div>
            <span id="term-open" className="sr-only">
              {content(open).forms?.en}
            </span>
            {content(open).meaning && (
              <div className="rounded-card bg-white/90 p-3">
                <BilingualText size="sm" text={t("meaning")} className="mb-1" />
                <BilingualText text={tri(content(open).meaning)} />
              </div>
            )}
            {content(open).analogy && (
              <div className="rounded-card bg-white/90 p-3">
                <BilingualText size="sm" text={t("likeOnTheFarm")} className="mb-1" />
                <BilingualText text={tri(content(open).analogy)} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <SourceChip label={t("page", { n: open.source_page }).english} />
              {open.mastery != null && <span className="text-sm text-stone">{t("mastery", { pct: Math.round(open.mastery * 100) }).english}</span>}
            </div>
            <div className="flex flex-col gap-2 tablet:flex-row">
              <ChunkyButton block variant={open.saved ? "white" : "primary"} onClick={() => p.onToggleSave(open.key, !open.saved)} aria-pressed={open.saved} data-testid="toggle-save">
                <BilingualText as="span" align="center" tone={open.saved ? "default" : "inverse"} text={open.saved ? t("unsave") : t("save")} />
              </ChunkyButton>
              <ChunkyButton block variant="white" onClick={() => p.onAsk(open.key)}>
                <BilingualText as="span" align="center" text={t("ask")} />
              </ChunkyButton>
            </div>
          </div>
        </WoodPanel>
      )}
      {shown.length === 0 ? (
        <EmptyState message={p.savedOnly && !p.query ? t("noSaved") : t("noMatch")} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
          {shown.map((term) => (
            <li key={term.key}>
              <button type="button" onClick={() => p.onOpen(term.key)} aria-expanded={p.openKey === term.key} className="flex min-h-14 w-full items-center gap-3 rounded-card border-2 border-b-4 border-line bg-white px-3 py-2 text-left hover:bg-cream">
                <StickerIcon name={term.saved ? "star" : "book"} size={28} />
                <BilingualText as="span" text={tri(content(term).forms)} className="flex-1" />
                {term.saved && <span className="sr-only">{t("saved").english}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
