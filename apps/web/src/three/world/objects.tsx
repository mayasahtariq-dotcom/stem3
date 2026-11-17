"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { color } from "@mooshala/tokens";
import { FarmModel } from "../assets/FarmModel";
import { FIELD, terrainHeight } from "./terrain-math";

/* Procedural low-poly farm props. Flat shading + token colours = one look. */

const Std = ({ c, r = 0.85 }: { c: string; r?: number }) => <meshStandardMaterial color={c} roughness={r} flatShading />;

export function Barn() {
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-4.4, 0);
    s.lineTo(0, 2.8);
    s.lineTo(4.4, 0);
    s.lineTo(-4.4, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 7.6, bevelEnabled: false });
    g.translate(0, 0, -3.8);
    return g;
  }, []);
  return (
    <group name="barn">
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[7.6, 4, 7]} />
        <Std c="#B5462F" />
      </mesh>
      <mesh castShadow geometry={roof} position={[0, 4, 0]}>
        <Std c={color.woodDark} />
      </mesh>
      {/* Door with the white cross trim */}
      <mesh position={[0, 1.4, 3.52]}>
        <boxGeometry args={[2.6, 2.8, 0.1]} />
        <Std c={color.wood} />
      </mesh>
      {[-1, 1].map((d) => (
        <mesh key={d} position={[0, 1.4, 3.58]} rotation-z={(d * Math.atan2(2.8, 2.6))}>
          <boxGeometry args={[3.6, 0.18, 0.06]} />
          <Std c={color.cream} />
        </mesh>
      ))}
      <mesh position={[0, 3.3, 3.52]}>
        <boxGeometry args={[1.2, 0.9, 0.1]} />
        <Std c={color.cream} />
      </mesh>
    </group>
  );
}

export function Windmill({ reducedMotion }: { reducedMotion?: boolean }) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!reducedMotion && blades.current) blades.current.rotation.z += dt * 0.8;
  });
  return (
    <group name="windmill">
      <mesh castShadow position={[0, 3.5, 0]}>
        <cylinderGeometry args={[0.6, 1.3, 7, 6]} />
        <Std c={color.cream} />
      </mesh>
      <mesh castShadow position={[0, 7.4, 0]}>
        <coneGeometry args={[1.1, 1.6, 6]} />
        <Std c="#B5462F" />
      </mesh>
      <group ref={blades} position={[0, 6.6, 1.15]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} castShadow rotation-z={(i * Math.PI) / 2} position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 5.6, 0.08]} />
            <Std c={color.woodLight} />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 8]} />
          <Std c={color.woodDark} />
        </mesh>
      </group>
    </group>
  );
}

/** Rows of young crops on the tilled field, drawn with one instanced mesh. */
export function CropField({ detail = 1, growth = 1 }: { detail?: number; growth?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rows = 6;
  const perRow = Math.max(6, Math.round(14 * detail));
  const count = rows * perRow;
  const matrices = useMemo(() => {
    const m = new THREE.Matrix4();
    const out: THREE.Matrix4[] = [];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < perRow; i++) {
        const x = FIELD.x - FIELD.width / 2 + 0.8 + (i / (perRow - 1)) * (FIELD.width - 1.6);
        const z = FIELD.z - FIELD.depth / 2 + 1 + (r / (rows - 1)) * (FIELD.depth - 2);
        const s = (0.8 + ((r * 7 + i * 13) % 5) * 0.08) * (0.35 + 0.65 * Math.max(0, Math.min(1, growth)));
        m.compose(new THREE.Vector3(x, terrainHeight(x, z) + 0.45 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
        out.push(m.clone());
      }
    }
    return out;
  }, [perRow, growth]);
  return (
    <instancedMesh
      ref={(mesh) => {
        ref.current = mesh;
        if (!mesh) return;
        matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
        mesh.instanceMatrix.needsUpdate = true;
      }}
      args={[undefined, undefined, count]}
      castShadow
      name="crop-field"
      userData={{ growth }}
    >
      <coneGeometry args={[0.35, 0.9, 5]} />
      <Std c={color.leaf} />
    </instancedMesh>
  );
}

/** Wooden rail fence along a straight run. */
export function Fence({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, z1] = from, [x2, z2] = to;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const posts = Math.max(2, Math.round(len / 2.2) + 1);
  const angle = Math.atan2(z2 - z1, x2 - x1);
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  return (
    <group name="fence">
      {Array.from({ length: posts }, (_, i) => {
        const t = i / (posts - 1);
        const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        return (
          <mesh key={i} castShadow position={[x, terrainHeight(x, z) + 0.6, z]}>
            <boxGeometry args={[0.22, 1.2, 0.22]} />
            <Std c={color.wood} />
          </mesh>
        );
      })}
      {[0.45, 0.95].map((y) => (
        <mesh key={y} castShadow position={[mx, terrainHeight(mx, mz) + y, mz]} rotation-y={-angle}>
          <boxGeometry args={[len, 0.12, 0.08]} />
          <Std c={color.woodLight} />
        </mesh>
      ))}
    </group>
  );
}

/** Simple procedural tree: the loading/failure stand-in for tree.glb. */
export function TreeFallback() {
  return (
    <group name="tree-fallback">
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 2.2, 6]} />
        <Std c={color.wood} />
      </mesh>
      <mesh castShadow position={[0, 3, 0]}>
        <icosahedronGeometry args={[1.6, 0]} />
        <Std c={color.leaf} />
      </mesh>
    </group>
  );
}

export function HayFallback() {
  return (
    <mesh castShadow position={[0, 0.75, 0]} rotation-z={Math.PI / 2} name="hay-fallback">
      <cylinderGeometry args={[0.75, 0.75, 1.3, 10]} />
      <Std c="#E8C35A" />
    </mesh>
  );
}

export function Tree({ position, scale = 1, onError }: { position: [number, number]; scale?: number; onError?: (e: unknown) => void }) {
  const [x, z] = position;
  return (
    <group position={[x, terrainHeight(x, z), z]} scale={scale}>
      <FarmModel id="tree" fallback={<TreeFallback />} onError={onError} />
    </group>
  );
}

export function HayBale({ position, rotationY = 0, onError }: { position: [number, number]; rotationY?: number; onError?: (e: unknown) => void }) {
  const [x, z] = position;
  return (
    <group position={[x, terrainHeight(x, z), z]} rotation-y={rotationY}>
      <FarmModel id="hayBale" fallback={<HayFallback />} onError={onError} />
    </group>
  );
}
