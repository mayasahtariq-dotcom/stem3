"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CAMERA } from "../config/camera";
import { LIGHTING } from "../config/lighting";
import { bubbleAt, flap, wanderPath } from "../animation/idle";
import { terrainHeight } from "./terrain-math";

/**
 * The farm's sky and air: a bright gradient sky with a sun glow, distant hills
 * for depth, a rainbow, butterflies that fly all over the farm and soap
 * bubbles drifting up from the meadow. Purely visual: nothing here is
 * interactive, and all motion stops with reduced motion.
 */

const SUN_DIR = new THREE.Vector3(...LIGHTING.sun.position).normalize();

/** Gradient sky dome: deep blue overhead, pale haze at the horizon, a warm sun glow. */
export function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(LIGHTING.sky.top) },
          middle: { value: new THREE.Color(LIGHTING.sky.middle) },
          horizon: { value: new THREE.Color(LIGHTING.sky.horizon) },
          sunDir: { value: SUN_DIR },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 middle; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
          void main(){
            float h = vDir.y;
            vec3 c = mix(horizon, middle, smoothstep(-0.02, 0.22, h));
            c = mix(c, top, smoothstep(0.22, 0.75, h));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            c += vec3(1.0, 0.92, 0.72) * (pow(s, 90.0) * 0.9 + pow(s, 10.0) * 0.22);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh name="sky" material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[320, 32, 16]} />
    </mesh>
  );
}

/** A soft rainbow arcing over the hills behind the farm. */
export function Rainbow({ position = [-80, -8, -100] as [number, number, number], radius = 46 }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
        uniforms: { inner: { value: radius * 0.88 }, outer: { value: radius } },
        vertexShader: `varying vec2 vPos; void main(){ vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float inner; uniform float outer; varying vec2 vPos;
          vec3 hsv(float h){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return k; }
          void main(){
            float t = clamp((length(vPos) - inner) / (outer - inner), 0.0, 1.0);
            vec3 c = hsv(0.78 * (1.0 - t));
            float edge = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.88, t);
            float ground = smoothstep(0.0, outer * 0.35, vPos.y);
            gl_FragColor = vec4(mix(c, vec3(1.0), 0.18), 0.42 * edge * ground);
          }`,
      }),
    [radius],
  );
  // Face the default camera so the arc reads as a full bow.
  const rotationY = Math.atan2(CAMERA.position[0] - position[0], CAMERA.position[2] - position[2]);
  return (
    <mesh name="rainbow" position={position} rotation-y={rotationY} material={material} renderOrder={-5}>
      <ringGeometry args={[radius * 0.88, radius, 96, 1, 0, Math.PI]} />
    </mesh>
  );
}

/** Rolling hills and hazy mountains on the horizon, so the farm sits in a valley. */
export function DistantHills({ count = 22 }: { count?: number }) {
  const hills = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + ((i * 37) % 10) * 0.02;
        const far = i % 2 === 0;
        const r = far ? 165 + ((i * 17) % 30) : 108 + ((i * 7) % 16);
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          h: far ? 14 + ((i * 13) % 12) : 8 + ((i * 7) % 7),
          w: far ? 34 + ((i * 11) % 20) : 30 + ((i * 5) % 16),
          color: far ? LIGHTING.hills.far : LIGHTING.hills.near,
          ry: i * 0.7,
        };
      }),
    [count],
  );
  return (
    <group name="hills">
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, -3, h.z]} rotation-y={h.ry} scale={[h.w, h.h, h.w * 0.8]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={h.color} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Big soft clouds along the horizon (the drifting clouds overhead stay too). */
export function HorizonClouds({ count = 9, reducedMotion }: { count?: number; reducedMotion?: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const clouds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = -2.6 + (i / count) * 2.4 + ((i * 13) % 7) * 0.03;
        const r = 150 + ((i * 29) % 40);
        return { a, r, y: 34 + ((i * 11) % 22), s: 4 + (i % 3) * 1.4, v: 0.0035 + (i % 3) * 0.0015 };
      }),
    [count],
  );
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    clouds.forEach((c, i) => {
      const g = refs.current[i];
      if (g) g.position.set(Math.cos(c.a + t * c.v) * c.r, c.y, Math.sin(c.a + t * c.v) * c.r);
    });
  });
  return (
    <group name="horizon-clouds">
      {clouds.map((c, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r]} scale={c.s}>
          {[[0, 0, 0, 2.4], [2.3, -0.4, 0.3, 1.9], [-2.2, -0.5, -0.2, 1.8], [0.8, 1.2, 0, 1.7], [-1, 0.9, 0.4, 1.4], [3.8, -0.8, 0, 1.2]].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x!, y!, z!]}>
              <icosahedronGeometry args={[r!, 2]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#EAF4FF" emissiveIntensity={0.35} roughness={1} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Wing({ side, tint }: { side: 1 | -1; tint: string }) {
  return (
    <group>
      <mesh position={[side * 0.2, 0, 0.05]} rotation-y={side * 0.2}>
        <circleGeometry args={[0.2, 10]} />
        <meshStandardMaterial color={tint} side={THREE.DoubleSide} emissive={tint} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[side * 0.15, 0, -0.16]}>
        <circleGeometry args={[0.13, 10]} />
        <meshStandardMaterial color={tint} side={THREE.DoubleSide} emissive={tint} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

const BUTTERFLY_TINTS = ["#FF9F1C", "#FFD23F", "#FF8FAB", "#7AD3F7", "#FFB347", "#C3A6FF"];

/** Butterflies that fly all over the farm, banking towards where they're heading. */
export function WanderingButterflies({ count = 8, reducedMotion }: { count?: number; reducedMotion?: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 4 : clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const p = wanderPath(t, i + 1);
      g.position.set(p.x, terrainHeight(p.x, p.z) + p.y, p.z);
      g.rotation.y = p.heading;
      const f = reducedMotion ? 0.4 : flap(t * 0.8, i);
      (g.children[0] as THREE.Object3D).rotation.z = f;
      (g.children[1] as THREE.Object3D).rotation.z = -f;
    }
  });
  return (
    <group name="wandering-butterflies">
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} scale={1.3}>
          <Wing side={1} tint={BUTTERFLY_TINTS[i % BUTTERFLY_TINTS.length]!} />
          <Wing side={-1} tint={BUTTERFLY_TINTS[i % BUTTERFLY_TINTS.length]!} />
          <mesh rotation-x={Math.PI / 2}>
            <capsuleGeometry args={[0.03, 0.3, 3, 6]} />
            <meshStandardMaterial color="#3B2A1A" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Soap bubbles drifting up over the meadow: clear in the middle, a rainbow sheen at the rim. */
export function Bubbles({ count = 16, reducedMotion }: { count?: number; reducedMotion?: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec3 vN; varying vec3 vV;
          void main(){
            float f = 1.0 - max(dot(vN, vV), 0.0);
            float rim = pow(f, 2.2);
            vec3 sheen = 0.6 + 0.4 * cos(6.2831 * (f * 1.4 + vec3(0.0, 0.33, 0.67)));
            float spec = pow(max(dot(reflect(-vV, vN), normalize(vec3(0.4, 0.8, 0.3))), 0.0), 40.0);
            gl_FragColor = vec4(mix(sheen, vec3(1.0), 0.35) + spec, rim * 0.95 + 0.06 + spec);
          }`,
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = reducedMotion ? 6 : clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const b = bubbleAt(t, i);
      m.position.set(b.x, terrainHeight(b.x, b.z) + b.y, b.z);
      m.scale.setScalar(Math.max(0.001, b.scale) * (0.3 + (i % 4) * 0.09));
    }
  });
  return (
    <group name="bubbles">
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} material={material} renderOrder={2}>
          <sphereGeometry args={[1, 20, 14]} />
        </mesh>
      ))}
    </group>
  );
}
