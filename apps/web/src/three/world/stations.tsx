"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { color } from "@mooshala/tokens";
import { bounce } from "../animation/idle";
import { Interactable } from "./Interactable";

export type StationState = "done" | "current" | "locked";
export interface Station {
  id: string;
  state: StationState;
  position: [number, number, number];
}

const Std = ({ c, e }: { c: string; e?: string }) => <meshStandardMaterial color={c} roughness={0.8} flatShading emissive={e ?? "#000000"} emissiveIntensity={e ? 0.45 : 0} />;

/** One lesson on the path: a flag (done), a glowing bouncing post (current) or a mossy stone with a lock (locked). */
function Marker({ state, reducedMotion }: { state: StationState; reducedMotion?: boolean }) {
  const top = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (state !== "current") return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    if (top.current) top.current.position.y = 1.9 + bounce(t) * 0.35;
    if (ring.current) ring.current.rotation.z = t * 0.8;
  });
  if (state === "locked")
    return (
      <group name="station-locked">
        <mesh castShadow position={[0, 0.35, 0]}>
          <dodecahedronGeometry args={[0.55, 0]} />
          <Std c="#A9A39A" />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.36, 0.3, 0.18]} />
          <Std c={color.stone} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <torusGeometry args={[0.12, 0.04, 6, 10, Math.PI]} />
          <Std c={color.stone} />
        </mesh>
      </group>
    );
  if (state === "done")
    return (
      <group name="station-done">
        <mesh castShadow position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.6, 0.7, 0.3, 8]} />
          <Std c={color.grass} />
        </mesh>
        <mesh castShadow position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.9, 5]} />
          <Std c={color.woodDark} />
        </mesh>
        <mesh castShadow position={[0.32, 1.75, 0]}>
          <boxGeometry args={[0.6, 0.4, 0.04]} />
          <Std c={color.grassStrong} />
        </mesh>
      </group>
    );
  return (
    <group name="station-current">
      <mesh ref={ring} position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.8, 1.05, 24]} />
        <meshBasicMaterial color={color.sun} transparent opacity={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 1.6, 6]} />
        <Std c={color.wood} />
      </mesh>
      <group ref={top} position={[0, 1.9, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.45, 0]} />
          <Std c={color.sun} e={color.sun} />
        </mesh>
      </group>
      <pointLight position={[0, 2, 0]} color={color.sun} intensity={4} distance={5} />
    </group>
  );
}

export function LessonStations({ stations, selected, onSelect, reducedMotion }: { stations: Station[]; selected?: string | null; onSelect?: (id: string) => void; reducedMotion?: boolean }) {
  return (
    <group name="lesson-stations">
      {stations.map((s) => (
        <Interactable key={s.id} id={`lesson:${s.id}`} position={s.position} scale={1.35} selected={selected === `lesson:${s.id}`} onSelect={onSelect} reducedMotion={reducedMotion}>
          <Marker state={s.state} reducedMotion={reducedMotion} />
          {/* Generous invisible hit area for small fingers. */}
          <mesh visible={false} position={[0, 1, 0]}>
            <cylinderGeometry args={[1, 1, 2.4, 8]} />
          </mesh>
        </Interactable>
      ))}
    </group>
  );
}
