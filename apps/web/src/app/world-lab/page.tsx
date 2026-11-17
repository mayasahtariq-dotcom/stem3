"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import * as THREE from "three";
import { env } from "@/lib/env";
import { FIELD_IDS, isFieldId } from "@/lib/world/fields";
import { QUALITY } from "@/three/engine/quality";
import { FieldScene } from "@/three/worlds/FieldScene";
import { FIELD_LOOKS } from "@/three/worlds/looks";

/** Dev-only viewer for the farm fields (fake builds only): /world-lab?field=golden-valley */
function Lab() {
  const q = useSearchParams();
  const f = q.get("field") ?? "starter-meadow";
  const field = isFieldId(f) ? f : FIELD_IDS[0];
  const look = FIELD_LOOKS[field];
  const cam = q.get("cam")?.split(",").map(Number);
  const position = (cam && cam.length >= 3 ? cam.slice(0, 3) : look.camera.position) as [number, number, number];
  const target = (cam && cam.length >= 6 ? cam.slice(3, 6) : look.camera.target) as [number, number, number];
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        shadows="soft"
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
        camera={{ fov: 45, near: 0.5, far: 600, position }}
        onCreated={() => setTimeout(() => ((window as unknown as { __ready: boolean }).__ready = true), 6000)}
      >
        <Suspense fallback={null}>
          <FieldScene field={field} quality={QUALITY.high} />
        </Suspense>
        <OrbitControls makeDefault target={target} />
      </Canvas>
    </div>
  );
}

export default function WorldLabPage() {
  if (!env.useFakes) return null;
  return (
    <Suspense fallback={null}>
      <Lab />
    </Suspense>
  );
}
