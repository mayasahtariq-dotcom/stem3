import { color } from "@mooshala/tokens";

/**
 * Bright, sunny late-morning lighting: a gradient sky, a warm shadow-casting
 * sun and a sky/grass hemisphere fill, with a light blue haze for depth.
 * Shadow camera bounds are tight around the farm for crisp shadows at a
 * small map size.
 */
export const LIGHTING = {
  background: "#8FD0F7",
  sky: { top: "#2F8DE4", middle: "#79C2F4", horizon: "#E4F5FF" },
  hills: { near: "#78B85A", far: "#93B6CF" },
  fog: { color: "#D4ECFA", near: 75, far: 210 },
  hemisphere: { sky: "#C8EBFF", ground: color.leaf, intensity: 1.2 },
  sun: {
    color: "#FFE7B5",
    intensity: 2.9,
    position: [30, 42, 18] as [number, number, number],
    shadowBounds: 40,
    shadowBias: -0.0004,
    shadowNormalBias: 0.04,
  },
} as const;
