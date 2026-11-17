"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BilingualText, ErrorState, GoluMascot, LoadingState, SpeechBubble, StickerIcon, toast } from "@/components/ui";
import { useProfile } from "@/features/auth/hooks";
import { useBuyFreeze, useBuyItem, useOpenPot, useShop } from "@/features/game/api";
import { PotPanel } from "@/features/game/PotPanel";
import { useStats } from "@/features/learning/api";
import { useLessonSessions } from "@/features/learning/session-store";
import { asApiError } from "@/lib/api/errors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { useServices } from "@/lib/services";
import { sounds } from "@/lib/sound/sound-manager";
import { pickQuality, readDeviceHints } from "@/three/engine/quality";
import { FARM_PLACES } from "@/three/world/scene-model";
import { LessonPanel, PlacePanel, type FarmPanelActions, type FarmPanelData } from "./FarmPanels";
import { useFarmData } from "./use-farm";
import { useWorld } from "@/features/world/api";
import { useFieldEditor } from "@/features/world/use-field-editor";
import { WorldOverlay } from "@/features/world/WorldOverlay";
import { useWorldUi } from "@/features/world/world-store";

// three.js (~600 KB) loads only here, after sign-in, never on the login screens.
const FarmCanvas = dynamic(() => import("./FarmCanvas"), { ssr: false, loading: () => <LoadingState className="h-full" /> });

/**
 * The student's home: the 3D farm plus its HTML overlays (destination panels,
 * greeting, resume chip, and a keyboard/screen-reader list of every place and
 * lesson). Data comes from useFarmData; the scene lives in src/three.
 */
export function FarmView({ sceneExtras, renderPanel }: { sceneExtras?: ReactNode; renderPanel?: (selected: string, close: () => void) => ReactNode | null } = {}) {
  const t = useBilingual("farm");
  const errors = useBilingual("errors");
  const tri = useTri();
  const { reporter } = useServices();
  const profile = useProfile();
  const reduced = useReducedMotion();
  const quality = useMemo(() => pickQuality(readDeviceHints()), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [greeted, setGreeted] = useState(false);
  const { home, path, game, courseId, scene } = useFarmData();
  const stats = useStats();
  const shop = useShop();
  const buyFreeze = useBuyFreeze();
  const buyItem = useBuyItem();
  const resume = useLessonSessions((s) => s.latest());
  const openPot = useOpenPot();
  // Farm worlds: the field the student stands in (only an unlocked one), and its editor.
  const world = useWorld();
  const chosenField = useWorldUi((s) => s.field);
  const field = world.data && !world.data.fields.some((f) => f.id === chosenField && f.unlocked) ? "starter-meadow" : chosenField;
  const editor = useFieldEditor(field);
  const draft = useWorldUi((s) => s.draft);
  const sheet = useWorldUi((s) => s.sheet);
  const moveDraft = useWorldUi((s) => s.moveDraft);
  const pickPlaced = useWorldUi((s) => s.pick);

  const select = (id: string) => {
    setSelected(id);
    setGreeted(true);
    sounds.play("tap");
  };
  const close = () => setSelected(null);
  // Move focus into the panel that opened (keyboard and screen-reader users land on it).
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) panelRef.current?.focus();
  }, [selected]);

  const onBuyError = (e: unknown) => toast("error", errors(asApiError(e).code));
  const data: FarmPanelData = { home: home.data, path: path.data, pathLoading: path.isLoading, pathError: path.error, stats: stats.data, game: game.data, gameError: game.error, shop: shop.data, courseId };
  const actions: FarmPanelActions = {
    close,
    retryPath: () => void path.refetch(),
    buyFreeze: () => buyFreeze.mutate(undefined, { onSuccess: () => toast("success", t("freezeBought")), onError: onBuyError }),
    buyItem: (id) => buyItem.mutate(id, { onSuccess: () => toast("success", t("itemBought")), onError: onBuyError }),
    buying: buyFreeze.isPending ? "freeze" : buyItem.isPending ? (buyItem.variables ?? null) : null,
  };

  const lessons = path.data?.units.flatMap((u) => u.lessons) ?? [];
  const placeLabel = (id: string) => {
    if (id.startsWith("lesson:")) {
      const l = lessons.find((x) => `lesson:${x.id}` === id);
      return l ? tri(l.title as never) : t("lessonMissing");
    }
    return t(id);
  };

  const potPanel = (
    <PotPanel
      potsWaiting={game.data?.pending_pots.length ?? 0}
      opening={openPot.isPending}
      opened={openPot.data ?? null}
      error={openPot.error}
      onOpen={() => {
        const id = game.data?.pending_pots[0];
        if (id && !openPot.isPending) openPot.mutate(id, { onSuccess: () => sounds.play("pop") });
      }}
      onClose={() => {
        openPot.reset();
        close();
      }}
    />
  );
  const panel = selected ? (renderPanel?.(selected, close) ?? (selected === "pot" ? potPanel : selected.startsWith("lesson:") ? <LessonPanel id={selected.slice(7)} data={data} actions={actions} /> : <PlacePanel place={selected} data={data} actions={actions} />)) : null;

  return (
    <div className="relative h-full w-full">
      <FarmCanvas
        quality={quality}
        label={t("label").english}
        scene={scene}
        selected={selected}
        onSelect={select}
        reducedMotion={reduced}
        extras={sceneExtras}
        field={field}
        placed={editor.objects}
        onPickPlaced={pickPlaced}
        placement={draft ? { draft, valid: !editor.problem, onMove: moveDraft } : undefined}
        onError={(e) => reporter.capture(e, { where: "farm3d" })}
        overlays={{
          loading: (pct) => <LoadingState message={pct > 0 && pct < 100 ? t("loadingProgress", { percent: Math.round(pct) }) : t("loading")} />,
          error: (retry) => <ErrorState error={new Error("farm")} onRetry={retry} className="[&_[role=alert]]:contents" />,
          unsupported: () => (
            <div className="grid h-full place-items-center bg-gradient-to-b from-sky-soft to-[#eaf8d8] p-6">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <SpeechBubble>
                  <BilingualText text={t("unsupported")} align="center" />
                </SpeechBubble>
                <Link href="/farm/learn" className="font-bold text-sky-strong underline">
                  {t("wholePath").regional} · {t("wholePath").english}
                </Link>
              </div>
            </div>
          ),
        }}
      />

      <WorldOverlay editor={editor} field={field} />

      {resume && !selected && !draft && (
        <Link
          href={`/farm/lesson/${encodeURIComponent(resume.session.lessonId)}`}
          data-testid="resume-lesson"
          className="absolute left-1/2 top-20 z-10 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-sun px-4 py-2 font-bold text-ink shadow-float-2"
        >
          <StickerIcon name="repeat" size={22} />
          <span className="flex flex-col leading-tight">
            <span className="font-regional">{t("resume", { title: tri(resume.title).regional }).regional}</span>
            <span className="text-xs font-medium">{t("resume", { title: resume.title.en }).english}</span>
          </span>
        </Link>
      )}

      {!greeted && !resume && !draft && !sheet && field === "starter-meadow" && profile.data?.name && (
        <div className="pointer-events-none absolute left-3 top-20 z-10 flex max-w-xs items-end gap-2 tablet:left-4">
          <GoluMascot pose="wave" size={72} />
          <SpeechBubble tail="left" className="mb-4">
            <BilingualText size="sm" text={home.data && home.data.courses.length === 0 ? t("helloNoCourse", { name: profile.data.name }) : t("helloTap", { name: profile.data.name })} />
          </SpeechBubble>
        </div>
      )}

      {panel && (
        <div ref={panelRef} tabIndex={-1} className="absolute inset-x-3 bottom-28 z-10 mx-auto max-w-md outline-none" role="dialog" aria-label={placeLabel(selected!).english} data-testid="farm-panel">
          {panel}
        </div>
      )}

      {/* Keyboard and screen-reader access to every place and lesson the 3D scene offers. */}
      <nav aria-label={t("places").english} className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:inset-x-3 focus-within:top-20 focus-within:z-30 focus-within:flex focus-within:flex-wrap focus-within:gap-2">
        {[...FARM_PLACES, ...(scene.potWaiting ? ["pot"] : []), ...scene.stations.map((s) => `lesson:${s.id}`)].map((p) => (
          <button key={p} type="button" onClick={() => select(p)} className="min-h-11 rounded-button bg-white px-3 font-bold shadow-float-1">
            {placeLabel(p).regional} · {placeLabel(p).english}
          </button>
        ))}
      </nav>
      <p aria-live="polite" className="sr-only">
        {selected ? t("selected", { place: placeLabel(selected).english }).english : ""}
      </p>
    </div>
  );
}
