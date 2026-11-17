"use client";
import type { PotOpened } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, StickerIcon, type StickerIconName } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";

export interface PotPanelProps {
  potsWaiting: number;
  opening: boolean;
  opened: PotOpened | null;
  error: unknown;
  onOpen: () => void;
  onClose: () => void;
}

/** Golu Pot: a clay pot earned by finishing lessons. What's inside comes from the server; no odds are shown or invented. */
export function PotPanel(p: PotPanelProps) {
  const t = useBilingual("game");
  const errors = useBilingual("errors");
  const reward = p.opened?.reward;
  return (
    <div className="flex flex-col gap-3" data-testid="pot-panel">
      <div className="flex items-center gap-3">
        <StickerIcon name={p.opened ? "party" : "bowl"} size={44} />
        <BilingualText as="h2" size="xl" text={t("potTitle")} className="flex-1" />
        <button type="button" onClick={p.onClose} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-cloud" aria-label={t("close").english}>
          ✕
        </button>
      </div>
      {reward ? (
        <div className="flex items-center gap-3 rounded-card bg-sun-soft p-3 pop-in" role="status" data-testid="pot-reward">
          <StickerIcon name={reward.kind === "gems" ? "sparkle" : ((reward.item ?? "gift") as StickerIconName)} size={40} />
          <BilingualText text={reward.kind === "gems" ? t("potGems", { n: reward.amount ?? 0 }) : t("potSticker")} />
        </div>
      ) : (
        <BilingualText size="sm" text={p.potsWaiting ? t("potHint", { n: p.potsWaiting }) : t("potEmpty")} />
      )}
      {p.error !== null && p.error !== undefined && <BilingualText size="sm" text={errors(asApiError(p.error).code)} className="text-coral-strong" />}
      {p.potsWaiting > 0 && (
        <ChunkyButton onClick={p.onOpen} loading={p.opening} data-testid="open-pot">
          <BilingualText as="span" size="sm" tone="inverse" text={p.opened ? t("openNext") : t("openPot")} />
        </ChunkyButton>
      )}
    </div>
  );
}
