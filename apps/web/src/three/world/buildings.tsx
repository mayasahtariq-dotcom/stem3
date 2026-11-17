"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { color } from "@mooshala/tokens";

/* Learning destinations: farmhouse study, lab shed, signboard, market stall. Low-poly, flat shaded. */

const Std = ({ c, r = 0.85, e }: { c: string; r?: number; e?: string }) => <meshStandardMaterial color={c} roughness={r} flatShading emissive={e ?? "#000000"} emissiveIntensity={e ? 0.35 : 0} />;

function gableRoof(w: number, h: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

function Window({ x, y, z, ry = 0 }: { x: number; y: number; z: number; ry?: number }) {
  return (
    <group position={[x, y, z]} rotation-y={ry}>
      <mesh>
        <boxGeometry args={[1, 1, 0.08]} />
        <Std c="#FFE7A3" e="#FFC800" />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[1.15, 0.12, 0.06]} />
        <Std c={color.cream} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.12, 1.15, 0.06]} />
        <Std c={color.cream} />
      </mesh>
    </group>
  );
}

/** Farmhouse study: where the word book (terms) lives. */
export function Farmhouse() {
  const roof = useMemo(() => gableRoof(6.6, 2.4, 5.6), []);
  return (
    <group name="farmhouse">
      <mesh castShadow receiveShadow position={[0, 1.7, 0]}>
        <boxGeometry args={[6, 3.4, 5]} />
        <Std c={color.cream} />
      </mesh>
      <mesh castShadow geometry={roof} position={[0, 3.4, 0]}>
        <Std c="#C0563A" />
      </mesh>
      <mesh castShadow position={[1.6, 5, -0.8]}>
        <boxGeometry args={[0.7, 1.6, 0.7]} />
        <Std c={color.stone} />
      </mesh>
      <mesh position={[0, 1.1, 2.52]}>
        <boxGeometry args={[1.2, 2.2, 0.08]} />
        <Std c={color.wood} />
      </mesh>
      <Window x={-1.8} y={2} z={2.52} />
      <Window x={1.8} y={2} z={2.52} />
      {/* Porch */}
      <mesh receiveShadow position={[0, 0.1, 3.4]}>
        <boxGeometry args={[4, 0.2, 1.6]} />
        <Std c={color.woodLight} />
      </mesh>
      {/* Book sign over the door */}
      <group position={[0, 2.75, 2.6]}>
        <mesh>
          <boxGeometry args={[1.1, 0.7, 0.1]} />
          <Std c={color.sky} />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[0.06, 0.6, 0.04]} />
          <Std c={color.cream} />
        </mesh>
      </group>
    </group>
  );
}

/** Lab shed: a small shed with a flask sign, where you ask Golu doubts. */
export function Lab() {
  const roof = useMemo(() => gableRoof(4.6, 1.6, 4.2), []);
  return (
    <group name="lab">
      <mesh castShadow receiveShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[4, 2.8, 3.6]} />
        <Std c="#9FD3F0" />
      </mesh>
      <mesh castShadow geometry={roof} position={[0, 2.8, 0]}>
        <Std c={color.skyStrong} />
      </mesh>
      <mesh position={[0, 1, 1.82]}>
        <boxGeometry args={[1, 2, 0.08]} />
        <Std c={color.cream} />
      </mesh>
      <Window x={1.3} y={1.7} z={1.82} />
      {/* Flask sign */}
      <group position={[-1.2, 3.4, 1.4]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.6, 8]} />
          <Std c="#E9F7FF" />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <coneGeometry args={[0.45, 0.7, 10]} />
          <Std c={color.berry} e={color.berry} />
        </mesh>
      </group>
    </group>
  );
}

/** Wooden signboard at the start of the path: course and chapter progress. */
export function Signboard({ progress }: { progress?: number }) {
  const p = Math.max(0, Math.min(1, progress ?? 0));
  return (
    <group name="signboard">
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} castShadow position={[x, 1, 0]}>
          <boxGeometry args={[0.2, 2, 0.2]} />
          <Std c={color.woodDark} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.75, 0.05]}>
        <boxGeometry args={[2.6, 1.3, 0.14]} />
        <Std c={color.woodLight} />
      </mesh>
      {/* Progress rail */}
      <mesh position={[0, 1.4, 0.13]}>
        <boxGeometry args={[2.1, 0.2, 0.02]} />
        <Std c={color.cream} />
      </mesh>
      <mesh position={[-1.05 + (2.1 * p) / 2, 1.4, 0.15]} scale={[Math.max(0.001, p), 1, 1]}>
        <boxGeometry args={[2.1, 0.2, 0.02]} />
        <Std c={color.grass} />
      </mesh>
    </group>
  );
}

/** Market stall with a striped awning: spend gems here. */
export function MarketStall() {
  return (
    <group name="market">
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[3.4, 1.2, 1.6]} />
        <Std c={color.wood} />
      </mesh>
      {[-1.6, 1.6].map((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}${z}`} castShadow position={[x, 1.6, z]}>
            <boxGeometry args={[0.14, 3.2, 0.14]} />
            <Std c={color.woodDark} />
          </mesh>
        )),
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} castShadow position={[-1.4 + i * 0.7, 3.25, 0.15]} rotation-x={-0.35}>
          <boxGeometry args={[0.7, 0.08, 2]} />
          <Std c={i % 2 ? color.cream : color.coral} />
        </mesh>
      ))}
      {[[-1, color.coral], [-0.3, color.sun], [0.4, color.grass], [1.1, color.flame]].map(([x, c]) => (
        <mesh key={String(x)} castShadow position={[Number(x), 1.4, 0.2]}>
          <sphereGeometry args={[0.25, 8, 6]} />
          <Std c={String(c)} />
        </mesh>
      ))}
    </group>
  );
}
