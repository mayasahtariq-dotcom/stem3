"use client";
import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { ItemModel } from "./items";

/** A store item turning on a little grass disc; drag to rotate it. */
export default function ItemPreview({ model, label }: { model: string; label: string }) {
  return (
    <Canvas role="img" aria-label={label} camera={{ position: [4, 3, 5], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} data-testid="item-preview">
      <hemisphereLight args={["#e6f4ff", "#6b8f3a", 1.4]} />
      <directionalLight position={[4, 8, 5]} intensity={2.4} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.25}>
          <group>
            <ItemModel model={model} />
          </group>
        </Bounds>
      </Suspense>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <circleGeometry args={[2.2, 40]} />
        <meshStandardMaterial color="#8fcf5a" />
      </mesh>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={2.5} enableZoom={false} enablePan={false} minPolarAngle={0.6} maxPolarAngle={1.35} />
    </Canvas>
  );
}
