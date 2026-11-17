"use client";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { PlacedObject } from "@mooshala/api-client";
import { catalogItem } from "@/lib/world/catalog";
import { FIELD_GEOMETRY, type FieldId } from "@/lib/world/fields";
import { heightAt, type FieldGeometry } from "@/lib/world/geometry";
import type { QualitySettings } from "../engine/quality";
import { Signboard } from "../world/buildings";
import { Interactable } from "../world/Interactable";
import { GoluPot } from "../world/pot";
import { EMPTY_SCENE, type FarmSceneModel } from "../world/scene-model";
import { LessonStations } from "../world/stations";
import { FieldScene } from "./FieldScene";
import { ground, type Wrap } from "./fields/common";
import { ItemModel } from "./items";
import { FIELD_LOOKS } from "./looks";
import { Model } from "./Model";

export interface PlacementView {
  /** The object being placed or moved (null when only looking). */
  draft: PlacedObject | null;
  /** True when the draft may stand where it is. */
  valid: boolean;
  onMove: (x: number, z: number) => void;
}

export interface WorldSceneProps {
  field: FieldId;
  quality: QualitySettings;
  scene?: FarmSceneModel;
  selected?: string | null;
  onSelect?: (id: string) => void;
  reducedMotion?: boolean;
  /** Objects the student placed in this field (minus the one being moved). */
  placed: PlacedObject[];
  /** Tapping a placed object while editing. */
  onPickPlaced?: (uid: string) => void;
  placement?: PlacementView;
  controls?: boolean;
  extras?: ReactNode;
}

const sample = (pts: [number, number][], t: number): [number, number, number] => {
  // Point and heading at fraction t along a polyline.
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  let d = t * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]! || i === lens.length - 1) {
      const a = pts[i]!, b = pts[i + 1]!, k = Math.min(1, d / lens[i]!);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])];
    }
    d -= lens[i]!;
  }
  return [pts[0]![0], pts[0]![1], 0];
};

/** Spots beside the main path (lesson markers, progress flowers), from the gate towards the barn. */
export function pathSpots(g: FieldGeometry, n: number, offset: number, from = 0.12, to = 0.78, alternate = true): [number, number][] {
  const pts = g.paths[0]!.points;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1);
    const [x, z, h] = sample(pts, t);
    const side = alternate ? (i % 2 === 0 ? 1 : -1) : -1;
    return [x + Math.cos(h) * offset * side, z - Math.sin(h) * offset * side];
  });
}

/** A progress flower: a bud until its lesson is finished, then a bloom. */
function ProgressFlower({ g, x, z, bloomed, hue }: { g: FieldGeometry; x: number; z: number; bloomed: boolean; hue: number }) {
  return bloomed ? <Model id={hue % 2 ? "flowers-a" : "flowers-b"} position={ground(g, x, z)} rotationY={hue} scale={1.1} /> : <Model id="bush" position={ground(g, x, z)} scale={0.35} rotationY={hue} />;
}

/** The footprint ring under an object being placed: green when it fits, red when not. */
function Footprint({ g, x, z, r, valid }: { g: FieldGeometry; x: number; z: number; r: number; valid: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.12;
  });
  return (
    <mesh ref={ref} name="placement-footprint" position={[x, heightAt(g, x, z) + 0.06, z]} rotation-x={-Math.PI / 2} renderOrder={5}>
      <circleGeometry args={[Math.max(1.1, r), 40]} />
      <meshBasicMaterial color={valid ? "#34d058" : "#ef4444"} transparent opacity={0.5} depthWrite={false} />
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[Math.max(1.1, r), Math.max(1.1, r) + 0.18, 48]} />
        <meshBasicMaterial color={valid ? "#16a34a" : "#dc2626"} depthWrite={false} />
      </mesh>
    </mesh>
  );
}

/** Drag on the ground to move the draft (DOM pointer events + a terrain raycast, so the orbit camera keeps working elsewhere). */
function PlacementDrag({ placement }: { placement: PlacementView }) {
  const { gl, camera, scene, controls } = useThree();
  const live = useRef(placement);
  live.current = placement;
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let dragging = false;
    let down: { x: number; y: number } | null = null;
    const hit = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const ground = scene.getObjectByName("terrain-ground");
      return ground ? ray.intersectObject(ground, false)[0]?.point : undefined;
    };
    const ctl = () => controls as unknown as { enabled: boolean } | null;
    const onDown = (e: PointerEvent) => {
      const d = live.current.draft;
      down = { x: e.clientX, y: e.clientY };
      const p = hit(e);
      if (!d || !p) return;
      const r = catalogItem(d.item_id)?.radius ?? 1;
      if (Math.hypot(p.x - d.x, p.z - d.z) < r + 1.2) {
        dragging = true;
        const c = ctl();
        if (c) c.enabled = false;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const p = hit(e);
      if (p) live.current.onMove(p.x, p.z);
    };
    const onUp = (e: PointerEvent) => {
      const tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6;
      if (tap && !dragging && live.current.draft) {
        const p = hit(e);
        if (p) live.current.onMove(p.x, p.z);
      }
      dragging = false;
      down = null;
      const c = ctl();
      if (c) c.enabled = true;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, scene, controls]);
  return null;
}

/** Keeps the camera target inside the field when the student pans. */
function PanBounds({ limit }: { limit: number }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (!controls) return;
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, -limit, limit), cz = THREE.MathUtils.clamp(t.z, -limit, limit);
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x;
      camera.position.z += cz - t.z;
      t.x = cx;
      t.z = cz;
    }
  });
  return null;
}

function CameraStart({ field }: { field: FieldId }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const { position, target } = FIELD_LOOKS[field].camera;
    const k = aspect < 1 ? Math.min(1.7, 1 / aspect) : 1;
    camera.position.set(target[0] + (position[0] - target[0]) * k, target[1] + (position[1] - target[1]) * k, target[2] + (position[2] - target[2]) * k);
    if (controls) {
      controls.target.set(...target);
      controls.update();
    }
  }, [field, aspect, camera, controls]);
  return null;
}

/**
 * The student's farm world: one of the five fields, its learning places
 * (Starter Meadow), what the student placed there, and the placement editor.
 */
export function WorldScene({ field, quality, scene = EMPTY_SCENE, selected, onSelect, reducedMotion, placed, onPickPlaced, placement, controls = true, extras }: WorldSceneProps) {
  const g = FIELD_GEOMETRY[field];
  const select = (id: string) => onSelect?.(id);
  const editing = Boolean(placement?.draft);
  const isStarter = field === "starter-meadow";
  const wrap: Wrap = (id, node, at, rotationY) => (
    <Interactable key={id} id={id} position={at} rotationY={rotationY} selected={selected === id} onSelect={editing ? undefined : select} reducedMotion={reducedMotion}>
      {node}
    </Interactable>
  );
  const stationSpots = useMemo(() => pathSpots(g, scene.stations.length, 2.4, 0.3, 0.86, false), [g, scene.stations.length]);
  const flowerSpotsNew = useMemo(() => pathSpots(g, scene.flowerCount, 5.2, 0.22, 0.82, false), [g, scene.flowerCount]);
  const golu = g.blocked.find((b) => b.id === "golu");
  const sign = g.blocked.find((b) => b.id === "signboard");
  const mascotScale = scene.mascot.stage === "calf" ? 1 : scene.mascot.stage === "cow" ? 1.25 : 1.4;
  const pond = g.water[0];
  const plot = g.plots[0];

  return (
    <>
      <FieldScene field={field} quality={quality} reducedMotion={reducedMotion} growth={scene.cropGrowth} wrap={isStarter ? wrap : undefined}>
        {isStarter && (
          <>
            {sign && wrap("signboard", <Signboard progress={scene.courseProgress} />, ground(g, sign.x, sign.z), -0.3)}
            {golu && wrap("golu", <Model id="cow" scale={mascotScale} />, ground(g, golu.x, golu.z), -2.4)}
            {golu && scene.potWaiting && (
              <Interactable id="pot" position={ground(g, golu.x - 2.4, golu.z - 0.8)} selected={selected === "pot"} onSelect={select} reducedMotion={reducedMotion}>
                <GoluPot reducedMotion={Boolean(reducedMotion)} />
              </Interactable>
            )}
            {plot && (
              <Interactable id="field" position={ground(g, plot.x, plot.z)} selected={selected === "field"} onSelect={editing ? undefined : select} reducedMotion={reducedMotion}>
                <mesh visible={false} position={[0, 0.6, 0]}>
                  <boxGeometry args={[plot.w, 1.2, plot.d]} />
                </mesh>
              </Interactable>
            )}
            {pond && (
              <Interactable id="pond" position={ground(g, pond.x, pond.z)} selected={selected === "pond"} onSelect={editing ? undefined : select} reducedMotion={reducedMotion}>
                <mesh visible={false} position={[0, 0.6, 0]}>
                  <cylinderGeometry args={[pond.r, pond.r, 1.2, 16]} />
                </mesh>
              </Interactable>
            )}
            <LessonStations stations={scene.stations.map((s, i) => ({ ...s, position: ground(g, ...stationSpots[i]!) }))} selected={selected} onSelect={editing ? undefined : select} reducedMotion={reducedMotion} />
            {flowerSpotsNew.map(([x, z], i) => (
              <ProgressFlower key={i} g={g} x={x} z={z} bloomed={i < scene.bloomedFlowers} hue={i} />
            ))}
          </>
        )}

        {/* What the student placed in this field. */}
        <group name="placed-objects">
          {placed.map((o) => {
            const item = catalogItem(o.item_id);
            if (!item) return null;
            return (
              <group
                key={o.uid}
                name={`placed:${o.uid}`}
                position={ground(g, o.x, o.z)}
                rotation-y={o.rotation}
                onClick={
                  onPickPlaced && !editing
                    ? (e) => {
                        e.stopPropagation();
                        onPickPlaced(o.uid);
                      }
                    : undefined
                }
              >
                <ItemModel model={item.model} />
              </group>
            );
          })}
        </group>

        {placement?.draft &&
          (() => {
            const d = placement.draft;
            const item = catalogItem(d.item_id);
            return (
              <group name="placement-draft">
                <Footprint g={g} x={d.x} z={d.z} r={item?.radius ?? 1} valid={placement.valid} />
                <group position={[d.x, heightAt(g, d.x, d.z) + 0.15, d.z]} rotation-y={d.rotation}>
                  {item && <ItemModel model={item.model} />}
                </group>
              </group>
            );
          })()}
        {placement && <PlacementDrag placement={placement} />}
        {extras}
      </FieldScene>
      {controls && (
        <>
          <OrbitControls makeDefault enableDamping={!reducedMotion} dampingFactor={0.08} minDistance={10} maxDistance={70} minPolarAngle={Math.PI * 0.16} maxPolarAngle={Math.PI * 0.45} enablePan screenSpacePanning={false} rotateSpeed={0.6} zoomSpeed={0.8} />
          <CameraStart field={field} />
          <PanBounds limit={g.buildRadius} />
        </>
      )}
    </>
  );
}
