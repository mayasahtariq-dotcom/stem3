import type { GameStats, Schemas } from "@mooshala/api-client";
import { EMPTY_SCENE, type FarmSceneModel } from "@/three/world/scene-model";

/** Most lesson markers the path shows; the Learn list has the rest. */
export const MAX_STATIONS = 8;

/**
 * Turns server data into what the farm shows. Pure, so the mapping from
 * progress to the world is unit-tested. Nothing here invents a number: it
 * only re-presents the path and game stats the server sent.
 */
export function buildFarmScene(path: Schemas["PathOut"] | null | undefined, game: GameStats | null | undefined): FarmSceneModel {
  const lessons = path ? path.units.flatMap((u) => u.lessons) : [];
  // Show a window of markers around the current lesson.
  const currentIdx = Math.max(0, lessons.findIndex((l) => l.state === "current"));
  const start = Math.max(0, Math.min(currentIdx - 2, lessons.length - MAX_STATIONS));
  const shown = lessons.slice(start, start + MAX_STATIONS);
  const done = path?.done_count ?? 0;
  const total = path?.lesson_count ?? 0;
  const progress = total ? done / total : 0;
  return {
    ...EMPTY_SCENE,
    stations: shown.map((l) => ({ id: l.id, state: l.state, position: [0, 0, 0] })),
    flowerCount: Math.max(6, Math.min(16, total)),
    bloomedFlowers: Math.min(16, done),
    cropGrowth: 0.2 + 0.8 * progress,
    courseProgress: progress,
    decorations: game?.owned.filter((id) => id.startsWith("deco-")) ?? [],
    mascot: game ? { stage: game.mascot.stage, outfit: game.mascot.outfit } : EMPTY_SCENE.mascot,
    potWaiting: Boolean(game?.pending_pots.length),
  };
}

export type PathLesson = Schemas["PathLesson"];

export function findLesson(path: Schemas["PathOut"] | null | undefined, id: string) {
  if (!path) return null;
  for (const [ui, u] of path.units.entries()) {
    const i = u.lessons.findIndex((l) => l.id === id);
    if (i >= 0) return { unit: u, unitIndex: ui, lesson: u.lessons[i]! };
  }
  return null;
}
