"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { color } from "@mooshala/tokens";
import { blink, graze, tailSwing } from "../animation/idle";

const Std = ({ c, r = 0.8 }: { c: string; r?: number }) => <meshStandardMaterial color={c} roughness={r} flatShading />;

export interface CowProps {
  /** Seconds offset so a herd doesn't move in sync. */
  offset?: number;
  reducedMotion?: boolean;
  /** Golu wears a bell; the mascot can grow (calf, cow, champion). */
  bell?: boolean;
  scale?: number;
  outfit?: string | null;
  champion?: boolean;
}

/** A low-poly cow that blinks, swishes its tail and grazes. */
export function Cow({ offset = 0, reducedMotion, bell, scale = 1, outfit, champion }: CowProps) {
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    if (head.current) head.current.rotation.x = graze(t, offset) * 0.7;
    if (tail.current) tail.current.rotation.z = tailSwing(t, offset);
    if (eyes.current) eyes.current.scale.y = Math.max(0.08, blink(t, 4.2, offset));
  });
  return (
    <group name={bell ? "golu" : "cow"} scale={scale}>
      <mesh castShadow position={[0, 1.15, 0]}>
        <boxGeometry args={[1.1, 0.9, 1.9]} />
        <Std c="#FFFFFF" />
      </mesh>
      {/* Patches */}
      <mesh position={[0.56, 1.25, 0.2]}>
        <boxGeometry args={[0.02, 0.5, 0.7]} />
        <Std c={color.ink} />
      </mesh>
      <mesh position={[-0.56, 1.1, -0.4]}>
        <boxGeometry args={[0.02, 0.45, 0.6]} />
        <Std c={color.ink} />
      </mesh>
      {/* Holstein patches on the back and rump, seen from behind */}
      <mesh position={[0.15, 1.61, -0.35]}>
        <boxGeometry args={[0.6, 0.02, 0.65]} />
        <Std c={color.ink} />
      </mesh>
      <mesh position={[-0.25, 1.61, 0.45]}>
        <boxGeometry args={[0.45, 0.02, 0.45]} />
        <Std c={color.ink} />
      </mesh>
      <mesh position={[-0.2, 1.3, -0.96]}>
        <boxGeometry args={[0.45, 0.4, 0.02]} />
        <Std c={color.ink} />
      </mesh>
      {[[-0.38, 0.65], [0.38, 0.65], [-0.38, -0.65], [0.38, -0.65]].map(([x, z]) => (
        <mesh key={`${x}${z}`} castShadow position={[x!, 0.38, z!]}>
          <boxGeometry args={[0.22, 0.76, 0.22]} />
          <Std c="#F2F2F2" />
        </mesh>
      ))}
      <group ref={head} position={[0, 1.45, 0.95]}>
        <mesh castShadow position={[0, 0, 0.35]}>
          <boxGeometry args={[0.75, 0.7, 0.7]} />
          <Std c="#FFFFFF" />
        </mesh>
        <mesh position={[0, -0.15, 0.72]}>
          <boxGeometry args={[0.6, 0.32, 0.08]} />
          <Std c="#F4B6B6" />
        </mesh>
        <group ref={eyes} position={[0, 0.12, 0.71]}>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.1, 0.12, 0.04]} />
              <Std c={color.ink} />
            </mesh>
          ))}
        </group>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.42, 0.25]}>
            <coneGeometry args={[0.07, 0.25, 5]} />
            <Std c={champion ? color.sun : color.cream} />
          </mesh>
        ))}
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} position={[x, 0.2, 0.25]} rotation-z={x > 0 ? -0.6 : 0.6}>
            <boxGeometry args={[0.3, 0.12, 0.18]} />
            <Std c="#F4D0C2" />
          </mesh>
        ))}
        {outfit === "outfit-straw-hat" && (
          <group position={[0, 0.5, 0.3]}>
            <mesh>
              <cylinderGeometry args={[0.6, 0.6, 0.06, 12]} />
              <Std c="#E8C35A" />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.3, 0.34, 0.3, 12]} />
              <Std c="#E8C35A" />
            </mesh>
          </group>
        )}
      </group>
      {bell && (
        <mesh position={[0, 1.02, 1.12]}>
          <sphereGeometry args={[0.13, 8, 6]} />
          <meshStandardMaterial color={color.sun} metalness={0.6} roughness={0.3} />
        </mesh>
      )}
      {outfit === "outfit-scarf" && (
        <mesh position={[0, 1.25, 1.0]}>
          <torusGeometry args={[0.42, 0.09, 6, 12]} />
          <Std c={color.coral} />
        </mesh>
      )}
      <group ref={tail} position={[0, 1.45, -0.96]}>
        <mesh position={[0, -0.4, -0.02]}>
          <boxGeometry args={[0.06, 0.8, 0.06]} />
          <Std c="#EDEDED" />
        </mesh>
        <mesh position={[0, -0.82, -0.02]}>
          <boxGeometry args={[0.14, 0.18, 0.14]} />
          <Std c={color.ink} />
        </mesh>
      </group>
    </group>
  );
}

/** A chicken that pecks the ground. */
export function Chicken({ offset = 0, reducedMotion }: { offset?: number; reducedMotion?: boolean }) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    if (body.current) body.current.rotation.x = Math.max(0, Math.sin((t + offset) * 3)) * 0.5;
  });
  return (
    <group name="chicken">
      <group ref={body} position={[0, 0.35, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.32, 8, 6]} />
          <Std c="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0.3, 0.2]}>
          <sphereGeometry args={[0.18, 8, 6]} />
          <Std c="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0.48, 0.2]}>
          <boxGeometry args={[0.06, 0.12, 0.16]} />
          <Std c={color.coral} />
        </mesh>
        <mesh position={[0, 0.28, 0.4]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.05, 0.14, 4]} />
          <Std c={color.flame} />
        </mesh>
      </group>
    </group>
  );
}

/** A duck paddling in circles on the pond. */
export function Duck({ center, radius = 2.5, offset = 0, reducedMotion }: { center: [number, number, number]; radius?: number; offset?: number; reducedMotion?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime * 0.25 + offset;
    if (!ref.current) return;
    ref.current.position.set(center[0] + Math.cos(t) * radius, center[1] + Math.sin(t * 6) * 0.03, center[2] + Math.sin(t) * radius);
    ref.current.rotation.y = -t;
  });
  return (
    <group ref={ref} name="duck">
      <mesh castShadow>
        <sphereGeometry args={[0.35, 8, 6]} />
        <Std c="#FFE066" />
      </mesh>
      <mesh position={[0, 0.3, 0.25]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <Std c="#FFE066" />
      </mesh>
      <mesh position={[0, 0.27, 0.47]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.07, 0.18, 4]} />
        <Std c={color.flame} />
      </mesh>
    </group>
  );
}
