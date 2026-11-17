"use client";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { groundAt, heightAt, inWater, noise, onPath, type FieldGeometry } from "@/lib/world/geometry";
import { MODELS, type ModelId, type ModelSpec } from "./models";
import { useModel } from "./Model";
import { addSway } from "./wind";

/** Deterministic pseudo-random numbers so a field looks the same on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface Spot {
  x: number;
  z: number;
  rot: number;
  scale: number;
}

/** True when nothing important is here (buildings, water, paths, plots). */
export function freeGround(g: FieldGeometry, x: number, z: number, clearance = 0.6): boolean {
  if (inWater(g, x, z, clearance + 0.4)) return false;
  if (onPath(g, x, z, clearance)) return false;
  if (g.blocked.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + clearance)) return false;
  if (g.plots.some((p) => Math.abs(x - p.x) < p.w / 2 + clearance && Math.abs(z - p.z) < p.d / 2 + clearance)) return false;
  return groundAt(g, x, z) !== "snow" || clearance > 1;
}

/** Scatter spots in a ring [rMin, rMax], kept to free ground, with a density mask. */
export function scatter(g: FieldGeometry, opts: { seed: number; count: number; rMin: number; rMax: number; clearance?: number; scale?: [number, number]; mask?: (x: number, z: number) => boolean; angle?: [number, number] }): Spot[] {
  const r = rng(opts.seed);
  const out: Spot[] = [];
  const [a0, a1] = opts.angle ?? [0, Math.PI * 2];
  for (let tries = 0; out.length < opts.count && tries < opts.count * 25; tries++) {
    const a = a0 + r() * (a1 - a0);
    const d = Math.sqrt(opts.rMin * opts.rMin + r() * (opts.rMax * opts.rMax - opts.rMin * opts.rMin));
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeGround(g, x, z, opts.clearance ?? 0.6)) continue;
    if (opts.mask && !opts.mask(x, z)) continue;
    const [s0, s1] = opts.scale ?? [0.85, 1.2];
    out.push({ x, z, rot: r() * Math.PI * 2, scale: s0 + r() * (s1 - s0) });
  }
  return out;
}

/** Many copies of one model as GPU instances (one draw call per mesh). */
export function InstancedModel({ id, spots, g, sink = 0.05 }: { id: ModelId; spots: Spot[]; g: FieldGeometry; sink?: number }) {
  const { object, scale } = useModel(id);
  const meshes = useMemo(() => {
    const list: { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }[] = [];
    object.updateMatrixWorld(true);
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) list.push({ geo: mesh.geometry, mat: mesh.material as THREE.Material, local: mesh.matrixWorld.clone() });
    });
    return list;
  }, [object]);
  const matrices = useMemo(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    return spots.map((s) => {
      q.setFromAxisAngle(up, s.rot);
      return m.clone().compose(new THREE.Vector3(s.x, heightAt(g, s.x, s.z) - sink, s.z), q, new THREE.Vector3().setScalar(scale * s.scale));
    });
  }, [spots, g, scale, sink]);
  return (
    <group>
      {meshes.map((mm, i) => (
        <InstancedPart key={i} geo={mm.geo} mat={mm.mat} local={mm.local} matrices={matrices} />
      ))}
    </group>
  );
}

function InstancedPart({ geo, mat, local, matrices }: { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4; matrices: THREE.Matrix4[] }) {
  const inst = useMemo(() => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
    const tmp = new THREE.Matrix4();
    matrices.forEach((m, i) => im.setMatrixAt(i, tmp.multiplyMatrices(m, local)));
    im.count = matrices.length;
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    return im;
  }, [geo, mat, local, matrices]);
  useEffect(() => () => inst.dispose(), [inst]);
  return <primitive object={inst} />;
}

/** A clump of three bent grass blades, coloured dark at the root and light at the tip. */
function bladeClump(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 3; b++) {
    const h = 0.32 + b * 0.07, w = 0.045;
    const geo = new THREE.BufferGeometry();
    const v = [-w, 0, 0, w, 0, 0, -w * 0.6, h * 0.5, 0.03, w * 0.6, h * 0.5, 0.03, 0, h, 0.09];
    geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    geo.rotateY((b / 3) * Math.PI * 2 + 0.4);
    geo.translate((b - 1) * 0.05, 0, ((b * 7) % 3) * 0.03 - 0.03);
    const col = new Float32Array(5 * 3);
    [0, 0, 0.5, 0.5, 1].forEach((t, i) => col.set([0.55 + t * 0.45, 0.55 + t * 0.45, 0.55 + t * 0.45], i * 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  }
  const merged = new THREE.BufferGeometry();
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  let off = 0;
  for (const p of parts) {
    pos.push(...(p.attributes.position!.array as Float32Array));
    col.push(...(p.attributes.color!.array as Float32Array));
    idx.push(...Array.from(p.index!.array).map((i) => i + off));
    off += p.attributes.position!.count;
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  merged.setIndex(idx);
  merged.computeVertexNormals();
  return merged;
}

/** Dense swaying grass over the open ground near the farm. */
export function GrassField({ g, count, radius, tint = "#6fb83f", seed = 7 }: { g: FieldGeometry; count: number; radius: number; tint?: string; seed?: number }) {
  const mesh = useMemo(() => {
    const geo = bladeClump();
    const mat = new THREE.MeshStandardMaterial({ color: tint, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    addSway(mat, 0.25, 0.4);
    const r = rng(seed);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const base = new THREE.Color(tint);
    const im = new THREE.InstancedMesh(geo, mat, count);
    let n = 0;
    for (let t = 0; n < count && t < count * 4; t++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!freeGround(g, x, z, 0.15)) continue;
      const kind = groundAt(g, x, z);
      if (kind === "stone" || kind === "sand" || kind === "snow") continue;
      // Clumpier where noise is high, so the meadow has tufts and gaps.
      if (noise(x * 0.35, z * 0.35, g.seed + 11) < 0.32) continue;
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      const s = 0.45 + r() * 0.45;
      m.compose(new THREE.Vector3(x, heightAt(g, x, z) - 0.02, z), q, new THREE.Vector3(s * 1.2, s * (0.7 + r() * 0.6), s * 1.2));
      im.setMatrixAt(n, m);
      im.setColorAt(n, c.copy(base).offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.12));
      n++;
    }
    im.count = n;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    return im;
  }, [g, count, radius, tint, seed]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

export const preloadSpec = (id: ModelId) => useGLTF.preload((MODELS[id] as ModelSpec).file);
