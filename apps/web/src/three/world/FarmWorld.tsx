"use client";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { CAMERA, ORBIT_LIMITS } from "../config/camera";
import { LIGHTING } from "../config/lighting";
import { preloadFarmAssets } from "../assets/FarmModel";
import type { QualitySettings } from "../engine/quality";
import { Chicken, Cow, Duck } from "./animals";
import { Farmhouse, Lab, MarketStall, Signboard } from "./buildings";
import { Bubbles, DistantHills, HorizonClouds, Rainbow, SkyDome, WanderingButterflies } from "./atmosphere";
import { Decorations } from "./decorations";
import { Interactable } from "./Interactable";
import { GoluPot } from "./pot";
import { flowerSpots, PASTURE, PLACES, stationPositions } from "./layout";
import { Barn, CropField, Fence, HayBale, Tree, Windmill } from "./objects";
import { Bush, Butterflies, Clouds, Flower, GrassTufts, PondRipples, Stream, WindClock } from "./nature";
import { EMPTY_SCENE, type FarmSceneModel } from "./scene-model";
import { LessonStations } from "./stations";
import { Terrain } from "./Terrain";
import { FIELD, POND, terrainHeight } from "./terrain-math";

export { FARM_PLACES, type FarmPlace } from "./scene-model";

export interface FarmWorldProps {
  quality: QualitySettings;
  scene?: FarmSceneModel;
  /** A place id ("barn") or a lesson marker id ("lesson:<id>"). */
  selected?: string | null;
  onSelect?: (id: string) => void;
  reducedMotion?: boolean;
  onAssetError?: (error: unknown) => void;
  /** Off in tests (no DOM element for OrbitControls). */
  controls?: boolean;
  /** Phase 4 adds the Golu Pot and other game objects here. */
  extras?: React.ReactNode;
}

const TREES: [number, number, number][] = [
  [-20, -14, 1.1], [-24, -4, 0.9], [-18, 22, 1.2], [22, 16, 1], [26, 4, 1.3],
  [-6, -24, 1], [6, -26, 1.15], [30, -18, 0.95], [-30, 12, 1.05], [16, 28, 1.1],
  [-26, 26, 1], [24, -8, 0.9], [-14, -22, 1.1], [18, -24, 1],
];
const BUSHES: [number, number, number][] = [[-7, -2, 1], [6, 2, 0.8], [-9, 5, 0.9], [14, 10, 1], [-16, 4, 0.8], [4, -10, 0.9], [-4, 18, 1], [9, 19, 0.8]];
const PASTURE_COWS: [number, number, number, number][] = [[-1.5, -15, 0.4, 0], [3, -17, -2.2, 1.7], [5.5, -14.8, 2.6, 3.1]];
const CHICKENS: [number, number][] = [[11.5, 3.5], [12.6, 4.4], [10.8, 4.8]];

/** Pulls the camera back on portrait screens so the whole farmstead fits a phone. */
function PortraitFit() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const k = aspect < 1 ? Math.min(1.9, 1 / aspect) : 1;
    camera.position.set(CAMERA.position[0] * k, CAMERA.position[1] * k, CAMERA.position[2] * k);
    camera.updateProjectionMatrix();
  }, [aspect, camera]);
  return null;
}

/** Next to Golu, where a waiting pot sits. */
const POT_SPOT = { x: PLACES.golu.x - 2.4, z: PLACES.golu.z - 0.8 };

const at = (x: number, z: number): [number, number, number] => [x, terrainHeight(x, z), z];

/**
 * The student's farm: terrain, buildings that are learning destinations,
 * lesson markers along the path, animals and idle life. Progress shows in the
 * world (flowers bloom, crops grow, bought decorations appear).
 */
export function FarmWorld({ quality, scene = EMPTY_SCENE, selected, onSelect, reducedMotion, onAssetError, controls = true, extras }: FarmWorldProps) {
  useEffect(() => {
    preloadFarmAssets();
  }, []);
  const select = (id: string) => onSelect?.(id);
  const segments = quality.tier === "low" ? 64 : quality.tier === "medium" ? 96 : 128;
  const treeCount = Math.max(5, Math.round(TREES.length * quality.detail));
  const grass = Math.round(420 * quality.detail);
  const stations = scene.stations.length ? scene.stations : [];
  const positions = stationPositions(stations.length);
  const flowers = flowerSpots(scene.flowerCount);
  // Golu is the hero of the farm: bigger than the herd, in the foreground.
  const mascotScale = (scene.mascot.stage === "calf" ? 0.75 : scene.mascot.stage === "cow" ? 1 : 1.15) * 2;
  const place = (id: keyof typeof PLACES) => ({ id, position: at(PLACES[id].x, PLACES[id].z), rotationY: PLACES[id].rotationY, selected: selected === id, onSelect: select, reducedMotion });

  return (
    <>
      <WindClock reducedMotion={reducedMotion} />
      <hemisphereLight args={[LIGHTING.hemisphere.sky, LIGHTING.hemisphere.ground, LIGHTING.hemisphere.intensity]} />
      <directionalLight
        color={LIGHTING.sun.color}
        intensity={LIGHTING.sun.intensity}
        position={LIGHTING.sun.position}
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-bias={LIGHTING.sun.shadowBias}
        shadow-normalBias={LIGHTING.sun.shadowNormalBias}
        shadow-camera-left={-LIGHTING.sun.shadowBounds}
        shadow-camera-right={LIGHTING.sun.shadowBounds}
        shadow-camera-top={LIGHTING.sun.shadowBounds}
        shadow-camera-bottom={-LIGHTING.sun.shadowBounds}
      />

      <SkyDome />
      <DistantHills count={quality.tier === "low" ? 12 : 22} />
      <Rainbow />
      <HorizonClouds count={quality.tier === "low" ? 5 : 9} reducedMotion={reducedMotion} />
      <Terrain segments={segments} receiveShadow={quality.shadows} />
      {quality.tier !== "low" && <GrassTufts count={grass} />}
      <Stream reducedMotion={reducedMotion} />
      <PondRipples reducedMotion={reducedMotion} />
      <Clouds count={quality.tier === "low" ? 3 : 6} reducedMotion={reducedMotion} />

      {/* Learning destinations */}
      <Interactable {...place("barn")}>
        <Barn />
      </Interactable>
      <Interactable {...place("farmhouse")}>
        <Farmhouse />
      </Interactable>
      <Interactable {...place("lab")}>
        <Lab />
      </Interactable>
      <Interactable {...place("signboard")}>
        <Signboard progress={scene.courseProgress} />
      </Interactable>
      <Interactable {...place("market")}>
        <MarketStall />
      </Interactable>
      <Interactable {...place("golu")}>
        <Cow bell reducedMotion={reducedMotion} scale={mascotScale} outfit={scene.mascot.outfit} champion={scene.mascot.stage === "champion"} offset={0.7} />
      </Interactable>
      {scene.potWaiting && (
        <Interactable id="pot" position={at(POT_SPOT.x, POT_SPOT.z)} rotationY={0} selected={selected === "pot"} onSelect={select} reducedMotion={reducedMotion}>
          <GoluPot reducedMotion={Boolean(reducedMotion)} />
        </Interactable>
      )}
      <Interactable {...place("windmill")}>
        <Windmill reducedMotion={reducedMotion} />
      </Interactable>
      <Interactable id="field" selected={selected === "field"} onSelect={select} reducedMotion={reducedMotion}>
        <group>
          <CropField detail={quality.detail} growth={scene.cropGrowth} />
          <Fence from={[FIELD.x - FIELD.width / 2 - 0.6, FIELD.z + FIELD.depth / 2 + 0.6]} to={[FIELD.x + FIELD.width / 2 + 0.6, FIELD.z + FIELD.depth / 2 + 0.6]} />
        </group>
      </Interactable>
      <Interactable id="pond" position={[POND.x, terrainHeight(POND.x, POND.z), POND.z]} selected={selected === "pond"} onSelect={select} reducedMotion={reducedMotion}>
        <mesh visible={false} position={[0, 0.6, 0]}>
          <cylinderGeometry args={[POND.radius, POND.radius, 1.2, 16]} />
        </mesh>
      </Interactable>

      <LessonStations stations={stations.map((s, i) => ({ ...s, position: positions[i]! }))} selected={selected} onSelect={select} reducedMotion={reducedMotion} />

      {/* Progress you can see: a flower blooms for every finished lesson. */}
      {flowers.map((p, i) => (
        <Flower key={i} position={p} bloomed={i < scene.bloomedFlowers} hue={i} reducedMotion={reducedMotion} />
      ))}
      <Butterflies home={[1, 9]} count={quality.tier === "low" ? 2 : 4} reducedMotion={reducedMotion} />
      <WanderingButterflies count={quality.tier === "low" ? 3 : quality.tier === "medium" ? 6 : 9} reducedMotion={reducedMotion} />
      <Bubbles count={quality.tier === "low" ? 6 : quality.tier === "medium" ? 12 : 18} reducedMotion={reducedMotion} />
      <Decorations items={scene.decorations} />

      {/* Pasture with the herd */}
      <group name="pasture">
        <Fence from={[PASTURE.x - PASTURE.width / 2, PASTURE.z - PASTURE.depth / 2]} to={[PASTURE.x + PASTURE.width / 2, PASTURE.z - PASTURE.depth / 2]} />
        <Fence from={[PASTURE.x - PASTURE.width / 2, PASTURE.z + PASTURE.depth / 2]} to={[PASTURE.x + PASTURE.width / 2, PASTURE.z + PASTURE.depth / 2]} />
        <Fence from={[PASTURE.x - PASTURE.width / 2, PASTURE.z - PASTURE.depth / 2]} to={[PASTURE.x - PASTURE.width / 2, PASTURE.z + PASTURE.depth / 2]} />
        <Fence from={[PASTURE.x + PASTURE.width / 2, PASTURE.z - PASTURE.depth / 2]} to={[PASTURE.x + PASTURE.width / 2, PASTURE.z + PASTURE.depth / 2]} />
        {PASTURE_COWS.map(([x, z, ry, off]) => (
          <group key={`${x}${z}`} position={at(x, z)} rotation-y={ry}>
            <Cow offset={off} reducedMotion={reducedMotion} />
          </group>
        ))}
      </group>
      {CHICKENS.map(([x, z], i) => (
        <group key={i} position={at(x, z)} rotation-y={i * 2}>
          <Chicken offset={i * 0.8} reducedMotion={reducedMotion} />
        </group>
      ))}
      <Duck center={[POND.x, -0.25, POND.z]} reducedMotion={reducedMotion} />
      {quality.tier !== "low" && <Duck center={[POND.x + 0.5, -0.25, POND.z + 0.5]} radius={1.4} offset={2} reducedMotion={reducedMotion} />}

      <HayBale position={[4, -3]} rotationY={0.4} onError={onAssetError} />
      <HayBale position={[5.6, -1.8]} rotationY={1.2} onError={onAssetError} />
      {TREES.slice(0, treeCount).map(([x, z, s]) => (
        <Tree key={`${x},${z}`} position={[x, z]} scale={s} onError={onAssetError} />
      ))}
      {BUSHES.map(([x, z, s]) => (
        <Bush key={`${x},${z}`} position={[x, z]} scale={s} />
      ))}
      {extras}

      <PortraitFit />
      {controls && <OrbitControls makeDefault target={CAMERA.target} enableDamping={!reducedMotion} {...ORBIT_LIMITS} />}
    </>
  );
}
