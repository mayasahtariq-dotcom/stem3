"use client";
import { useFrame } from "@react-three/fiber";
import { color } from "@mooshala/tokens";
import { useRef } from "react";
import type { Group } from "three";

const Std = ({ c, e }: { c: string; e?: string }) => <meshStandardMaterial color={c} roughness={0.8} flatShading emissive={e ?? "#000000"} emissiveIntensity={e ? 0.35 : 0} />;

/** Golu Pot: a clay matka with a cloth lid tied on; it wobbles while it waits to be opened. */
export function GoluPot({ reducedMotion }: { reducedMotion: boolean }) {
  const lid = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion || !lid.current) return;
    const t = clock.getElapsedTime();
    lid.current.rotation.z = Math.sin(t * 6) * 0.06 * (Math.sin(t * 0.9) > 0.6 ? 1 : 0);
    lid.current.position.y = 1.18 + Math.abs(Math.sin(t * 3)) * 0.04;
  });
  return (
    <group name="golu-pot" scale={0.9}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.62, 12, 10]} />
        <Std c="#b5562f" e="#5a1e00" />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.32, 0.42, 0.25, 12]} />
        <Std c="#a24a27" />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <torusGeometry args={[0.6, 0.04, 6, 18]} />
        <Std c={color.sun} />
      </mesh>
      <group ref={lid} position={[0, 1.18, 0]}>
        <mesh>
          <cylinderGeometry args={[0.38, 0.36, 0.1, 12]} />
          <Std c={color.coral} e="#7a1a10" />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <Std c={color.sun} e="#7a5a00" />
        </mesh>
      </group>
    </group>
  );
}
