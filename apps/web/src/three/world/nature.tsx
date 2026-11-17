"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { color } from "@mooshala/tokens";
import { butterflyPath, cloudX, flap, sway } from "../animation/idle";
import { POND, groundKind, terrainHeight } from "./terrain-math";

const Std = ({ c, r = 0.85 }: { c: string; r?: number }) => <meshStandardMaterial color={c} roughness={r} flatShading />;

/** Wind uniform shared by every swaying material. */
const wind = { value: 0 };
export function WindClock({ reducedMotion }: { reducedMotion?: boolean }) {
  useFrame(({ clock }) => {
    wind.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  return null;
}

/** Bends vertices by their height above the ground, so tufts sway at the tips. */
function swayMaterial(c: string) {
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec4 wp = instanceMatrix * vec4(position, 1.0);
         float bend = max(position.y, 0.0);
         transformed.x += sin(uWind * 1.6 + wp.x * 0.4 + wp.z * 0.3) * 0.12 * bend;
         transformed.z += cos(uWind * 1.3 + wp.x * 0.2) * 0.06 * bend;`,
      );
  };
  return m;
}

/** Instanced grass tufts scattered on grass and meadow ground, swaying in the wind. */
export function GrassTufts({ count = 300, seed = 3 }: { count?: number; seed?: number }) {
  const material = useMemo(() => swayMaterial("#4FA52C"), []);
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.12, 0.6, 3);
    g.translate(0, 0.3, 0);
    return g;
  }, []);
  useEffect(() => () => (material.dispose(), geometry.dispose()), [material, geometry]);
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const gen = { s: seed };
    const rnd = () => {
      gen.s = (gen.s * 16807) % 2147483647;
      return gen.s / 2147483647;
    };
    let guard = 0;
    while (out.length < count && guard++ < count * 6) {
      const x = (rnd() - 0.5) * 70, z = (rnd() - 0.5) * 70;
      const kind = groundKind(x, z);
      if (kind !== "grass" && kind !== "meadow") continue;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 1.5) continue;
      const sc = 0.7 + rnd() * 0.8;
      m.compose(new THREE.Vector3(x, terrainHeight(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3(sc, sc, sc));
      out.push(m.clone());
    }
    return out;
  }, [count, seed]);
  return (
    <instancedMesh
      name="grass-tufts"
      args={[geometry, material, matrices.length]}
      ref={(mesh) => {
        if (!mesh) return;
        matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
        mesh.instanceMatrix.needsUpdate = true;
      }}
    />
  );
}

export function Bush({ position, scale = 1 }: { position: [number, number]; scale?: number }) {
  const [x, z] = position;
  return (
    <group name="bush" position={[x, terrainHeight(x, z), z]} scale={scale}>
      {[[0, 0.5, 0, 0.7], [0.5, 0.4, 0.2, 0.5], [-0.45, 0.38, -0.1, 0.5]].map(([bx, by, bz, r], i) => (
        <mesh key={i} castShadow position={[bx!, by!, bz!]}>
          <icosahedronGeometry args={[r!, 0]} />
          <Std c={i ? color.grass : color.leaf} />
        </mesh>
      ))}
    </group>
  );
}

const PETALS = [color.berry, color.coral, color.sun, "#FFFFFF", color.sky];

/**
 * A flower: a bud until `bloomed`, then it opens with a springy scale. One
 * blooms along the path for every lesson the student finishes.
 */
export function Flower({ position, bloomed, hue = 0, reducedMotion }: { position: [number, number]; bloomed: boolean; hue?: number; reducedMotion?: boolean }) {
  const head = useRef<THREE.Group>(null);
  const [x, z] = position;
  useFrame(({ clock }, dt) => {
    const g = head.current;
    if (!g) return;
    const target = bloomed ? 1 : 0.35;
    g.scale.setScalar(reducedMotion ? target : g.scale.x + (target - g.scale.x) * Math.min(1, dt * 4));
    g.rotation.z = reducedMotion ? 0 : sway(clock.elapsedTime, x, z, 0.08);
  });
  return (
    <group name={bloomed ? "flower-bloomed" : "flower-bud"} position={[x, terrainHeight(x, z), z]} scale={1.7} userData={{ bloomed }}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 4]} />
        <Std c={color.leaf} />
      </mesh>
      <group ref={head} position={[0, 0.72, 0]} scale={bloomed ? 1 : 0.35}>
        {bloomed &&
          [0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.16, 0, Math.sin((i / 5) * Math.PI * 2) * 0.16]}>
              <sphereGeometry args={[0.12, 6, 4]} />
              <Std c={PETALS[hue % PETALS.length]!} />
            </mesh>
          ))}
        <mesh>
          <sphereGeometry args={[bloomed ? 0.1 : 0.14, 6, 4]} />
          <Std c={bloomed ? color.sun : color.grass} />
        </mesh>
      </group>
    </group>
  );
}

/** Puffy low-poly clouds drifting across the sky. */
export function Clouds({ count = 6, reducedMotion }: { count?: number; reducedMotion?: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const clouds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: -70 + i * 27, y: 26 + (i % 3) * 4, z: -50 + ((i * 37) % 70), s: 1 + (i % 3) * 0.4, v: 0.6 + (i % 4) * 0.25 })), [count]);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    clouds.forEach((c, i) => {
      const g = refs.current[i];
      if (g) g.position.x = cloudX(t, c.x, c.v);
    });
  });
  return (
    <group name="clouds">
      {clouds.map((c, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[c.x, c.y, c.z]} scale={c.s}>
          {[[0, 0, 0, 2.4], [2.2, -0.3, 0.4, 1.8], [-2.1, -0.4, -0.2, 1.7], [0.6, 1.1, 0, 1.6]].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x!, y!, z!]}>
              <icosahedronGeometry args={[r!, 1]} />
              <meshStandardMaterial color="#FFFFFF" roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Butterflies fluttering around a flower bed. */
export function Butterflies({ home, count = 4, reducedMotion }: { home: [number, number]; count?: number; reducedMotion?: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const base = terrainHeight(home[0], home[1]);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const [x, y, z] = butterflyPath(t, i * 1.7);
      g.position.set(home[0] + x, base + y, home[1] + z);
      const f = flap(t, i);
      (g.children[0] as THREE.Object3D).rotation.z = f;
      (g.children[1] as THREE.Object3D).rotation.z = -f;
    }
  });
  return (
    <group name="butterflies">
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          {[1, -1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.12, 0, 0]}>
                <planeGeometry args={[0.22, 0.16]} />
                <meshStandardMaterial color={[color.sun, color.berry, color.sky, color.coral][i % 4]} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** A stream running out of the pond, with ripples that flow downhill. */
export function Stream({ reducedMotion }: { reducedMotion?: boolean }) {
  const points = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = POND.x - POND.radius + 0.5 - t * 26;
      const z = POND.z + 2 + Math.sin(t * 5) * 3 + t * 14;
      out.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.06, z));
    }
    return out;
  }, []);
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    const n = 80;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n), tan = curve.getTangent(i / n);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(0.9);
      pos.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
      uv.push(0, i / 6, 1, i / 6);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [points]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(color.sky) }, uB: { value: new THREE.Color("#BFE9FF") } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv; void main(){ float r = step(0.82, fract(vUv.y * 1.5 - uTime * 0.6 + sin(vUv.x * 6.0) * 0.1)); float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x); gl_FragColor = vec4(mix(uA, uB, r * 0.7), 0.88 * edge); }",
      }),
    [],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
  const live = useRef(material);
  useEffect(() => {
    live.current = material;
  }, [material]);
  useFrame(({ clock }) => {
    live.current.uniforms.uTime!.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  return <mesh name="stream" geometry={geometry} material={material} />;
}

/** Ripples on the pond surface. */
export function PondRipples({ reducedMotion }: { reducedMotion?: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0.5 : clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = ((t * 0.4 + i / 3) % 1 + 1) % 1;
      m.scale.setScalar(0.5 + p * 3);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - p);
    });
  });
  return (
    <group name="pond-ripples" position={[POND.x + 1, -0.3, POND.z - 1]} rotation-x={-Math.PI / 2}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)}>
          <ringGeometry args={[0.45, 0.55, 24]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}
