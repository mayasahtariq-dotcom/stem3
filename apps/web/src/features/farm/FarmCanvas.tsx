"use client";
import type { ReactNode } from "react";
import type { PlacedObject } from "@mooshala/api-client";
import type { FieldId } from "@/lib/world/fields";
import { SceneContainer, type SceneOverlays } from "@/three/engine/SceneContainer";
import type { QualitySettings } from "@/three/engine/quality";
import type { SceneStatus } from "@/three/engine/scene-status";
import type { FarmSceneModel } from "@/three/world/scene-model";
import { WorldScene, type PlacementView } from "@/three/worlds/WorldScene";

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
  field: FieldId;
  placed: PlacedObject[];
  onPickPlaced?: (uid: string) => void;
  placement?: PlacementView;
}

/** The 3D bundle boundary: everything three.js lives behind this lazily loaded module. */
export default function FarmCanvas({ quality, overlays, label, scene, selected, onSelect, reducedMotion, onError, onStatusChange, extras, field, placed, onPickPlaced, placement }: FarmCanvasProps): ReactNode {
  return (
    <SceneContainer quality={quality} overlays={overlays} label={label} onError={onError} onStatusChange={onStatusChange}>
      <WorldScene key={field} field={field} quality={quality} scene={scene} selected={selected} onSelect={onSelect} reducedMotion={reducedMotion} placed={placed} onPickPlaced={onPickPlaced} placement={placement} extras={extras} />
    </SceneContainer>
  );
}
