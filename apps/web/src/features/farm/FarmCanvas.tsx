"use client";
import type { ReactNode } from "react";
import { SceneContainer, type SceneOverlays } from "@/three/engine/SceneContainer";
import type { QualitySettings } from "@/three/engine/quality";
import type { SceneStatus } from "@/three/engine/scene-status";
import { FarmWorld } from "@/three/world/FarmWorld";
import type { FarmSceneModel } from "@/three/world/scene-model";

export interface FarmCanvasProps {
  quality: QualitySettings;
  overlays: SceneOverlays;
  label: string;
  scene: FarmSceneModel;
  selected: string | null;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  onError: (e: unknown) => void;
  onStatusChange?: (s: SceneStatus) => void;
  extras?: ReactNode;
}

/** The 3D bundle boundary: everything three.js lives behind this lazily loaded module. */
export default function FarmCanvas({ quality, overlays, label, scene, selected, onSelect, reducedMotion, onError, onStatusChange, extras }: FarmCanvasProps): ReactNode {
  return (
    <SceneContainer quality={quality} overlays={overlays} label={label} onError={onError} onStatusChange={onStatusChange}>
      <FarmWorld quality={quality} scene={scene} selected={selected} onSelect={onSelect} reducedMotion={reducedMotion} onAssetError={onError} extras={extras} />
    </SceneContainer>
  );
}
