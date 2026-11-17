"use client";
import type { Badge, GameStats } from "@mooshala/api-client";
import { BadgeTile, BilingualText, Card, GoluMascot, ProgressBar, type StickerIconName } from "@/components/ui";
import { STICKER_ICON_NAMES } from "@/components/ui/StickerIcon";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { mascotProgress } from "./rules";

export interface GrowthAndBadgesProps {
  game: GameStats | undefined;
  badges: Badge[] | undefined;
  badgesError: unknown;
}

const iconOf = (name: string): StickerIconName => ((STICKER_ICON_NAMES as string[]).includes(name) ? (name as StickerIconName) : "star");

/** Golu's growth (calf → cow → champion, from XP) and the badge collection. */
export function GrowthAndBadges({ game, badges, badgesError }: GrowthAndBadgesProps) {
  const t = useBilingual("game");
  const tri = useTri();
  const progress = game ? mascotProgress(game.mascot) : null;
  return (
    <>
      {game && (
        <Card className="flex items-center gap-4" data-testid="mascot-growth">
          <GoluMascot pose={game.mascot.stage === "champion" ? "cool" : "wave"} size={game.mascot.stage === "calf" ? 64 : game.mascot.stage === "cow" ? 84 : 100} />
          <div className="flex flex-1 flex-col gap-2">
            <BilingualText as="h2" size="lg" text={t(`stage_${game.mascot.stage}`)} />
            {progress === null ? (
              <BilingualText size="sm" text={t("stageTop")} />
            ) : (
              <>
                <ProgressBar value={progress} tone="sun" label={t("toNextStage", { xp: game.mascot.xp_total, next: game.mascot.next_stage_xp ?? 0 }).english} />
                <BilingualText size="sm" text={t("toNextStage", { xp: game.mascot.xp_total, next: game.mascot.next_stage_xp ?? 0 })} />
              </>
            )}
          </div>
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <BilingualText as="h2" size="lg" text={t("badgesTitle")} />
        {badgesError ? (
          <BilingualText size="sm" text={t("badgesFailed")} />
        ) : !badges ? (
          <BilingualText size="sm" text={t("badgesLoading")} />
        ) : badges.length === 0 ? (
          <BilingualText size="sm" text={t("noBadges")} />
        ) : (
          <ul className="flex flex-wrap justify-center gap-3" data-testid="badge-shelf">
            {badges.map((b) => (
              <li key={b.id} className="flex flex-col items-center gap-1" data-earned={Boolean(b.earned_at)}>
                <BadgeTile name={tri(b.name)} icon={iconOf(b.icon)} earned={Boolean(b.earned_at)} lockedLabel={t("locked").english} />
                <BilingualText as="span" size="sm" align="center" text={b.earned_at ? tri(b.rule) : t("badgeProgress", { n: b.progress ?? 0, goal: b.goal ?? 0 })} className="w-32" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
