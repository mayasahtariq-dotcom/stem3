/**
 * Mooshala design tokens: the single source of truth.
 *
 * `tokens.css` (CSS variables used by Tailwind and every component) is generated
 * from this file with `pnpm --filter @mooshala/tokens generate`; a test fails if
 * the two drift apart. The 3D farm reads the same values (as hex) for materials,
 * so the HUD and the world always share one palette.
 *
 * Brand colours come from the web PRD (section 6). The farm extensions (leaf,
 * wood, cream, soil...) add the natural, tactile range the 3D farm needs.
 */

export const color = {
  // Brand (web PRD section 6)
  grass: "#58CC02", // progress fills, correct state, 3D grass highlights
  sky: "#1CB0F6", // info, links on dark, league
  sun: "#FFC800", // XP, gems, streak glow
  flame: "#FF9600", // streak, combo
  berry: "#CE82FF", // badges, rare rewards
  coral: "#FF4B4B", // soft "Not quite" and hearts only
  ink: "#3C3C3C", // text
  cloud: "#F7F7F7", // neutral background

  // Accessible "strong" shades: text-on-colour or colour-as-text that passes WCAG AA
  grassStrong: "#2F7A00", // primary button face (white text 5.4:1)
  grassEdge: "#1F5200", // chunky button lip
  skyStrong: "#0A6FAD", // links on light backgrounds (5.4:1 on white)
  skyEdge: "#07507D",
  coralStrong: "#C62828", // error text (5.6:1 on white)
  sunEdge: "#C79A00",

  // Farm extensions
  leaf: "#3E9A2A", // foliage
  meadow: "#8EE07A", // light grass
  skySoft: "#DDF3FE", // sky wash, info panels
  sunSoft: "#FFF1B8", // highlight wash
  wood: "#8B5A2B", // signposts, panels, frames
  woodLight: "#C08A55",
  woodDark: "#5C3A1A", // wood lip and outlines
  soil: "#6B4A2E", // tilled earth
  cream: "#FFF8EC", // card and page surface
  parchment: "#F3E7CF", // inset surfaces
  line: "#E6DCC8", // borders on cream
  stone: "#6B6257", // muted text (5.7:1 on cream; never lighter)
  white: "#FFFFFF",
} as const;

export type ColorToken = keyof typeof color;

/** Corner radii in px (web PRD: 16 px cards, 12 px buttons). */
export const radius = {
  sm: 8,
  button: 12,
  card: 16,
  panel: 20,
  pill: 999,
} as const;

/** 4 px spacing scale. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Type scale in px, with line heights. Regional lines use the Noto fonts. */
export const typography = {
  fontLatin: "Rubik",
  fontDevanagari: "Noto Sans Devanagari",
  fontKannada: "Noto Sans Kannada",
  size: {
    xs: [13, 18],
    sm: [15, 21],
    base: [17, 24],
    lg: [20, 27],
    xl: [24, 31],
    "2xl": [30, 37],
    "3xl": [38, 44],
  },
} as const;

/**
 * Elevation. "Lip" shadows give the chunky, pressable 3D edge; "float" shadows
 * lift panels off the 3D world.
 */
export const elevation = {
  lipPx: 5, // height of a chunky button's edge
  pressPx: 4, // how far a pressed button drops
  float1: "0 4px 12px rgba(60, 40, 20, 0.14)",
  float2: "0 10px 28px rgba(60, 40, 20, 0.22)",
  inset: "inset 0 2px 0 rgba(60, 40, 20, 0.08)",
} as const;

/** Animation timings in ms, and easings. Reduced motion swaps motion for fades. */
export const motion = {
  instant: 80,
  fast: 140,
  base: 220,
  slow: 360,
  celebrate: 700,
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  easeSpring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/** Breakpoints in px (web PRD section 6). */
export const breakpoint = {
  phone: 360,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
} as const;

/** Minimum touch target in px. */
export const touchTarget = 44;

export const tokens = { color, radius, space, typography, elevation, motion, breakpoint, touchTarget };
