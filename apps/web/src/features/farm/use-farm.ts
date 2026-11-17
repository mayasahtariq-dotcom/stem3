"use client";
import { useMemo } from "react";
import { useGameStats } from "@/features/game/api";
import { useHome, usePath } from "@/features/learning/api";
import { buildFarmScene } from "./farm-model";

/** Server data behind the farm: home, the first course's path, and game stats. */
export function useFarmData() {
  const home = useHome();
  const courseId = home.data?.continue_lesson?.course_id ?? home.data?.courses[0]?.id ?? null;
  const path = usePath(courseId);
  const game = useGameStats();
  const scene = useMemo(() => buildFarmScene(path.data, game.data), [path.data, game.data]);
  return { home, path, game, courseId, scene };
}
