import { color, elevation, motion, radius, space, typography } from "./index.ts";

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * Renders the tokens as a Tailwind v4 `@theme` block (so `bg-grass`,
 * `rounded-card`, `text-lg`, `shadow-float-1` exist and every value is also a CSS
 * variable on :root), plus plain variables Tailwind has no namespace for.
 */
export function renderTokensCss(): string {
  const lines: string[] = [];
  const root: string[] = [];
  for (const [k, v] of Object.entries(color)) lines.push(`  --color-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(radius)) lines.push(`  --radius-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(space)) root.push(`  --space-${k}: ${v}px;`);
  for (const [k, [size, lh]] of Object.entries(typography.size)) {
    lines.push(`  --text-${k}: ${size}px;`);
    lines.push(`  --text-${k}--line-height: ${lh}px;`);
  }
  lines.push(`  --shadow-float-1: ${elevation.float1};`);
  lines.push(`  --shadow-float-2: ${elevation.float2};`);
  lines.push(`  --shadow-inset: ${elevation.inset};`);
  lines.push(`  --ease-out: ${motion.easeOut};`);
  lines.push(`  --ease-spring: ${motion.easeSpring};`);
  root.push(`  --lip: ${elevation.lipPx}px;`);
  root.push(`  --press: ${elevation.pressPx}px;`);
  for (const k of ["instant", "fast", "base", "slow", "celebrate"] as const) {
    root.push(`  --duration-${k}: ${motion[k]}ms;`);
  }
  return [
    "/* Generated from src/index.ts by `pnpm --filter @mooshala/tokens generate`. Do not edit. */",
    "@theme {",
    ...lines,
    "}",
    "",
    ":root {",
    ...root,
    "}",
    "",
  ].join("\n");
}
