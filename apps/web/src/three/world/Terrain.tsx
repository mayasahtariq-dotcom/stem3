"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { color } from "@mooshala/tokens";
import { POND, TERRAIN_SIZE, groundKind, terrainHeight, type GroundKind } from "./terrain-math";

const COLORS: Record<GroundKind, THREE.Color> = {
  grass: new THREE.Color("#5DB83A"),
  meadow: new THREE.Color(color.meadow),
  path: new THREE.Color("#C9A26B"),
  soil: new THREE.Color(color.soil),
  sand: new THREE.Color("#E8D49A"),
};

/** Builds the displaced, vertex-coloured terrain geometry. */
export function buildTerrainGeometry(segments: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    c.copy(COLORS[groundKind(x, z)]);
    // Higher ground is a touch lighter and yellower: sunlit hilltops.
    c.offsetHSL(0.01 * Math.min(1, h / 6), 0, 0.06 * Math.min(1, Math.max(0, h) / 6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Real 3D terrain: a displaced heightfield with paths, a tilled field and a pond. */
export function Terrain({ segments = 96, receiveShadow = true }: { segments?: number; receiveShadow?: boolean }) {
  const geometry = useMemo(() => buildTerrainGeometry(segments), [segments]);
  // Geometry built imperatively is ours to dispose.
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group name="terrain">
      <mesh geometry={geometry} receiveShadow={receiveShadow} name="terrain-ground">
        <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
      </mesh>
      <mesh name="pond-water" position={[POND.x, -0.35, POND.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[POND.radius + 0.2, 40]} />
        <meshStandardMaterial color={color.sky} transparent opacity={0.85} roughness={0.15} metalness={0.1} />
      </mesh>
    </group>
  );
}
