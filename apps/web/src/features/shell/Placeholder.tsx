"use client";
import { EmptyState } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";

/** Holds a shell section's place until the phase that builds it. */
export function Placeholder({ ns, k }: { ns: string; k: string }) {
  const t = useBilingual(ns);
  return <EmptyState message={t(k)} className="min-h-[50vh]" />;
}
