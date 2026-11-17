"use client";
import { cn } from "@/lib/utils/cn";

/*
 * Farm-themed answer feedback (no confetti, no generic stars): a seed sprouts
 * and a flower blooms for a right answer; a young plant bends in the wind and
 * springs back for "not quite"; a basket fills as XP is harvested. Pure SVG +
 * CSS, decorative only (the text next to them says what happened).
 */

export function SproutBloom({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={className} data-testid="sprout-bloom">
      <ellipse cx="50" cy="90" rx="30" ry="7" fill="var(--color-soil)" />
      <g className="anim-grow">
        <path d="M50 88 C50 70 48 58 50 44" stroke="var(--color-leaf)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M50 70 C40 66 34 58 33 52 C42 52 48 58 50 66Z" fill="var(--color-grass)" />
        <path d="M50 62 C60 58 66 50 67 44 C58 44 52 50 50 58Z" fill="var(--color-grass)" />
      </g>
      <g className="anim-bloom">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="50" cy="30" rx="7" ry="12" fill="var(--color-berry)" transform={`rotate(${r} 50 40)`} />
        ))}
        <circle cx="50" cy="40" r="7" fill="var(--color-sun)" />
      </g>
    </svg>
  );
}

export function BendingPlant({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={className} data-testid="bending-plant">
      <ellipse cx="50" cy="90" rx="30" ry="7" fill="var(--color-soil)" />
      <g className="anim-bend">
        <path d="M50 88 C50 72 50 60 50 48" stroke="var(--color-leaf)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M50 66 C40 62 35 55 34 49 C43 49 48 55 50 62Z" fill="var(--color-grass)" />
        <path d="M50 58 C60 54 65 47 66 41 C57 41 52 47 50 54Z" fill="var(--color-grass)" />
        <circle cx="50" cy="44" r="6" fill="var(--color-meadow)" />
      </g>
      <path d="M12 30 q10 -6 20 0 t20 0" stroke="var(--color-sky)" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

/** A woven basket holding up to 10 harvest items (one per 10 XP). */
export function HarvestBasket({ items, size = 140, className }: { items: number; size?: number; className?: string }) {
  const n = Math.max(0, Math.min(10, items));
  const spots = [[30, 46], [44, 42], [58, 44], [72, 46], [37, 36], [51, 33], [65, 36], [44, 26], [58, 26], [51, 18]];
  const fruit = ["var(--color-coral)", "var(--color-sun)", "var(--color-flame)", "var(--color-grass)"];
  return (
    <svg viewBox="0 0 100 80" width={size} height={(size * 80) / 100} aria-hidden className={className} data-testid="harvest-basket" data-items={n}>
      {spots.slice(0, n).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill={fruit[i % fruit.length]} className="anim-drop" style={{ animationDelay: `${i * 90}ms` }} stroke="rgb(0 0 0 / .15)" />
      ))}
      <path d="M14 48 h72 l-8 26 h-56z" fill="var(--color-wood-light)" stroke="var(--color-wood-dark)" strokeWidth="2" />
      {[56, 64].map((y) => (
        <path key={y} d={`M${16 + (y - 48) / 3} ${y} h${68 - ((y - 48) * 2) / 3}`} stroke="var(--color-wood)" strokeWidth="2" />
      ))}
      <path d="M24 48 C24 20 76 20 76 48" stroke="var(--color-wood-dark)" strokeWidth="3" fill="none" />
    </svg>
  );
}

/** A small wooden chest, used when a lesson ends; the lid opens once. */
export function FarmChest({ open, size = 96, className }: { open?: boolean; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 80" width={size} height={(size * 80) / 100} aria-hidden className={cn(className)} data-testid="farm-chest" data-open={open ? "true" : "false"}>
      <rect x="14" y="36" width="72" height="38" rx="5" fill="var(--color-wood)" stroke="var(--color-wood-dark)" strokeWidth="3" />
      {open && <ellipse cx="50" cy="38" rx="28" ry="6" fill="var(--color-sun)" opacity=".85" />}
      <g className={open ? "anim-lid" : undefined}>
        <path d="M14 38 C14 18 86 18 86 38 Z" fill="var(--color-wood-light)" stroke="var(--color-wood-dark)" strokeWidth="3" />
      </g>
      <rect x="45" y="40" width="10" height="12" rx="2" fill="var(--color-sun)" stroke="var(--color-wood-dark)" strokeWidth="2" />
    </svg>
  );
}

/** The "+10 XP" that floats up after a right answer (value from the server). */
export function XpPop({ value, label }: { value: number; label: string }) {
  if (value <= 0) return null;
  return (
    <span className="anim-float pointer-events-none absolute -top-2 right-4 font-extrabold text-flame" aria-hidden>
      {label}
    </span>
  );
}
