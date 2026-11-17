"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FieldId } from "@/lib/world/fields";
import { FIELD_GEOMETRY } from "@/lib/world/fields";
import type { QualitySettings } from "../engine/quality";
import { Bubbles, HorizonClouds, Rainbow, SkyDome, WanderingButterflies } from "../world/atmosphere";
import { FIELD_LOOKS } from "./looks";
import { FieldTerrain, FieldWater } from "./Terrain";
import { GrassField } from "./vegetation";
import { WIND } from "./wind";
import { FieldDressing } from "./fields";
import type { Wrap } from "./fields/common";

/** Advances the shared wind clock. */
function WindTicker({ reducedMotion }: { reducedMotion?: boolean }) {
  useFrame((_, dt) => {
    if (!reducedMotion) WIND.uTime.value += dt;
  });
  return null;
}

/** Soft image-based light so materials pick up a sky tint (no network HDR needed). */
function SoftEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pm.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

function Fog({ color, near, far }: { color: string; near: number; far: number }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new THREE.Fog(color, near, far);
    return () => {
      scene.fog = prev;
    };
  }, [scene, color, near, far]);
  return null;
}

export interface FieldSceneProps {
  field: FieldId;
  quality: QualitySettings;
  reducedMotion?: boolean;
  /** Interactive places, placed objects, the placement editor. */
  children?: ReactNode;
  /** Starter Meadow's crops grow with course progress (0..1). */
  growth?: number;
  /** Wraps landmark buildings (the farm makes them tappable). */
  wrap?: Wrap;
}

/**
 * One explorable farm field: lighting, sky, real terrain, water, grass,
 * the field's own buildings, nature and animals. Everything students place
 * is passed in as children.
 */
export function FieldScene({ field, quality, reducedMotion, children, growth = 0.6, wrap }: FieldSceneProps) {
  const g = FIELD_GEOMETRY[field];
  const look = FIELD_LOOKS[field];
  const segments = quality.tier === "low" ? 140 : quality.tier === "medium" ? 200 : 260;
  const grass = Math.round((quality.tier === "low" ? 6000 : quality.tier === "medium" ? 16000 : 28000) * look.grassDensity);
  const sun = useMemo(() => new THREE.Vector3(...look.sun.position), [look]);
  return (
    <>
      <WindTicker reducedMotion={reducedMotion} />
      <SoftEnvironment intensity={look.envIntensity} />
      <Fog color={look.fog.color} near={look.fog.near} far={look.fog.far} />
      <hemisphereLight args={[look.hemi.sky, look.hemi.ground, look.hemi.intensity]} />
      <directionalLight
        color={look.sun.color}
        intensity={look.sun.intensity}
        position={sun}
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowMapSize * 2, quality.shadowMapSize * 2]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      <SkyDome />
      {look.rainbow && <Rainbow position={[-70, 0, -120]} radius={50} />}
      <HorizonClouds count={quality.tier === "low" ? 5 : 10} reducedMotion={reducedMotion} />
      <FieldTerrain geometry={g} segments={segments} palette={look.palette} receiveShadow={quality.shadows} />
      <FieldWater geometry={g} palette={look.palette} reducedMotion={reducedMotion} />
      <GrassField g={g} count={grass} radius={g.buildRadius + 10} tint={look.grass} seed={g.seed} />
      <FieldDressing field={field} quality={quality} reducedMotion={reducedMotion} growth={growth} wrap={wrap} />
      <WanderingButterflies count={quality.tier === "low" ? 3 : 8} reducedMotion={reducedMotion} />
      {look.bubbles && <Bubbles count={quality.tier === "low" ? 5 : 12} reducedMotion={reducedMotion} />}
      {children}
    </>
  );
}
