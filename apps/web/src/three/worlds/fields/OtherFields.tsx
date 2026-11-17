"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { FIELD_GEOMETRY } from "@/lib/world/fields";
import type { QualitySettings } from "../../engine/quality";
import { Duck } from "../../world/animals";
import { Animal } from "../Animal";
import { ItemModel } from "../items";
import { Model } from "../Model";
import { CropBed, FenceLine, PondDressing, Prop, Scatter, SpinningWindmill, ground } from "./common";

interface P {
  quality: QualitySettings;
  reducedMotion?: boolean;
}

const pondY = (g: (typeof FIELD_GEOMETRY)["starter-meadow"], i = 0) => {
  const w = g.water[i]!;
  return ground(g, w.x + w.r * 1.4, w.z)[1] - w.depth * 0.38 + 0.05;
};

/** Blossom Meadow: pink blossom trees, flower beds, a fountain plaza, beehives and a cottage. */
export function BlossomMeadow({ quality, reducedMotion }: P) {
  const g = FIELD_GEOMETRY["blossom-meadow"];
  const d = quality.detail;
  return (
    <group name="blossom-meadow">
      <group position={ground(g, 0, -4)}>
        <ItemModel model="fountain" />
      </group>
      <Prop g={g} id="house-2" x={-16} z={-14} r={0.6} />
      <group position={ground(g, 16, -14)} rotation-y={-0.5}>
        <ItemModel model="greenhouse" />
      </group>
      {[0, 1, 2].map((i) => (
        <group key={i} position={ground(g, 16.5 + i * 1.4, 9 + i * 0.8)} rotation-y={-0.4}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.36, 0.42, 0.9, 10]} />
            <meshStandardMaterial color="#f2c14e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <coneGeometry args={[0.5, 0.35, 10]} />
            <meshStandardMaterial color="#c98a3a" />
          </mesh>
        </group>
      ))}
      <group position={ground(g, 0, 12)}>
        <ItemModel model="flower-arch" />
      </group>
      <Prop g={g} id="k-bench" x={-4} z={-8.5} r={0.4} />
      <Prop g={g} id="k-bench" x={4} z={-8.5} r={-0.4} />
      <Prop g={g} id="lantern" x={-2.2} z={6} />
      <Prop g={g} id="lantern" x={2.2} z={18} />
      {g.plots.map((pl, i) => (
        <CropBed key={i} g={g} plot={pl} crop={i === 2 ? "tomato" : "bushberries"} stage={4} spacing={1.1} fenced={false} />
      ))}
      <Scatter g={g} ids={["flowers-a", "flowers-b", "flower-a", "flower-b"]} seed={21} count={Math.round(420 * d)} rMin={3} rMax={36} clearance={0.5} scale={[0.8, 1.5]} />
      <Scatter g={g} ids={["bush-flowers", "plant-big"]} seed={22} count={Math.round(60 * d)} rMin={6} rMax={34} clearance={1.4} />
      <Scatter g={g} ids={["blossom-1", "blossom-2"]} seed={23} count={Math.round(26 * d)} rMin={14} rMax={40} clearance={3} scale={[0.9, 1.3]} />
      <Scatter g={g} ids={["blossom-1", "tree-1", "blossom-2", "tree-5"]} seed={24} count={Math.round(80 * d)} rMin={38} rMax={90} clearance={3} scale={[1, 1.4]} />
      <Scatter g={g} ids={["pine-2", "pine-4"]} seed={25} count={Math.round(60 * d)} rMin={70} rMax={115} clearance={3} scale={[1.1, 1.6]} />
      <PondDressing g={g} ducks={<Duck center={[g.water[0]!.x, pondY(g), g.water[0]!.z]} radius={2} reducedMotion={reducedMotion} />} />
      <Animal id="sheep" g={g} home={{ x: 18, z: 22, r: 5 }} seed={31} reducedMotion={reducedMotion} />
      <Animal id="sheep" g={g} home={{ x: 18, z: 22, r: 5 }} seed={32} reducedMotion={reducedMotion} />
      <Animal id="alpaca" g={g} home={{ x: -22, z: 22, r: 5 }} seed={33} reducedMotion={reducedMotion} />
    </group>
  );
}

/** Golden Valley: big wheat and corn fields, windmills on the hill, silos and a great barn. */
export function GoldenValley({ quality, reducedMotion }: P) {
  const g = FIELD_GEOMETRY["golden-valley"];
  const d = quality.detail;
  const crops = ["wheat", "corn", "wheat", "pumpkin", "carrot"];
  return (
    <group name="golden-valley">
      <Prop g={g} id="barn-big" x={-2} z={-16} />
      <Prop g={g} id="silo" x={11} z={-18} />
      <Prop g={g} id="silo-house" x={14} z={-17} r={-0.3} />
      <group position={ground(g, -24, -24)} rotation-y={0.6}>
        <SpinningWindmill speed={reducedMotion ? 0 : 0.6} />
      </group>
      <group position={ground(g, -30, -12)} rotation-y={0.9}>
        <SpinningWindmill id="windmill-frame" speed={reducedMotion ? 0 : 1.1} scale={0.8} />
      </group>
      <Prop g={g} id="house-1" x={22} z={6} r={-1.2} />
      <Prop g={g} id="water-tower" x={27} z={-2} />
      <Prop g={g} id="hay-bale" x={7} z={-8} r={0.3} />
      <Prop g={g} id="hay-bale" x={8.3} z={-7} r={1.2} />
      <Prop g={g} id="hay-bundle" x={-8} z={-6} />
      <Prop g={g} id="cart" x={10} z={-4} r={-0.5} />
      {g.plots.map((pl, i) => (
        <CropBed key={i} g={g} plot={pl} crop={crops[i]!} stage={4} spacing={crops[i] === "wheat" ? 0.55 : 1.1} fenced={i < 2} />
      ))}
      <Scatter g={g} ids={["golden-1", "autumn-1", "tree-2"]} seed={41} count={Math.round(40 * d)} rMin={36} rMax={70} clearance={3} />
      <Scatter g={g} ids={["tree-3", "pine-4", "golden-1"]} seed={42} count={Math.round(90 * d)} rMin={65} rMax={120} clearance={3} scale={[1, 1.5]} />
      <Scatter g={g} ids={["grass-wispy", "grass-tall", "flower-b"]} seed={43} count={Math.round(240 * d)} rMin={3} rMax={42} clearance={0.5} />
      <Scatter g={g} ids={["rock-1", "rock-3", "bush"]} seed={44} count={Math.round(40 * d)} rMin={8} rMax={45} clearance={1.2} sink={0.1} />
      <Animal id="horse" g={g} home={{ x: 22, z: 20, r: 6 }} seed={45} reducedMotion={reducedMotion} />
      <Animal id="donkey" g={g} home={{ x: 22, z: 20, r: 6 }} seed={46} reducedMotion={reducedMotion} />
      <Animal id="pig" g={g} home={{ x: 8, z: -26, r: 4 }} seed={47} reducedMotion={reducedMotion} />
      <Animal id="pig" g={g} home={{ x: 8, z: -26, r: 4 }} seed={48} reducedMotion={reducedMotion} />
      <FenceLine g={g} from={[3, -22]} to={[13, -22]} />
      <FenceLine g={g} from={[3, -30]} to={[13, -30]} />
    </group>
  );
}

/** Woodland Farm: dense forest, a lake with a wooden bridge over the stream, a log cabin and wildlife. */
export function WoodlandFarm({ quality, reducedMotion }: P) {
  const g = FIELD_GEOMETRY["woodland-farm"];
  const d = quality.detail;
  const notNear = useMemo(() => (x: number, z: number) => Math.hypot(x, z) > 20, []);
  return (
    <group name="woodland-farm">
      <Prop g={g} id="house-2" x={10} z={-12} r={-0.6} />
      <Prop g={g} id="tent" x={-14} z={14} r={0.8} />
      <Prop g={g} id="campfire" x={-11.5} z={11.5} />
      <Prop g={g} id="log-large" x={-10} z={13.5} r={1.3} />
      <Prop g={g} id="log-stack" x={13} z={-7} r={0.4} />
      <Prop g={g} id="canoe" x={-15} z={-3} r={1.1} />
      <group position={[3.2, ground(g, 3.2, 2.6)[1] + 0.9, 2.6]} rotation-y={-0.75}>
        <Model id="bridge" scale={1.4} />
      </group>
      <CropBed g={g} plot={g.plots[0]!} crop="beet" stage={4} spacing={0.9} fenced={false} />
      <Scatter g={g} ids={["pine-1", "pine-2", "pine-3", "tree-4", "pine-5", "twisted-1"]} seed={51} count={Math.round(130 * d)} rMin={18} rMax={60} clearance={2.4} scale={[0.9, 1.4]} mask={notNear} />
      <Scatter g={g} ids={["pine-4", "pine-2", "tree-3", "pine-5"]} seed={52} count={Math.round(220 * d)} rMin={55} rMax={115} clearance={2.5} scale={[1.1, 1.7]} />
      <Scatter g={g} ids={["fern", "bush", "plant-big", "mushroom-red", "mushroom"]} seed={53} count={Math.round(150 * d)} rMin={5} rMax={45} clearance={0.8} />
      <Scatter g={g} ids={["stump", "log-large", "rock-2", "rock-tall"]} seed={54} count={Math.round(30 * d)} rMin={10} rMax={45} clearance={1.5} sink={0.1} />
      <PondDressing g={g} ducks={<Duck center={[g.water[0]!.x, pondY(g), g.water[0]!.z]} radius={3} reducedMotion={reducedMotion} />} />
      <Animal id="deer" g={g} home={{ x: -20, z: 22, r: 6 }} seed={55} reducedMotion={reducedMotion} />
      <Animal id="stag" g={g} home={{ x: 20, z: 18, r: 6 }} seed={56} reducedMotion={reducedMotion} />
      <Animal id="fox" g={g} home={{ x: 18, z: -20, r: 5 }} seed={57} reducedMotion={reducedMotion} speed={1.4} />
      <Animal id="horse-white" g={g} home={{ x: 4, z: 18, r: 4 }} seed={58} reducedMotion={reducedMotion} />
    </group>
  );
}

/** Mountain Paradise: terraced farm under snowy peaks, a waterfall feeding the stream, alpacas and a viewpoint. */
/** A falling ribbon of water: scrolling stripes and foam at the foot. */
function Waterfall({ at, height, reducedMotion }: { at: [number, number, number]; height: number; reducedMotion?: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform float uTime; varying vec2 vUv; void main(){ float s = sin(vUv.x*40.0 + sin(vUv.x*7.0)*3.0) * 0.5 + 0.5; float f = fract(vUv.y*3.0 + uTime*1.6 + s*0.4); vec3 c = mix(vec3(0.55,0.8,0.95), vec3(0.95,0.99,1.0), smoothstep(0.55,1.0,f)*0.8 + (1.0-vUv.y)*0.0); float edge = smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x); gl_FragColor = vec4(c, 0.85*edge); }",
      }),
    [],
  );
  useFrame((_, dt) => {
    if (!reducedMotion) mat.uniforms.uTime!.value += dt;
  });
  return (
    <group position={at}>
      <mesh position={[0, height / 2, 0]} material={mat}>
        <planeGeometry args={[3.2, height, 1, 1]} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * 0.9, 0.4, 0.6]}>
          <sphereGeometry args={[0.9, 10, 8]} />
          <meshStandardMaterial color="#f4fbff" transparent opacity={0.75} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export function MountainParadise({ quality, reducedMotion }: P) {
  const g = FIELD_GEOMETRY["mountain-paradise"];
  const d = quality.detail;
  return (
    <group name="mountain-paradise">
      <Prop g={g} id="barn-small" x={-14} z={-14} r={0.6} />
      <Prop g={g} id="house-1" x={14} z={-16} r={-0.6} />
      <Prop g={g} id="k-bench" x={20} z={10} r={-2.3} />
      <Prop g={g} id="lantern" x={18.5} z={8.6} />
      <Waterfall at={[-4, ground(g, -4, -31)[1] - 0.5, -31]} height={14} reducedMotion={reducedMotion} />
      <Model id="rock-3" position={ground(g, -7, -31)} scale={2.6} />
      <Model id="rock-3" position={ground(g, -1, -31.5)} scale={2.3} rotationY={2} />
      <Model id="rock-1" position={ground(g, -4, -29)} scale={1.6} />
      <CropBed g={g} plot={g.plots[0]!} crop="lettuce" stage={4} spacing={1} fenced={false} />
      <FenceLine g={g} from={[-8, 14]} to={[8, 14]} />
      <Scatter g={g} ids={["pine-1", "pine-2", "pine-3", "pine-5"]} seed={61} count={Math.round(80 * d)} rMin={26} rMax={60} clearance={2.4} scale={[0.9, 1.4]} />
      <Scatter g={g} ids={["pine-4", "pine-2", "pine-1"]} seed={62} count={Math.round(160 * d)} rMin={55} rMax={120} clearance={2.5} scale={[1.1, 1.7]} mask={(x, z) => ground(g, x, z)[1] < 38} />
      <Scatter g={g} ids={["rock-1", "rock-3", "rock-tall", "rock-2"]} seed={63} count={Math.round(60 * d)} rMin={10} rMax={60} clearance={1.2} sink={0.15} />
      <Scatter g={g} ids={["flowers-a", "flower-b", "grass-wispy", "clover"]} seed={64} count={Math.round(240 * d)} rMin={3} rMax={34} clearance={0.5} />
      <Animal id="alpaca" g={g} home={{ x: -2, z: 22, r: 6 }} seed={65} reducedMotion={reducedMotion} />
      <Animal id="llama" g={g} home={{ x: -2, z: 22, r: 6 }} seed={66} reducedMotion={reducedMotion} />
      <Animal id="sheep" g={g} home={{ x: 10, z: 18, r: 5 }} seed={67} reducedMotion={reducedMotion} />
      <Animal id="cow-brown" g={g} home={{ x: -20, z: 6, r: 5 }} seed={68} reducedMotion={reducedMotion} />
    </group>
  );
}
