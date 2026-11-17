import { cn } from "@/lib/utils/cn";

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label: string;
  tone?: "grass" | "sun" | "sky";
  className?: string;
}

const TONES = { grass: "bg-grass", sun: "bg-sun", sky: "bg-sky" } as const;

/** Chunky progress bar with a glossy highlight. Determinate, with ARIA values. */
export function ProgressBar({ value, label, tone = "grass", className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-4 w-full overflow-hidden rounded-full bg-line shadow-[inset_0_2px_0_rgb(0_0_0/0.08)]", className)}
    >
      <div
        className={cn(
          "relative h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-out",
          "after:absolute after:inset-x-2 after:top-1 after:h-1 after:rounded-full after:bg-white/40",
          TONES[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
