"use client";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODELS, type ModelId, type ModelSpec } from "./models";
import { addSway } from "./wind";

interface Prepared {
  scene: THREE.Object3D;
  /** Uniform scale that brings the model to its real height. */
  scale: number;
  nativeHeight: number;
  skinned: boolean;
}

const prepared = new Map<string, Prepared>();

/** Normalises materials once per model + tint: alpha-cut leaves, tint, sway, shadows. */
function prepare(key: string, spec: ModelSpec, scene: THREE.Object3D): Prepared {
  const hit = prepared.get(key);
  if (hit) return hit;
  let hasSkin = false;
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true;
  });
  const root = hasSkin ? cloneSkinned(scene) : scene.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const nativeHeight = Math.max(0.001, box.max.y - box.min.y);
  let skinned = false;
  const mats = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let mat = mats.get(src);
    if (!mat) {
      const m = src.clone() as THREE.MeshStandardMaterial;
      const leaf = m.userData?.leafTint as [number, number, number] | undefined;
      if (leaf || m.name?.startsWith("LEAF_")) {
        const t = spec.leafTint ?? leaf ?? [0.3, 0.55, 0.18];
        m.color.setRGB(t[0], t[1], t[2], THREE.SRGBColorSpace);
        m.alphaTest = 0.3;
        m.transparent = false;
        m.depthWrite = true;
        m.side = THREE.DoubleSide;
      }
      if (spec.tint && !m.map) m.color.set(spec.tint);
      m.roughness = Math.max(0.65, m.roughness ?? 1);
      m.metalness = Math.min(0.05, m.metalness ?? 0);
      if (spec.sway) {
        // Sway is computed in the mesh's own geometry space.
        mesh.geometry.computeBoundingBox();
        const gb = mesh.geometry.boundingBox!;
        addSway(m, spec.sway, Math.max(0.01, gb.max.y - Math.min(0, gb.min.y)));
      }
      mats.set(src, m);
      mat = m;
    }
    mesh.material = mat;
  });
  const p = { scene: root, scale: spec.native ? 1 : spec.h / nativeHeight, nativeHeight, skinned };
  prepared.set(key, p);
  return p;
}

export function useModel(id: ModelId) {
  const spec = MODELS[id] as ModelSpec;
  const gltf = useGLTF(spec.file);
  return useMemo(() => {
    const p = prepare(`${id}`, spec, gltf.scene);
    const instance = p.skinned ? cloneSkinned(p.scene) : p.scene.clone(true);
    return { object: instance, scale: p.scale, height: spec.native ? p.nativeHeight : spec.h, spec };
  }, [gltf.scene, id, spec]);
}

export interface ModelProps {
  id: ModelId;
  position?: [number, number, number];
  rotationY?: number;
  /** Multiplies the real-world size. */
  scale?: number;
  onReady?: (object: THREE.Object3D) => void;
}

function LoadedModel({ id, position, rotationY = 0, scale = 1, onReady }: ModelProps) {
  const { object, scale: s } = useModel(id);
  const done = useRef(false);
  useEffect(() => {
    if (!done.current && onReady) {
      done.current = true;
      onReady(object);
    }
  }, [object, onReady]);
  return <primitive object={object} position={position} rotation-y={rotationY} scale={s * scale} />;
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** A world model. A missing or broken file renders nothing instead of breaking the farm. */
export function Model(props: ModelProps) {
  return (
    <Boundary>
      <Suspense fallback={null}>
        <LoadedModel {...props} />
      </Suspense>
    </Boundary>
  );
}

export const preloadModels = (ids: ModelId[]) => ids.forEach((id) => useGLTF.preload((MODELS[id] as ModelSpec).file));

/** Rotates the highest flat part of a windmill (its sails) around its own centre. */
export function useSpinSails(root: THREE.Object3D | null, speed: number) {
  const sails = useMemo(() => {
    if (!root) return null;
    let best: THREE.Mesh | null = null;
    let bestY = -Infinity;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!;
      const cy = (b.max.y + b.min.y) / 2;
      if (cy > bestY) {
        bestY = cy;
        best = mesh;
      }
    });
    if (!best) return null;
    const mesh = best as THREE.Mesh;
    const b = mesh.geometry.boundingBox!;
    const c = b.getCenter(new THREE.Vector3());
    const size = b.getSize(new THREE.Vector3());
    // Spin axis: the thinnest dimension of the sail disc.
    const axis = size.x < size.z ? "x" : "z";
    if (!mesh.geometry.userData.pivoted) {
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.translate(-c.x, -c.y, -c.z);
      mesh.geometry.userData.pivoted = true;
    }
    mesh.position.add(c);
    return { mesh, axis } as const;
  }, [root]);
  useFrame((_, dt) => {
    if (sails) sails.mesh.rotation[sails.axis] += dt * speed;
  });
}
