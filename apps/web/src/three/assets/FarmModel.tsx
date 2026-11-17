"use client";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import type * as THREE from "three";
import { FARM_ASSETS, type FarmAssetId } from "./registry";

/** Loads a registered GLB and returns a shadow-ready clone for this instance. */
function LoadedModel({ id }: { id: FarmAssetId }) {
  const { scene } = useGLTF(FARM_ASSETS[id].url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={clone} scale={FARM_ASSETS[id].scale} />;
}

interface BoundaryProps {
  fallback: ReactNode;
  onError?: (error: unknown) => void;
  children: ReactNode;
}

/** Per-asset error boundary: a broken model falls back instead of failing the farm. */
export class AssetBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface FarmModelProps {
  id: FarmAssetId;
  /** Procedural stand-in, shown while loading and if the file fails. */
  fallback: ReactNode;
  onError?: (error: unknown) => void;
}

export function FarmModel({ id, fallback, onError }: FarmModelProps) {
  return (
    <AssetBoundary fallback={fallback} onError={onError}>
      <Suspense fallback={fallback}>
        <LoadedModel id={id} />
      </Suspense>
    </AssetBoundary>
  );
}

/** Starts downloading every registered model (call once when the farm mounts). */
export function preloadFarmAssets() {
  for (const a of Object.values(FARM_ASSETS)) useGLTF.preload(a.url);
}
