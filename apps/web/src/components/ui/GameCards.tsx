import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { BilingualText } from "./BilingualText";
import { ProgressBar } from "./ProgressBar";
import { StickerIcon, type StickerIconName } from "./StickerIcon";

/* Presentational game cards; data and rules come from the server in later phases. */

export interface LeagueRowProps {
  rank: number;
  name: string;
  xp: number;
  xpLabel: string;
  isSelf?: boolean;
  /** Call-only students show a phone marker (web PRD section 5). */
  callOnly?: boolean;
  callOnlyLabel?: string;
  zone?: "promote" | "demote" | null;
}

export function LeagueRow({ rank, name, xp, xpLabel, isSelf, callOnly, callOnlyLabel, zone }: LeagueRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-card border-2 px-4 py-2",
        isSelf ? "border-sky-strong bg-sky-soft" : "border-transparent bg-white",
      )}
    >
      <span className={cn("w-7 text-center font-extrabold tabular-nums", zone === "promote" ? "text-grass-strong" : zone === "demote" ? "text-coral-strong" : "text-stone")}>
        {rank}
      </span>
      <span className="flex-1 truncate font-bold">{name}</span>
      {callOnly && <StickerIcon name="speaker" size={20} label={callOnlyLabel} />}
      <span className="font-bold tabular-nums text-stone">
        {xp} <span className="text-xs">{xpLabel}</span>
      </span>
    </div>
  );
}

export interface QuestCardProps {
  title: BilingualString;
  progress: number;
  goal: number;
  progressLabel: string;
  icon?: StickerIconName;
  done?: boolean;
}

export function QuestCard({ title, progress, goal, progressLabel, icon = "target", done }: QuestCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-card border-2 border-line bg-white p-4">
      <StickerIcon name={done ? "trophy" : icon} size={36} />
      <div className="flex flex-1 flex-col gap-2">
        <BilingualText text={title} size="sm" />
        <ProgressBar value={goal ? progress / goal : 0} label={progressLabel} tone="sun" className="h-3" />
      </div>
      <span className="text-sm font-bold tabular-nums text-stone">
        {progress}/{goal}
      </span>
    </div>
  );
}

export interface BadgeTileProps {
  name: BilingualString;
  icon: StickerIconName;
  earned: boolean;
  lockedLabel?: string;
}

export function BadgeTile({ name, icon, earned, lockedLabel }: BadgeTileProps) {
  return (
    <div className={cn("flex w-32 flex-col items-center gap-2 rounded-card border-2 p-3 text-center", earned ? "border-berry bg-white" : "border-line bg-parchment")}>
      <span className={cn("grid size-16 place-items-center rounded-full", earned ? "bg-[#f4e6ff]" : "bg-line")}>
        <StickerIcon name={earned ? icon : "lock"} size={36} />
      </span>
      <BilingualText text={name} size="sm" align="center" />
      {!earned && lockedLabel && <span className="sr-only">{lockedLabel}</span>}
    </div>
  );
}

export interface SourceChipProps {
  /** e.g. "Notes p. 3" */
  label: string;
  href?: string;
}

/** Cites the exact notes page an answer came from. */
export function SourceChip({ label, href }: SourceChipProps) {
  const cls = "inline-flex min-h-8 items-center gap-1.5 rounded-full border-2 border-line bg-parchment px-3 text-sm font-semibold text-ink";
  const body = (
    <>
      <StickerIcon name="doc" size={18} />
      {label}
    </>
  );
  return href ? (
    <a href={href} className={cn(cls, "underline-offset-2 hover:underline")}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}
