/**
 * Every 3D asset the farm loads, in one place. Conventions (see
 * docs/web/architecture.md): binary glTF (.glb) under public/models, metres,
 * Y up, origin at the base centre, +Z facing the camera, under ~50 KB for
 * props, flat-shaded with token colours. Each entry declares a procedural
 * fallback so a missing or broken file degrades to a simple shape rather than
 * breaking the farm.
 */
export const FARM_ASSETS = {
  tree: { url: "/models/tree.glb", scale: 1 },
  hayBale: { url: "/models/hay-bale.glb", scale: 1 },
} as const;

export type FarmAssetId = keyof typeof FARM_ASSETS;

export const assetUrl = (id: FarmAssetId) => FARM_ASSETS[id].url;
