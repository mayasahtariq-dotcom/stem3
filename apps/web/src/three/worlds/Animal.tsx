"use client";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { heightAt, type FieldGeometry } from "@/lib/world/geometry";
import type { ModelId } from "./models";
import { useModel } from "./Model";
import { freeGround, rng } from "./vegetation";

interface Rig {
  legs: { bone: THREE.Bone; rest: THREE.Euler; phase: number }[];
  neck: { bone: THREE.Bone; rest: THREE.Euler } | null;
  head: { bone: THREE.Bone; rest: THREE.Euler } | null;
  tail: { bone: THREE.Bone; rest: THREE.Euler } | null;
}

function findRig(root: THREE.Object3D): Rig {
  const rig: Rig = { legs: [], neck: null, head: null, tail: null };
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    const n = b.name;
    const rest = b.rotation.clone();
    if (/^(Front|Back)(Up|Upper)(Leg)_(L|R)$/.test(n) || /^(Front|Back)UpperLeg_(L|R)$/.test(n)) {
      const front = n.startsWith("Front"), left = n.endsWith("_L");
      rig.legs.push({ bone: b, rest, phase: (front === left ? 0 : Math.PI) });
    } else if (/^Neck1?$/.test(n)) rig.neck = { bone: b, rest };
    else if (n === "Head") rig.head = { bone: b, rest };
    else if (/^Tail1$/.test(n)) rig.tail = { bone: b, rest };
  });
  return rig;
}

export interface AnimalProps {
  id: ModelId;
  g: FieldGeometry;
  /** Wanders inside this circle. */
  home: { x: number; z: number; r: number };
  seed: number;
  scale?: number;
  reducedMotion?: boolean;
  speed?: number;
}

/**
 * A farm animal that wanders its paddock: walks with a leg cycle, stops to
 * graze (head down) and looks around, flicking its tail. Bones come from the
 * model's own skeleton; motion is procedural so no animation files are needed.
 */
function AnimalInner({ id, g, home, seed, scale = 1, reducedMotion, speed = 0.9 }: AnimalProps) {
  const { object, scale: s } = useModel(id);
  const rig = useMemo(() => findRig(object), [object]);
  const ref = useRef<THREE.Group>(null);
  const state = useRef({ x: home.x, z: home.z, heading: 0, tx: home.x, tz: home.z, mode: "graze" as "walk" | "graze", until: 0, phase: 0, t: 0, r: rng(seed) });
  useMemo(() => {
    const st = state.current;
    st.x = home.x + (st.r() - 0.5) * home.r;
    st.z = home.z + (st.r() - 0.5) * home.r;
    st.heading = st.r() * Math.PI * 2;
  }, [home]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const st = state.current;
    st.t += dt;
    if (!reducedMotion) {
      if (st.t > st.until) {
        if (st.mode === "graze") {
          // Pick a new spot on free ground inside the paddock.
          for (let i = 0; i < 8; i++) {
            const a = st.r() * Math.PI * 2, d = Math.sqrt(st.r()) * home.r;
            const x = home.x + Math.cos(a) * d, z = home.z + Math.sin(a) * d;
            if (freeGround(g, x, z, 0.8)) {
              st.tx = x;
              st.tz = z;
              break;
            }
          }
          st.mode = "walk";
          st.until = st.t + 12;
        } else {
          st.mode = "graze";
          st.until = st.t + 4 + st.r() * 6;
        }
      }
      if (st.mode === "walk") {
        const dx = st.tx - st.x, dz = st.tz - st.z, d = Math.hypot(dx, dz);
        if (d < 0.3) {
          st.mode = "graze";
          st.until = st.t + 4 + st.r() * 6;
        } else {
          const want = Math.atan2(dx, dz);
          let diff = want - st.heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          st.heading += diff * Math.min(1, dt * 2.5);
          const v = speed * Math.max(0.2, Math.cos(diff));
          st.x += Math.sin(st.heading) * v * dt;
          st.z += Math.cos(st.heading) * v * dt;
          st.phase += dt * v * 5.5;
        }
      }
    }
    const walking = st.mode === "walk" && !reducedMotion;
    const swing = walking ? 0.45 : 0;
    for (const l of rig.legs) l.bone.rotation.x = l.rest.x + Math.sin(st.phase + l.phase) * swing;
    const graze = st.mode === "graze" && !reducedMotion ? 0.5 + 0.5 * Math.sin(st.t * 0.5) : 0;
    if (rig.neck) rig.neck.bone.rotation.x = rig.neck.rest.x + graze * 0.7;
    if (rig.head) {
      rig.head.bone.rotation.x = rig.head.rest.x + graze * 0.35;
      rig.head.bone.rotation.y = rig.head.rest.y + (reducedMotion ? 0 : Math.sin(st.t * 0.7 + seed) * 0.25 * (1 - graze));
    }
    if (rig.tail) rig.tail.bone.rotation.z = rig.tail.rest.z + (reducedMotion ? 0 : Math.sin(st.t * 3 + seed) * 0.35);
    const grp = ref.current;
    if (grp) {
      const bob = walking ? Math.abs(Math.sin(st.phase)) * 0.03 : 0;
      grp.position.set(st.x, heightAt(g, st.x, st.z) + bob, st.z);
      grp.rotation.y = st.heading;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={object} scale={s * scale} />
    </group>
  );
}

export function Animal(props: AnimalProps) {
  return (
    <Suspense fallback={null}>
      <AnimalInner {...props} />
    </Suspense>
  );
}
