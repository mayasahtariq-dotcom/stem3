import type { MascotStage } from "@mooshala/api-client";
import type { Station } from "./stations";

/**
 * Everything the 3D farm shows that depends on the student's progress. Built
 * from server data by features/farm/farm-model.ts; the scene only renders it.
 */
export interface FarmSceneModel {
  stations: Station[];
  /** Flower beds along the path, and how many have bloomed (one per finished lesson). */
  flowerCount: number;
  bloomedFlowers: number;
  /** 0..1: crops grow as the course is completed. */
  cropGrowth: number;
  /** 0..1: the signboard's progress rail. */
  courseProgress: number;
  /** Bought or earned decorations (item ids). */
  decorations: string[];
  mascot: { stage: MascotStage; outfit: string | null };
  /** Phase 4: a Golu Pot waiting to be opened. */
  potWaiting: boolean;
}

export const EMPTY_SCENE: FarmSceneModel = {
  stations: [],
  flowerCount: 6,
  bloomedFlowers: 0,
  cropGrowth: 0.2,
  courseProgress: 0,
  decorations: [],
  mascot: { stage: "calf", outfit: null },
  potWaiting: false,
};

export const FARM_PLACES = ["barn", "farmhouse", "lab", "signboard", "market", "golu", "field", "windmill", "pond"] as const;
export type FarmPlace = (typeof FARM_PLACES)[number];
