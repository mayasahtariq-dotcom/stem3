"use client";
import { BilingualText, ChunkyButton, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { useOfflineSync, type OfflineSyncModel } from "./use-offline-sync";

/**
 * A small status card at the top of every screen (it never blocks taps): offline, answers waiting to sync,
 * syncing, or answers the server could not count. Hidden when all is well.
 */
export function OfflineBannerView({
  model,
}: {
  model: Omit<OfflineSyncModel, "syncNow"> & { syncNow?: () => void };
}) {
  const t = useBilingual("offline");
  const { online, pending, dropped, status } = model;
  let text;
  let icon: "warn" | "refresh" | "heart" = "warn";
  if (!online) text = pending > 0 ? t("offlineSaved", { n: pending }) : t("offline");
  else if (status === "syncing" || pending > 0) {
    text = t("syncing", { n: pending });
    icon = "refresh";
  } else if (dropped > 0) {
    text = t("dropped", { n: dropped });
    icon = "heart";
  } else return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      data-state={
        !online
          ? "offline"
          : dropped > 0 && pending === 0 && status !== "syncing"
            ? "dropped"
            : "syncing"
      }
      className={cn(
        "pointer-events-none fixed inset-x-3 top-[max(8px,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-card border-2 bg-white px-3 py-2 shadow-float-1",
        online ? "border-sky" : "border-sun",
      )}
    >
      <StickerIcon name={icon} size={24} />
      <BilingualText size="sm" text={text} className="flex-1" />
      {online && dropped > 0 && pending === 0 && model.dismissDropped && (
        <ChunkyButton
          variant="ghost"
          size="sm"
          className="pointer-events-auto"
          onClick={model.dismissDropped}
        >
          <BilingualText as="span" size="sm" align="center" text={t("ok")} />
        </ChunkyButton>
      )}
    </div>
  );
}

export function OfflineBanner() {
  const model = useOfflineSync();
  return <OfflineBannerView model={model} />;
}
