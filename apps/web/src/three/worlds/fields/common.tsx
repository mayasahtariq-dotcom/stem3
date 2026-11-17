"use client";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import type * as THREE from "three";
import { heightAt, type FieldGeometry, type Plot } from "@/lib/world/geometry";
import { Model, useSpinSails } from "../Model";
import type { ModelId } from "../models";
import { InstancedModel, scatter, type Spot } from "../vegetation";

export type Wrap = (id: string, node: ReactNode, at: [number, number, number], rotationY: number) => ReactNode;
export const plainWrap: Wrap = (_id, node, at, rotationY) => (
  <group position={at} rotation-y={rotationY}>
    {node}
  </group>
);

export const ground = (g: FieldGeometry, x: number, z: number): [number, number, number] => [x, heightAt(g, x, z), z];

/** A model standing on the terrain. */
export function Prop({ g, id, x, z, r = 0, s = 1 }: { g: FieldGeometry; id: ModelId; x: number; z: number; r?: number; s?: number }) {
  return <Model id={id} position={ground(g, x, z)} rotationY={r} scale={s} />;
}

/** Windmill whose sails turn. */
export function SpinningWindmill({ id = "windmill", speed = 0.6, scale = 1 }: { id?: ModelId; speed?: number; scale?: number }) {
  const [root, setRoot] = useState<THREE.Object3D | null>(null);
  useSpinSails(root, speed);
  return <Model id={id} onReady={setRoot} scale={scale} />;
}

/** A run of fence panels from a to b, each panel on the ground. */
export function FenceLine({ g, from, to, id = "fence", panel = 5.9 }: { g: FieldGeometry; from: [number, number]; to: [number, number]; id?: ModelId; panel?: number }) {
  const [ax, az] = from, [bx, bz] = to;
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / panel));
  const rot = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
  const scale = len / n / 5.89;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        return <Model key={i} id={id} position={ground(g, x, z)} rotationY={rot} scale={scale} />;
      })}
    </group>
  );
}

/** A raised bed: wooden border, soil and rows of crops at a growth stage. */
export function CropBed({ g, plot, crop, stage, spacing = 0.9, fenced = true }: { g: FieldGeometry; plot: Plot; crop: string; stage: 1 | 2 | 3 | 4; spacing?: number; fenced?: boolean }) {
  const spots = useMemo(() => {
    const out: Spot[] = [];
    for (let x = -plot.w / 2 + spacing * 0.7; x < plot.w / 2 - spacing * 0.4; x += spacing)
      for (let z = -plot.d / 2 + spacing * 0.7; z < plot.d / 2 - spacing * 0.4; z += spacing * 1.1) out.push({ x: plot.x + x, z: plot.z + z, rot: (x * 7 + z * 3) % 6.28, scale: 0.9 + ((x * 13 + z * 7) % 0.3) });
    return out;
  }, [plot, spacing]);
  const y = heightAt(g, plot.x, plot.z);
  const border = "#7b5232";
  return (
    <group>
      {[
        [0, plot.d / 2, plot.w + 0.3, 0.25],
        [0, -plot.d / 2, plot.w + 0.3, 0.25],
        [plot.w / 2, 0, 0.25, plot.d],
        [-plot.w / 2, 0, 0.25, plot.d],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[plot.x + x!, y - plot.h / 2 + 0.05, plot.z + z!]} castShadow receiveShadow>
          <boxGeometry args={[w!, plot.h + 0.2, d!]} />
          <meshStandardMaterial color={border} roughness={0.9} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <InstancedModel id={`crop-${crop}-${stage}` as ModelId} spots={spots} g={g} sink={-0.02} />
      </Suspense>
      {fenced && (
        <>
          <FenceLine g={g} from={[plot.x - plot.w / 2 - 0.8, plot.z + plot.d / 2 + 0.8]} to={[plot.x + plot.w / 2 + 0.8, plot.z + plot.d / 2 + 0.8]} />
          <FenceLine g={g} from={[plot.x + plot.w / 2 + 0.8, plot.z + plot.d / 2 + 0.8]} to={[plot.x + plot.w / 2 + 0.8, plot.z - plot.d / 2 - 0.8]} />
        </>
      )}
    </group>
  );
}

/** Instanced scatter of several models with one seed. */
export function Scatter({ g, ids, seed, count, rMin, rMax, clearance, scale, mask, angle, sink }: { g: FieldGeometry; ids: ModelId[]; seed: number; count: number; rMin: number; rMax: number; clearance?: number; scale?: [number, number]; mask?: (x: number, z: number) => boolean; angle?: [number, number]; sink?: number }) {
  const groups = useMemo(() => {
    const spots = scatter(g, { seed, count, rMin, rMax, clearance, scale, mask, angle });
    return ids.map((id, k) => ({ id, spots: spots.filter((_, i) => i % ids.length === k) }));
  }, [g, ids, seed, count, rMin, rMax, clearance, scale, mask, angle]);
  return (
    <Suspense fallback={null}>
      {groups.map((gr) => (
        <InstancedModel key={gr.id} id={gr.id} spots={gr.spots} g={g} sink={sink} />
      ))}
    </Suspense>
  );
}

/** Ring of stones and reeds around a pond, lily pads on it. */
export function PondDressing({ g, index = 0, ducks }: { g: FieldGeometry; index?: number; ducks?: ReactNode }) {
  const w = g.water[index]!;
  const stones = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
    const r = w.r + 0.6 + (i % 2) * 0.5;
    return { x: w.x + Math.cos(a) * r, z: w.z + Math.sin(a) * r, rot: a * 3, scale: 0.35 + (i % 4) * 0.12 };
  }), [w]);
  const reeds = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + 0.13;
    const r = w.r + 0.2 + ((i * 7) % 5) * 0.12;
    return { x: w.x + Math.cos(a) * r, z: w.z + Math.sin(a) * r, rot: i, scale: 0.9 + (i % 3) * 0.3 };
  }), [w]);
  const lilies = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const a = i * 2.1, r = w.r * (0.35 + (i % 3) * 0.18);
    return [w.x + Math.cos(a) * r, w.z + Math.sin(a) * r, a] as const;
  }), [w]);
  const lvl = heightAt(g, w.x + w.r * 1.4, w.z) - w.depth * 0.38;
  return (
    <group>
      <Suspense fallback={null}>
        <InstancedModel id="rock-2" spots={stones} g={g} sink={0.15} />
        <InstancedModel id="grass-wispy" spots={reeds} g={g} />
      </Suspense>
      {lilies.map(([x, z, a], i) => (
        <Model key={i} id={i % 2 ? "lily-large" : "lily-small"} position={[x, lvl + 0.02, z]} rotationY={a} scale={6} />
      ))}
      {ducks}
    </group>
  );
}
