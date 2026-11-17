"use client";
import Link from "next/link";
import type { GameStats, Schemas, ShopItem } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, ErrorState, LoadingState, ProgressBar, StickerIcon, WoodPanel, XPRing, type StickerIconName } from "@/components/ui";
import { useBilingual, type BilingualString } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { findLesson } from "./farm-model";

/*
 * The panels that open when a farm place or lesson marker is tapped.
 * Stateless: data and actions come from FarmView's view-model.
 */
export interface FarmPanelData {
  home: Schemas["HomeOut"] | undefined;
  path: Schemas["PathOut"] | undefined;
  pathLoading: boolean;
  pathError: unknown;
  stats: Schemas["StatsOut"] | undefined;
  game: GameStats | undefined;
  gameError: unknown;
  shop: ShopItem[] | undefined;
  courseId: string | null;
}

export interface FarmPanelActions {
  close: () => void;
  retryPath: () => void;
  buyFreeze: () => void;
  buyItem: (id: string) => void;
  buying: string | null;
}

const ICONS: Record<string, StickerIconName> = { barn: "book", farmhouse: "books", lab: "flask", signboard: "target", market: "shop", golu: "chat", field: "corn", windmill: "calendar", pond: "duck" };

function PanelFrame({ icon, title, subtitle, onClose, children }: { icon: StickerIconName; title: BilingualString; subtitle?: BilingualString; onClose: () => void; children?: React.ReactNode }) {
  const t = useBilingual("farm");
  return (
    <WoodPanel className="max-h-[60dvh] overflow-y-auto">
      <div className="flex items-start gap-3">
        <StickerIcon name={icon} size={40} />
        <div className="flex flex-1 flex-col gap-0.5">
          <BilingualText as="h2" size="lg" text={title} />
          {subtitle && <BilingualText size="sm" text={subtitle} />}
        </div>
        <ChunkyButton variant="ghost" size="icon" onClick={onClose} aria-label={t("close").english}>
          <StickerIcon name="plus" size={22} className="rotate-45" />
        </ChunkyButton>
      </div>
      {children && <div className="mt-3 flex flex-col gap-3">{children}</div>}
    </WoodPanel>
  );
}

function LinkButton({ href, text, variant = "primary", testId }: { href: string; text: BilingualString; variant?: "primary" | "white"; testId?: string }) {
  return (
    <ChunkyButton asChild block variant={variant}>
      <Link href={href} data-testid={testId}>
        <BilingualText as="span" align="center" tone={variant === "primary" ? "inverse" : "default"} text={text} />
      </Link>
    </ChunkyButton>
  );
}

function UnitProgress({ path }: { path: Schemas["PathOut"] }) {
  const tri = useTri();
  const t = useBilingual("farm");
  return (
    <ul className="flex flex-col gap-2">
      {path.units.map((u) => {
        const done = u.lessons.filter((l) => l.state === "done").length;
        return (
          <li key={u.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <BilingualText as="span" size="sm" text={tri(u.title)} />
              <span className="text-sm font-bold tabular-nums">
                {done}/{u.lessons.length}
              </span>
            </div>
            <ProgressBar value={u.lessons.length ? done / u.lessons.length : 0} label={t("unitProgress", { done, total: u.lessons.length }).english} />
          </li>
        );
      })}
    </ul>
  );
}

export function LessonPanel({ id, data, actions }: { id: string; data: FarmPanelData; actions: FarmPanelActions }) {
  const t = useBilingual("farm");
  const tri = useTri();
  const found = findLesson(data.path, id);
  if (!found) return <PanelFrame icon="book" title={t("lessonMissing")} onClose={actions.close} />;
  const { lesson, unit } = found;
  const state = lesson.state;
  const ready = lesson.generation_status === "ready";
  return (
    <PanelFrame icon={state === "done" ? "star" : state === "locked" ? "lock" : "book"} title={tri(lesson.title)} subtitle={tri(unit.title)} onClose={actions.close}>
      <p className={cn("self-start rounded-full px-3 py-1 text-sm font-bold", state === "done" ? "bg-[#ecf8e4] text-grass-strong" : state === "current" ? "bg-sun-soft" : "bg-cloud text-stone")}>
        {t(`state_${state}`).regional} · {t(`state_${state}`).english}
      </p>
      <BilingualText size="sm" text={t("questionCount", { n: lesson.question_count })} />
      {state === "locked" ? (
        <p className="flex items-start gap-2 text-sm">
          <StickerIcon name="lock" size={22} />
          <BilingualText as="span" size="sm" text={lesson.unlocked_by ? t("finishFirst", { title: tri(lesson.unlocked_by as never).regional, titleEn: tri(lesson.unlocked_by as never).english }) : t("lockedHint")} />
        </p>
      ) : !ready ? (
        <BilingualText size="sm" text={t("lessonMaking")} />
      ) : (
        <LinkButton href={`/farm/lesson/${encodeURIComponent(lesson.id)}`} text={state === "done" ? t("playAgain") : t("startLesson")} testId="start-lesson" />
      )}
    </PanelFrame>
  );
}

export function PlacePanel({ place, data, actions }: { place: string; data: FarmPanelData; actions: FarmPanelActions }) {
  const t = useBilingual("farm");
  const tri = useTri();
  const icon = ICONS[place] ?? "home";
  const noCourse = data.home && data.home.courses.length === 0;
  const askHref = data.courseId ? `/farm/ask?course=${encodeURIComponent(data.courseId)}` : "/farm/ask";

  switch (place) {
    case "barn": {
      const c = data.home?.continue_lesson;
      return (
        <PanelFrame icon={icon} title={t("barn")} subtitle={t("barnHint")} onClose={actions.close}>
          {!data.home ? (
            <LoadingState className="p-0" />
          ) : noCourse ? (
            <>
              <BilingualText size="sm" text={t("noCourse")} />
              <LinkButton href="/join" text={t("joinClass")} />
            </>
          ) : c ? (
            <>
              <div className="rounded-card bg-white/90 p-3">
                <BilingualText size="sm" text={t("lessonOf", { n: c.lesson_number, total: c.lesson_count })} />
                <BilingualText as="h3" size="lg" text={tri(c.lesson_title as never)} />
              </div>
              {c.generation_status === "ready" ? <LinkButton href={`/farm/lesson/${encodeURIComponent(c.lesson_id)}`} text={t("startLesson")} testId="start-lesson" /> : <BilingualText size="sm" text={t("lessonMaking")} />}
            </>
          ) : (
            <BilingualText size="sm" text={t("allDone")} />
          )}
          {data.path && <UnitProgress path={data.path} />}
          {!noCourse && <LinkButton href="/farm/learn" variant="white" text={t("wholePath")} />}
        </PanelFrame>
      );
    }
    case "signboard":
      return (
        <PanelFrame icon={icon} title={t("signboard")} subtitle={data.path ? tri(data.path.title as never) : undefined} onClose={actions.close}>
          {data.pathError ? (
            <ErrorState error={data.pathError} onRetry={actions.retryPath} className="p-0" />
          ) : data.path ? (
            <>
              <ProgressBar value={data.path.lesson_count ? data.path.done_count / data.path.lesson_count : 0} label={t("courseProgress", { done: data.path.done_count, total: data.path.lesson_count }).english} />
              <BilingualText size="sm" text={t("courseProgress", { done: data.path.done_count, total: data.path.lesson_count })} />
              <UnitProgress path={data.path} />
            </>
          ) : noCourse ? (
            <BilingualText size="sm" text={t("noCourse")} />
          ) : (
            <LoadingState className="p-0" />
          )}
          {data.home?.classes.map((cl) => (
            <p key={cl.id} className="text-sm">
              <span className="font-bold">{cl.name}</span> · {cl.teacher_name}
            </p>
          ))}
          <LinkButton href="/farm/league" text={t("openNoticeboard")} variant="white" testId="open-league" />
          <LinkButton href="/farm/quests" text={t("openQuests")} variant="white" testId="open-quests" />
        </PanelFrame>
      );
    case "farmhouse":
      return (
        <PanelFrame icon={icon} title={t("farmhouse")} subtitle={t("farmhouseHint")} onClose={actions.close}>
          <LinkButton href={data.courseId ? `/farm/terms?course=${encodeURIComponent(data.courseId)}` : "/farm/terms"} text={t("openWordBook")} testId="open-terms" />
        </PanelFrame>
      );
    case "lab":
    case "golu":
      return (
        <PanelFrame icon={icon} title={t(place)} subtitle={t("askHint")} onClose={actions.close}>
          <LinkButton href={askHref} text={t("askGolu")} testId="open-ask" />
        </PanelFrame>
      );
    case "market":
      return (
        <PanelFrame icon={icon} title={t("market")} subtitle={t("marketHint")} onClose={actions.close}>
          {data.gameError ? (
            <ErrorState error={data.gameError} className="p-0" />
          ) : !data.game ? (
            <LoadingState className="p-0" />
          ) : (
            <>
              <p className="flex items-center gap-2 font-bold">
                <StickerIcon name="sparkle" size={24} />
                <BilingualText as="span" text={t("gemsBalance", { n: data.game.gems })} />
              </p>
              <ShopRow
                icon="flame"
                name={t("freeze")}
                detail={t("freezeOwned", { n: data.game.freezes, max: data.game.max_freezes })}
                price={data.game.freeze_cost}
                disabled={data.game.freezes >= data.game.max_freezes || data.game.gems < data.game.freeze_cost}
                busy={data.game && actions.buying === "freeze"}
                onBuy={actions.buyFreeze}
                owned={data.game.freezes >= data.game.max_freezes}
              />
              {data.shop?.map((item) => (
                <ShopRow key={item.id} icon={item.icon as StickerIconName} name={tri(item.name)} price={item.price} owned={item.owned} disabled={item.owned || data.game!.gems < item.price} busy={actions.buying === item.id} onBuy={() => actions.buyItem(item.id)} />
              ))}
              <BilingualText size="sm" text={t("gemsNeverBlock")} />
            </>
          )}
        </PanelFrame>
      );
    case "field": {
      const pct = data.path?.lesson_count ? Math.round((100 * data.path.done_count) / data.path.lesson_count) : 0;
      return <PanelFrame icon={icon} title={t("field")} subtitle={t("fieldHint", { pct })} onClose={actions.close} />;
    }
    case "windmill":
      return (
        <PanelFrame icon={icon} title={t("windmill")} subtitle={t("windmillHint")} onClose={actions.close}>
          {data.stats && (
            <div className="flex items-center gap-3">
              <XPRing value={data.stats.xp_today} goal={data.stats.daily_goal} label={t("goalRing", { xp: data.stats.xp_today, goal: data.stats.daily_goal }).english} />
              <BilingualText size="sm" text={t("goalRing", { xp: data.stats.xp_today, goal: data.stats.daily_goal })} />
            </div>
          )}
          <LinkButton href="/farm/profile" variant="white" text={t("changeGoal")} />
        </PanelFrame>
      );
    default:
      return <PanelFrame icon={icon} title={t(place)} subtitle={t("pondHint")} onClose={actions.close} />;
  }
}

function ShopRow({ icon, name, detail, price, owned, disabled, busy, onBuy }: { icon: StickerIconName; name: BilingualString; detail?: BilingualString; price: number; owned: boolean; disabled: boolean; busy?: boolean; onBuy: () => void }) {
  const t = useBilingual("farm");
  return (
    <div className="flex items-center gap-3 rounded-card bg-white/90 p-2">
      <StickerIcon name={icon} size={32} />
      <div className="flex flex-1 flex-col">
        <BilingualText as="span" size="sm" text={name} />
        {detail && <BilingualText as="span" size="sm" text={detail} />}
      </div>
      <ChunkyButton size="sm" variant={owned ? "white" : "primary"} disabled={disabled} loading={busy} onClick={onBuy} aria-label={owned ? t("owned").english : t("buyFor", { n: price, item: name.english }).english}>
        {owned ? t("owned").regional : `${price}`}
        {!owned && <StickerIcon name="sparkle" size={18} />}
      </ChunkyButton>
    </div>
  );
}
