"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { distToPolyline, fbm, heightAt, noise, slopeAt, waterLevel, type FieldGeometry } from "@/lib/world/geometry";

export interface TerrainPalette {
  grassA: string;
  grassB: string;
  meadow: string;
  dirt: string;
  stone: string;
  sand: string;
  soil: string;
  rock: string;
  snow: string;
  water: string;
  waterDeep: string;
}

export const DEFAULT_PALETTE: TerrainPalette = {
  grassA: "#5aa83a",
  grassB: "#82c24a",
  meadow: "#a6d05a",
  dirt: "#b88a58",
  stone: "#a9a49a",
  sand: "#e3cf96",
  soil: "#6e4a2e",
  rock: "#8d8a83",
  snow: "#f4f7fb",
  water: "#4fb7d9",
  waterDeep: "#2a7fa8",
};

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Grid coordinate warp: dense near the farm, coarse at the horizon. */
const warp = (u: number) => Math.sign(u) * Math.pow(Math.abs(u), 1.7);

export function buildFieldTerrain(g: FieldGeometry, segments: number, pal: TerrainPalette): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(2, 2, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const C = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, new THREE.Color(v)])) as Record<keyof TerrainPalette, THREE.Color>;
  const c = new THREE.Color(), tmp = new THREE.Color();
  const half = g.size / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = warp(pos.getX(i)) * half, z = warp(pos.getZ(i)) * half;
    const h = heightAt(g, x, z);
    pos.setXYZ(i, x, h, z);
    // Grass: two greens mottled by noise, lighter meadow patches.
    c.copy(C.grassA).lerp(C.grassB, ss(0.3, 0.75, noise(x * 0.11, z * 0.11, g.seed + 1)));
    c.lerp(C.meadow, ss(1 - g.meadowAmount, 1 - g.meadowAmount + 0.25, noise(x * 0.16, z * 0.16, g.seed + 3)) * 0.7);
    // Sunlit hilltops yellower, valleys deeper green.
    c.offsetHSL(0.012 * Math.min(1, h / 10), 0, 0.04 * Math.max(-1, Math.min(1, h / 12)));
    // Rock on steep slopes, snow on peaks.
    const slope = slopeAt(g, x, z);
    c.lerp(tmp.copy(C.rock).offsetHSL(0, 0, fbm(x * 0.3, z * 0.3, 4) * 0.12), ss(0.65, 1.1, slope));
    if (g.snowLine !== undefined) c.lerp(C.snow, ss(g.snowLine - 3, g.snowLine + 3, h + fbm(x * 0.1, z * 0.1, 7) * 6));
    // Sand around ponds and streams, wet and dark under the water.
    for (const w of g.water) {
      const d = Math.hypot(x - w.x, z - w.z) - w.r;
      c.lerp(C.sand, ss(2.2, 0.3, d));
      if (d < 0) c.lerp(C.waterDeep, ss(0, -w.r * 0.7, d) * 0.7);
    }
    for (const s of g.streams) {
      const d = distToPolyline(x, z, s.points).d;
      c.lerp(C.sand, ss(s.width * 1.5, s.width * 0.7, d) * 0.8);
    }
    // Dirt or stone paths with soft, slightly ragged edges.
    for (const p of g.paths) {
      const d = distToPolyline(x, z, p.points).d + (noise(x * 0.8, z * 0.8, 9) - 0.5) * 0.35;
      const k = ss(p.width / 2 + 0.35, p.width / 2 - 0.25, d);
      if (k > 0) c.lerp(tmp.copy(p.stone ? C.stone : C.dirt).offsetHSL(0, 0, (noise(x * 2.5, z * 2.5, 2) - 0.5) * 0.08), k);
    }
    // Tilled soil with furrows in the raised beds.
    for (const p of g.plots) {
      const inside = Math.abs(x - p.x) < p.w / 2 - 0.2 && Math.abs(z - p.z) < p.d / 2 - 0.2;
      if (inside) c.copy(C.soil).offsetHSL(0, 0, Math.sin((z - p.z) * 5) * 0.05);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Adds fine procedural mottling so close-up ground reads as grass and earth, not flat colour. */
function detailMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldPos;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float d1 = n2(vWorldPos.xz * 3.1) * 0.6 + n2(vWorldPos.xz * 9.7) * 0.4;
        float d2 = n2(vWorldPos.xz * 0.9);
        diffuseColor.rgb *= 0.86 + d1 * 0.22 + (d2 - 0.5) * 0.08;`,
      );
  };
  return mat;
}

export function FieldTerrain({ geometry: g, segments, palette = DEFAULT_PALETTE, receiveShadow }: { geometry: FieldGeometry; segments: number; palette?: TerrainPalette; receiveShadow: boolean }) {
  const geo = useMemo(() => buildFieldTerrain(g, segments, palette), [g, segments, palette]);
  const mat = useMemo(() => detailMaterial(), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <mesh name="terrain-ground" geometry={geo} material={mat} receiveShadow={receiveShadow} />;
}

const waterUniforms = { uTime: { value: 0 } };

function waterMaterial(color: string, deep: string, flow = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: waterUniforms.uTime, uColor: { value: new THREE.Color(color) }, uDeep: { value: new THREE.Color(deep) }, uFlow: { value: flow } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform vec3 uDeep; uniform float uFlow; varying vec2 vUv; varying vec3 vW;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz;
        vec2 fl = uFlow > 0.0 ? vec2(0.0, -uTime * uFlow) : vec2(0.0);
        float r = n2((p + fl) * 1.3 + uTime * 0.25) * 0.5 + n2((p - fl) * 2.7 - uTime * 0.35) * 0.5;
        float edge = uFlow > 0.0 ? smoothstep(0.42, 0.5, abs(vUv.x - 0.5)) : smoothstep(0.82, 1.0, length(vUv - 0.5) * 2.0);
        vec3 c = mix(uDeep, uColor, 0.55 + r * 0.35 + edge * 0.3);
        float sparkle = smoothstep(0.82, 0.95, r);
        c += vec3(sparkle * 0.35) + vec3(edge * 0.25);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(V.y, 0.0), 3.0);
        c = mix(c, vec3(0.85, 0.94, 1.0), fres * 0.5);
        gl_FragColor = vec4(c, 0.88);
        #include <colorspace_fragment>
      }`,
  });
}

/** Ponds and streams with moving ripples, a sparkle and a fresnel sky tint. */
export function FieldWater({ geometry: g, palette = DEFAULT_PALETTE, reducedMotion }: { geometry: FieldGeometry; palette?: TerrainPalette; reducedMotion?: boolean }) {
  const pondMat = useMemo(() => waterMaterial(palette.water, palette.waterDeep), [palette]);
  const streamMat = useMemo(() => waterMaterial(palette.water, palette.waterDeep, 1.2), [palette]);
  useFrame((_, dt) => {
    if (!reducedMotion) waterUniforms.uTime.value += dt;
  });
  const streams = useMemo(
    () =>
      g.streams.map((s) => {
        // Ribbon along the stream, following the stream bed height.
        const curve = new THREE.CatmullRomCurve3(s.points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
        const pts = curve.getSpacedPoints(Math.max(20, Math.round(curve.getLength() / 1.2)));
        const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
        pts.forEach((p, i) => {
          const next = pts[Math.min(pts.length - 1, i + 1)]!, prev = pts[Math.max(0, i - 1)]!;
          const dir = next.clone().sub(prev).normalize();
          const n = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(s.width * 0.75);
          const y = heightAt(g, p.x, p.z) + s.depth * 0.55;
          verts.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z);
          uvs.push(0, i / 4, 1, i / 4);
          if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(idx);
        return geo;
      }),
    [g],
  );
  return (
    <group name="water">
      {g.water.map((w, i) => (
        <mesh key={i} name="pond-water" position={[w.x, waterLevel(g, w), w.z]} rotation-x={-Math.PI / 2} material={pondMat}>
          <circleGeometry args={[w.r + 0.6, 48]} />
        </mesh>
      ))}
      {streams.map((geo, i) => (
        <mesh key={`s${i}`} name="stream-water" geometry={geo} material={streamMat} />
      ))}
    </group>
  );
}
