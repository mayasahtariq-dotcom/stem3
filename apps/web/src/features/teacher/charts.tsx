"use client";
import { BilingualText, ProgressBar } from "@/components/ui";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { pct } from "./shared";

/** A labelled meter row: name on the left, percent on the right, a farm-style bar under it. */
export function MeterRow({ label, value, tone }: { label: BilingualString; value: number | null; tone?: "grass" | "sun" | "sky" }) {
  const t = tone ?? (value === null ? "sky" : value >= 0.75 ? "grass" : "sun");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <BilingualText size="sm" text={label} className="flex-1" />
        <span className="font-extrabold tabular-nums">{pct(value)}</span>
      </div>
      <ProgressBar value={value ?? 0} label={`${label.english}: ${pct(value)}`} tone={t} />
    </div>
  );
}

/** Weekly accuracy as rounded columns (oldest left). Text alternative in the label. */
export function TrendColumns({ points, label }: { points: { week: number; accuracy: number }[]; label: string }) {
  if (!points.length) return null;
  return (
    <figure aria-label={label} className="flex h-36 items-end gap-2" data-testid="trend-chart">
      {points.map((p) => (
        <div key={p.week} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold tabular-nums">{pct(p.accuracy)}</span>
          <div className="w-full rounded-t-card bg-grass" style={{ height: `${Math.max(6, p.accuracy * 100)}px` }} />
          <span className="text-xs text-stone">{p.week === 0 ? "•" : p.week}</span>
        </div>
      ))}
    </figure>
  );
}

/** A big ring for one headline percentage. */
export function Ring({ value, label, size = 96 }: { value: number | null; label: string; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct(value)}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-grass)" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" className="fill-ink text-lg font-extrabold">
        {pct(value)}
      </text>
    </svg>
  );
}
