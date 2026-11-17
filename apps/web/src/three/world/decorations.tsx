"use client";
import { color } from "@mooshala/tokens";
import { DECORATION_SPOTS } from "./layout";
import { terrainHeight } from "./terrain-math";

const Std = ({ c }: { c: string }) => <meshStandardMaterial color={c} roughness={0.85} flatShading />;

function Sunflowers() {
  return (
    <group name="deco-sunflowers">
      {[[0, 0], [0.8, 0.3], [-0.7, 0.4], [0.2, -0.7]].map(([x, z], i) => (
        <group key={i} position={[x!, 0, z!]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.6, 4]} />
            <Std c={color.leaf} />
          </mesh>
          <mesh position={[0, 1.65, 0.05]} rotation-x={0.3}>
            <cylinderGeometry args={[0.38, 0.38, 0.08, 10]} />
            <Std c={color.sun} />
          </mesh>
          <mesh position={[0, 1.67, 0.1]} rotation-x={0.3}>
            <cylinderGeometry args={[0.18, 0.18, 0.08, 8]} />
            <Std c={color.woodDark} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Beehive() {
  return (
    <group name="deco-beehive">
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.15, 1, 0.15]} />
        <Std c={color.woodDark} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow position={[0, 1.15 + i * 0.28, 0]}>
          <cylinderGeometry args={[0.45 - i * 0.1, 0.5 - i * 0.1, 0.28, 10]} />
          <Std c={i % 2 ? "#F5C04A" : "#E8A93A"} />
        </mesh>
      ))}
    </group>
  );
}

function Scarecrow() {
  return (
    <group name="deco-scarecrow">
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.12, 2, 0.12]} />
        <Std c={color.wood} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1.6, 0.1, 0.1]} />
        <Std c={color.wood} />
      </mesh>
      <mesh castShadow position={[0, 1.3, 0]}>
        <boxGeometry args={[0.6, 0.7, 0.3]} />
        <Std c={color.sky} />
      </mesh>
      <mesh castShadow position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.28, 8, 6]} />
        <Std c="#E8C35A" />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <coneGeometry args={[0.4, 0.4, 8]} />
        <Std c="#C9A26B" />
      </mesh>
    </group>
  );
}

const MODELS: Record<string, () => React.JSX.Element> = { "deco-sunflowers": Sunflowers, "deco-beehive": Beehive, "deco-scarecrow": Scarecrow };

/** Decorations the student bought with gems appear on the farm. */
export function Decorations({ items }: { items: string[] }) {
  return (
    <group name="decorations">
      {items.map((id) => {
        const Model = MODELS[id];
        const spot = DECORATION_SPOTS[id];
        if (!Model || !spot) return null;
        return (
          <group key={id} position={[spot[0], terrainHeight(spot[0], spot[1]), spot[1]]}>
            <Model />
          </group>
        );
      })}
    </group>
  );
}
