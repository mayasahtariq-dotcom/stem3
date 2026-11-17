import type { FieldId } from "@/lib/world/fields";
import { DEFAULT_PALETTE, type TerrainPalette } from "./Terrain";

export interface FieldLook {
  palette: TerrainPalette;
  grass: string;
  grassDensity: number;
  sun: { color: string; intensity: number; position: [number, number, number] };
  hemi: { sky: string; ground: string; intensity: number };
  fog: { color: string; near: number; far: number };
  envIntensity: number;
  rainbow?: boolean;
  bubbles?: boolean;
  /** Camera start: position and target. */
  camera: { position: [number, number, number]; target: [number, number, number] };
}

const SUN: [number, number, number] = [40, 55, 25];

/** Each field's atmosphere: light, haze and ground colours. */
export const FIELD_LOOKS: Record<FieldId, FieldLook> = {
  "starter-meadow": {
    palette: DEFAULT_PALETTE,
    grass: "#86c94e",
    grassDensity: 1,
    sun: { color: "#fff0d2", intensity: 3, position: SUN },
    hemi: { sky: "#cdeaff", ground: "#5d8a35", intensity: 1.1 },
    fog: { color: "#cfe7f7", near: 70, far: 230 },
    envIntensity: 0.35,
    rainbow: true,
    bubbles: true,
    camera: { position: [7, 8.5, 38], target: [0, 2.5, 0] },
  },
  "blossom-meadow": {
    palette: { ...DEFAULT_PALETTE, grassA: "#63b043", grassB: "#94cc55", meadow: "#c4dc6a", stone: "#cfc4b5" },
    grass: "#78bd48",
    grassDensity: 0.9,
    sun: { color: "#fff1e6", intensity: 2.9, position: [30, 50, 35] },
    hemi: { sky: "#f4e6ff", ground: "#6a9a40", intensity: 1.15 },
    fog: { color: "#f3e3f2", near: 70, far: 220 },
    envIntensity: 0.4,
    bubbles: true,
    camera: { position: [4, 8, 36], target: [0, 2, -2] },
  },
  "golden-valley": {
    palette: { ...DEFAULT_PALETTE, grassA: "#7aa83a", grassB: "#a8bf4a", meadow: "#d4c45a", soil: "#7a5634", dirt: "#c49a5e" },
    grass: "#8fb444",
    grassDensity: 0.8,
    sun: { color: "#ffd9a0", intensity: 3.1, position: [55, 38, 20] },
    hemi: { sky: "#ffe9c8", ground: "#8a8a3a", intensity: 1.05 },
    fog: { color: "#f6e2bf", near: 70, far: 240 },
    envIntensity: 0.35,
    camera: { position: [8, 11, 44], target: [-2, 2, 0] },
  },
  "woodland-farm": {
    palette: { ...DEFAULT_PALETTE, grassA: "#3f8a33", grassB: "#5ea13c", meadow: "#7fb04a", dirt: "#8f6a45" },
    grass: "#4f9a38",
    grassDensity: 1.1,
    sun: { color: "#fff0cf", intensity: 2.6, position: [25, 50, 30] },
    hemi: { sky: "#cfe8e0", ground: "#3d6a2a", intensity: 1 },
    fog: { color: "#c7dccf", near: 45, far: 170 },
    envIntensity: 0.3,
    camera: { position: [6, 8, 34], target: [0, 2, -2] },
  },
  "mountain-paradise": {
    palette: { ...DEFAULT_PALETTE, grassA: "#5aa53f", grassB: "#86c25a", meadow: "#b0d36d", rock: "#8a8780" },
    grass: "#6aae45",
    grassDensity: 0.85,
    sun: { color: "#fff6e6", intensity: 3.2, position: [35, 60, 30] },
    hemi: { sky: "#d6ecff", ground: "#5a8a40", intensity: 1.15 },
    fog: { color: "#dcecf8", near: 90, far: 280 },
    envIntensity: 0.4,
    camera: { position: [6, 12, 40], target: [0, 4, -6] },
  },
};
