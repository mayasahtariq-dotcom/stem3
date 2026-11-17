"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { StoreItem, WorldField } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, EmptyState, ErrorState, LoadingState, ProgressBar, StickerIcon, toast } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { sounds } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils/cn";
import { STORE_CATEGORIES, type StoreCategory } from "@/lib/world/catalog";
import { FIELD_UNLOCK_XP, isFieldId, type FieldId } from "@/lib/world/fields";
import { useCelebrateField, usePurchase, useStoreItems, useWorld } from "./api";
import type { useFieldEditor } from "./use-field-editor";
import { useWorldUi } from "./world-store";

const ItemPreview = dynamic(() => import("@/three/worlds/ItemPreview"), { ssr: false, loading: () => <div className="size-full animate-pulse rounded-card bg-[#dff0cf]" /> });

type Editor = ReturnType<typeof useFieldEditor>;

const newUid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `o${Date.now()}${Math.random().toString(36).slice(2, 8)}`);

function Sheet({ title, onClose, children, testId }: { title: ReturnType<ReturnType<typeof useBilingual>>; onClose: () => void; children: React.ReactNode; testId: string }) {
  const t = useBilingual("world");
  return (
    <div role="dialog" aria-label={title.english} data-testid={testId} className="absolute inset-x-2 bottom-24 top-20 z-30 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-panel border-2 border-line bg-cream shadow-float-2 tablet:bottom-6">
      <div className="flex items-center justify-between gap-2 border-b-2 border-line bg-white/70 px-4 py-3">
        <BilingualText as="h2" text={title} size="lg" />
        <ChunkyButton variant="white" size="sm" onClick={onClose} aria-label={t("close").english}>
          {t("close").regional}
        </ChunkyButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}

/** Meadow levels: the five fields, their lock state, XP needed and progress. */
export function LevelsSheet({ current, onClose, onEnter }: { current: FieldId; onClose: () => void; onEnter: (f: FieldId) => void }) {
  const t = useBilingual("world");
  const world = useWorld();
  return (
    <Sheet title={t("levelsTitle")} onClose={onClose} testId="levels-sheet">
      <BilingualText size="sm" text={t("levelsHint")} className="mb-3 opacity-80" />
      {world.isLoading ? (
        <LoadingState />
      ) : world.error ? (
        <ErrorState error={world.error} onRetry={() => void world.refetch()} />
      ) : (
        <ol className="grid gap-3 tablet:grid-cols-2">
          {world.data!.fields.map((f) => (
            <FieldCard key={f.id} f={f} xp={world.data!.xp_total} here={f.id === current} onEnter={() => isFieldId(f.id) && onEnter(f.id)} />
          ))}
        </ol>
      )}
    </Sheet>
  );
}

function FieldCard({ f, xp, here, onEnter }: { f: WorldField; xp: number; here: boolean; onEnter: () => void }) {
  const t = useBilingual("world");
  const name = t(`field_${f.id}`);
  const pct = f.unlocked ? 100 : Math.min(100, Math.round((xp / Math.max(1, f.unlock_xp)) * 100));
  return (
    <li data-testid={`field-card-${f.id}`} data-locked={!f.unlocked} className={cn("flex gap-3 rounded-card border-2 bg-white p-3", here ? "border-grass-strong" : "border-line")}>
      <div className={cn("relative size-20 shrink-0 overflow-hidden rounded-card bg-cover bg-center", !f.unlocked && "grayscale-[0.7]")} style={{ backgroundImage: `url(/images/fields/${f.id}.jpg)` }}>
        {!f.unlocked && (
          <span className="absolute inset-0 grid place-items-center bg-black/30">
            <StickerIcon name="lock" size={30} />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <BilingualText as="h3" text={name} size="base" />
        {f.unlocked ? (
          <BilingualText size="sm" text={here ? t("here") : f.placed_count ? t("placedCount", { n: f.placed_count }) : t("unlocked")} />
        ) : (
          <>
            <BilingualText size="sm" text={t("unlockAt", { xp: f.unlock_xp.toLocaleString("en-IN") })} />
            <ProgressBar value={pct / 100} label={t("xpToGo", { xp: Math.max(0, f.unlock_xp - xp) }).english} />
            <BilingualText size="sm" text={t("xpToGo", { xp: Math.max(0, f.unlock_xp - xp).toLocaleString("en-IN") })} />
          </>
        )}
        {f.unlocked && !here && (
          <ChunkyButton size="sm" onClick={onEnter} className="self-start" data-testid={`enter-${f.id}`}>
            {t("enter").regional} · {t("enter").english}
          </ChunkyButton>
        )}
      </div>
    </li>
  );
}

/** The Farm Store: categories, prices, owned counts and a turning 3D preview. */
export function StoreSheet({ onClose, onPlace }: { onClose: () => void; onPlace: (itemId: string) => void }) {
  const t = useBilingual("world");
  const errors = useBilingual("errors");
  const tri = useTri();
  const items = useStoreItems();
  const world = useWorld();
  const purchase = usePurchase();
  const [cat, setCat] = useState<StoreCategory>("decorations");
  const [sel, setSel] = useState<string | null>(null);
  const shelf = useMemo(() => (items.data ?? []).filter((i) => i.category === cat), [items.data, cat]);
  const chosen: StoreItem | undefined = shelf.find((i) => i.id === sel) ?? shelf[0];
  const gems = world.data?.gems ?? 0;

  const buy = (item: StoreItem) =>
    purchase.mutate(
      { itemId: item.id },
      {
        onSuccess: () => {
          sounds.play("pop");
          toast("success", t("bought"));
        },
        onError: (e) => toast("error", errors(asApiError(e).code)),
      },
    );

  return (
    <Sheet title={t("store")} onClose={onClose} testId="store-sheet">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" className="flex gap-1.5 overflow-x-auto pb-1">
          {STORE_CATEGORIES.map((c) => (
            <button key={c} role="tab" aria-selected={c === cat} onClick={() => setCat(c)} className={cn("min-h-11 shrink-0 rounded-full border-2 px-3 text-sm font-bold", c === cat ? "border-grass-strong bg-grass-strong text-white" : "border-line bg-white")}>
              {t(`cat_${c}`).regional}
              <span className="block text-[11px] font-medium opacity-80">{t(`cat_${c}`).english}</span>
            </button>
          ))}
        </div>
        <span data-testid="store-gems" className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 font-bold shadow-float-1">
          <StickerIcon name="star" size={20} /> {gems}
        </span>
      </div>
      {items.isLoading ? (
        <LoadingState />
      ) : items.error ? (
        <ErrorState error={items.error} onRetry={() => void items.refetch()} />
      ) : !shelf.length ? (
        <EmptyState message={t("storeEmpty")} />
      ) : (
        <div className="grid gap-3 tablet:grid-cols-[1fr_15rem]">
          <ul className="grid grid-cols-2 gap-2 tablet:grid-cols-3">
            {shelf.map((i) => (
              <li key={i.id}>
                <button onClick={() => setSel(i.id)} data-testid={`store-item-${i.id}`} aria-pressed={chosen?.id === i.id} className={cn("flex w-full flex-col items-start gap-1 rounded-card border-2 bg-white p-2 text-left", chosen?.id === i.id ? "border-grass-strong" : "border-line")}>
                  <BilingualText as="span" size="sm" text={tri(i.name) as never} />
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <StickerIcon name="star" size={16} /> {i.price}
                  </span>
                  {i.owned > 0 && <span className="text-xs font-bold text-grass-strong">{t("owned", { n: i.owned }).regional}</span>}
                </button>
              </li>
            ))}
          </ul>
          {chosen && (
            <div className="flex flex-col gap-2 rounded-card border-2 border-line bg-white p-3" data-testid="store-detail">
              <div className="aspect-square w-full overflow-hidden rounded-card bg-gradient-to-b from-sky-soft to-[#eaf8d8]">
                <ItemPreview model={chosen.model} label={tri(chosen.name).english} />
              </div>
              <BilingualText as="h3" text={tri(chosen.name) as never} size="base" />
              <BilingualText size="sm" text={tri(chosen.description) as never} />
              <BilingualText size="sm" text={t("owned", { n: chosen.owned })} />
              <ChunkyButton block disabled={gems < chosen.price} loading={purchase.isPending && purchase.variables?.itemId === chosen.id} onClick={() => buy(chosen)} data-testid="buy">
                {gems < chosen.price ? t("needGems", { n: chosen.price - gems }).regional : t("buy", { price: chosen.price }).regional}
                <span className="block text-xs font-medium">{gems < chosen.price ? t("needGems", { n: chosen.price - gems }).english : t("buy", { price: chosen.price }).english}</span>
              </ChunkyButton>
              {chosen.owned > 0 && (
                <ChunkyButton variant="white" block onClick={() => onPlace(chosen.id)} data-testid="place-from-store">
                  {t("placeNow").regional} · {t("placeNow").english}
                </ChunkyButton>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** What the student owns and how many are still free to place in this field. */
export function InventorySheet({ editor, onClose, onPlace, onStore }: { editor: Editor; onClose: () => void; onPlace: (itemId: string) => void; onStore: () => void }) {
  const t = useBilingual("world");
  const tri = useTri();
  const items = useStoreItems();
  const inv = editor.inventory;
  const rows = (inv.data ?? []).filter((e) => e.owned > 0);
  return (
    <Sheet title={t("inventory")} onClose={onClose} testId="inventory-sheet">
      {inv.isLoading || items.isLoading ? (
        <LoadingState />
      ) : inv.error ? (
        <ErrorState error={inv.error} onRetry={() => void inv.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          message={t("inventoryEmpty")}
          action={
            <ChunkyButton onClick={onStore}>
              {t("openStore").regional} · {t("openStore").english}
            </ChunkyButton>
          }
        />
      ) : (
        <ul className="grid gap-2 tablet:grid-cols-2">
          {rows.map((e) => {
            const item = items.data?.find((i) => i.id === e.item_id);
            const left = editor.available[e.item_id] ?? 0;
            return (
              <li key={e.item_id} data-testid={`inv-${e.item_id}`} className="flex items-center justify-between gap-2 rounded-card border-2 border-line bg-white p-3">
                <div className="min-w-0">
                  {item && <BilingualText as="span" size="sm" text={tri(item.name) as never} />}
                  <BilingualText size="sm" text={left ? t("available", { n: left }) : t("allPlaced")} />
                </div>
                <ChunkyButton size="sm" disabled={!left} onClick={() => onPlace(e.item_id)} data-testid={`place-${e.item_id}`}>
                  {t("place").regional} · {t("place").english}
                </ChunkyButton>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * Everything the student uses to change their farm: field switching, the
 * store, the inventory, the placement bar and the unlock celebration.
 */
export function WorldOverlay({ editor, field }: { editor: Editor; field: FieldId }) {
  const t = useBilingual("world");
  const ui = useWorldUi();
  const world = useWorld();
  const celebrate = useCelebrateField();

  const startPlacing = (itemId: string) => {
    if ((editor.available[itemId] ?? 0) <= 0) {
      ui.openSheet("inventory");
      return;
    }
    const spot = editor.spotFor(itemId);
    if (!spot) return toast("error", t("noSpot"));
    ui.startDraft({ uid: newUid(), item_id: itemId, x: spot.x, z: spot.z, rotation: 0, isNew: true });
  };
  const saveError = (e: unknown) => toast("error", asApiError(e).code === "LAYOUT_CONFLICT" ? t("conflict") : t("saveFailed"));

  // The first time a new field opens, celebrate it.
  const fresh = world.data?.fields.find((f) => f.unlocked && !f.celebrated && f.id !== "starter-meadow");
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (fresh && dismissed !== fresh.id) sounds.play("pop");
  }, [fresh, dismissed]);

  const picked = ui.picked ? editor.objects.find((o) => o.uid === ui.picked) : undefined;
  const d = ui.draft;

  return (
    <>
      {!d && (
        <div className="absolute right-2 top-20 z-20 flex flex-col gap-2 tablet:right-4" data-testid="world-tools">
          {(
            [
              ["levels", "sprout", t("fields")],
              ["store", "shop", t("store")],
              ["inventory", "backpack", t("inventory")],
            ] as const
          ).map(([s, icon, label]) => (
            <button key={s} onClick={() => ui.openSheet(ui.sheet === s ? null : s)} data-testid={`open-${s}`} aria-label={label.english} className="flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-white/95 py-1 pl-1.5 pr-3 font-bold shadow-float-1">
              <StickerIcon name={icon} size={28} />
              <span className="flex flex-col text-left leading-tight">
                <span className="text-sm">{label.regional}</span>
                <span className="text-[11px] font-medium text-stone">{label.english}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {d && (
        <div className="absolute inset-x-2 bottom-24 z-30 mx-auto flex max-w-md flex-col gap-2 rounded-panel border-2 border-line bg-cream p-3 shadow-float-2 tablet:bottom-6" data-testid="placement-bar" role="region" aria-label={t("dragHint").english}>
          <div aria-live="polite" data-testid="placement-status" data-valid={!editor.problem}>
            <BilingualText size="sm" text={editor.problem ? t(`problem_${editor.problem}`) : t("fits")} className={editor.problem ? "text-[#b42318]" : undefined} />
            <BilingualText size="sm" text={t("dragHint")} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ChunkyButton variant="white" size="sm" onClick={() => ui.rotateDraft()} data-testid="rotate">
              <StickerIcon name="repeat" size={18} /> {t("rotate").regional}
            </ChunkyButton>
            <ChunkyButton variant="white" size="sm" onClick={ui.cancelDraft} data-testid="cancel-place">
              {t("cancel").regional}
            </ChunkyButton>
            <ChunkyButton
              size="sm"
              disabled={Boolean(editor.problem)}
              loading={editor.saving}
              data-testid="confirm-place"
              onClick={() =>
                editor.confirm(() => {
                  sounds.play("pop");
                  toast("success", t("placed"));
                  ui.cancelDraft();
                }, saveError)
              }
            >
              {t("confirm").regional}
            </ChunkyButton>
          </div>
        </div>
      )}

      {picked && !d && (
        <div className="absolute inset-x-2 bottom-24 z-30 mx-auto flex max-w-sm gap-2 rounded-panel border-2 border-line bg-cream p-3 shadow-float-2 tablet:bottom-6" data-testid="picked-menu">
          <ChunkyButton size="sm" onClick={() => ui.startDraft({ ...picked, isNew: false })} data-testid="move-placed">
            {t("move").regional}
          </ChunkyButton>
          <ChunkyButton variant="white" size="sm" loading={editor.saving} onClick={() => editor.putAway(picked.uid, () => (ui.pick(null), toast("success", t("putAwayDone"))), saveError)} data-testid="putaway-placed">
            {t("putAway").regional}
          </ChunkyButton>
          <ChunkyButton variant="ghost" size="sm" onClick={() => ui.pick(null)}>
            {t("close").regional}
          </ChunkyButton>
        </div>
      )}

      {ui.sheet === "levels" && <LevelsSheet current={field} onClose={() => ui.openSheet(null)} onEnter={(f) => ui.setField(f)} />}
      {ui.sheet === "store" && <StoreSheet onClose={() => ui.openSheet(null)} onPlace={startPlacing} />}
      {ui.sheet === "inventory" && <InventorySheet editor={editor} onClose={() => ui.openSheet(null)} onPlace={startPlacing} onStore={() => ui.openSheet("store")} />}

      {fresh && dismissed !== fresh.id && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" data-testid="unlock-celebration">
          <div role="alertdialog" aria-label={t("newField").english} className="flex w-full max-w-sm flex-col items-center gap-3 rounded-panel border-2 border-line bg-cream p-6 text-center shadow-float-2 motion-safe:animate-[pop-in_600ms_var(--ease-spring)]">
            <StickerIcon name="party" size={64} />
            <BilingualText as="h2" size="2xl" align="center" text={t("newField")} />
            <BilingualText align="center" text={t("newFieldBody", { name: t(`field_${fresh.id}`).regional })} />
            <div className="flex w-full gap-2">
              <ChunkyButton
                block
                onClick={() => {
                  celebrate.mutate(fresh.id);
                  if (isFieldId(fresh.id)) ui.setField(fresh.id);
                }}
              >
                {t("goThere").regional}
              </ChunkyButton>
              <ChunkyButton
                variant="white"
                block
                onClick={() => {
                  celebrate.mutate(fresh.id);
                  setDismissed(fresh.id);
                }}
              >
                {t("later").regional}
              </ChunkyButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { FIELD_UNLOCK_XP };
