import { cn } from "@/lib/utils/cn";
import { StickerIcon } from "./StickerIcon";

/*
 * Game-stat displays. They only SHOW numbers the server sends (web PRD section 3:
 * "the server owns every number"); none of them compute XP, streaks or hearts.
 */

interface StatProps {
  value: number;
  /** Full accessible label, e.g. "5 day streak". */
  label: string;
  className?: string;
}

const pill = "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/95 px-3 font-bold tabular-nums text-ink shadow-float-1";

export function StreakFlame({ value, label, active = true, className }: StatProps & { active?: boolean }) {
  return (
    <span className={cn(pill, className)} aria-label={label} role="img">
      <StickerIcon name="flame" size={24} className={cn(active ? "motion-safe:animate-[flicker_1.6s_ease-in-out_infinite]" : "grayscale")} />
      <span aria-hidden>{value}</span>
    </span>
  );
}

export function GemCounter({ value, label, className }: StatProps) {
  return (
    <span className={cn(pill, className)} aria-label={label} role="img">
      <StickerIcon name="sparkle" size={24} />
      <span aria-hidden>{value}</span>
    </span>
  );
}

export function HeartMeter({ value, max = 5, label, className }: StatProps & { max?: number }) {
  return (
    <span className={cn(pill, className)} aria-label={label} role="img">
      <StickerIcon name="heart" size={24} className={value === 0 ? "grayscale" : undefined} />
      <span aria-hidden>{value}</span>
      <span aria-hidden className="text-xs font-medium text-stone">/{max}</span>
    </span>
  );
}

/** Ring that fills towards the daily XP goal. */
export function XPRing({ value, goal, label, size = 56, className }: StatProps & { goal: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <span role="img" aria-label={label} className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="var(--color-line)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-sun)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset var(--duration-slow) var(--ease-out)" }}
        />
      </svg>
      <span aria-hidden className="absolute text-xs font-extrabold tabular-nums">{value}</span>
    </span>
  );
}

export interface TopStatsBarProps {
  streak: { value: number; label: string };
  gems: { value: number; label: string };
  hearts: { value: number; label: string };
  className?: string;
}

/** The HUD row of game stats. */
export function TopStatsBar({ streak, gems, hearts, className }: TopStatsBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StreakFlame {...streak} />
      <GemCounter {...gems} />
      <HeartMeter {...hearts} />
    </div>
  );
}
