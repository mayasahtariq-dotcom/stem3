"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Model } from "./Model";
import type { ModelId } from "./models";

const WOOD = "#9a6a3e", WOOD_DARK = "#6e4627", ROOF = "#c9452f", WHITE = "#f4efe6";

function Gazebo() {
  const posts = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.3, 2.4, 0.3, 8]} />
        <meshStandardMaterial color="#b9946a" roughness={0.9} />
      </mesh>
      {[0.32, 0.36].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} receiveShadow>
          <cylinderGeometry args={[2.15 - i * 0.05, 2.2, 0.04, 8]} />
          <meshStandardMaterial color={i ? "#c9a57a" : WOOD_DARK} roughness={0.9} />
        </mesh>
      ))}
      {posts.map((a, i) => (
        <group key={i} position={[Math.cos(a) * 2, 0, Math.sin(a) * 2]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <boxGeometry args={[0.16, 2.5, 0.16]} />
            <meshStandardMaterial color={WOOD} roughness={0.85} />
          </mesh>
          {i % 8 !== 2 && (
            <group rotation-y={-a - Math.PI / 8 - Math.PI / 2}>
              <mesh position={[0.77, 0.95, 0]} castShadow>
                <boxGeometry args={[1.5, 0.08, 0.08]} />
                <meshStandardMaterial color={WOOD} roughness={0.85} />
              </mesh>
              {[0.25, 0.55, 0.85, 1.15].map((x) => (
                <mesh key={x} position={[x + 0.05, 0.65, 0]} castShadow>
                  <boxGeometry args={[0.06, 0.6, 0.06]} />
                  <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}
      <mesh position={[0, 2.85, 0]} castShadow>
        <cylinderGeometry args={[2.3, 2.3, 0.18, 8]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, 3.25 + k * 0.42, 0]} castShadow>
          <coneGeometry args={[2.85 - k * 0.85, 0.75, 8, 1, true]} />
          <meshStandardMaterial color={k % 2 ? "#b33d29" : ROOF} roughness={0.75} side={2} />
        </mesh>
      ))}
      <mesh position={[0, 4.5, 0]} castShadow>
        <sphereGeometry args={[0.14, 12, 8]} />
        <meshStandardMaterial color="#e2b13c" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Greenhouse() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[4, 0.4, 3]} />
        <meshStandardMaterial color="#9b9a94" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[3.9, 2, 2.9]} />
        <meshPhysicalMaterial color="#d9f2ff" transparent opacity={0.28} roughness={0.05} transmission={0} metalness={0} />
      </mesh>
      <mesh position={[0, 2.8, 0]} rotation-z={Math.PI / 4} scale={[1, 1, 1]}>
        <boxGeometry args={[1.45, 1.45, 2.9]} />
        <meshPhysicalMaterial color="#d9f2ff" transparent opacity={0.3} roughness={0.05} />
      </mesh>
      {[-1.95, -0.65, 0.65, 1.95].map((x) =>
        [-1.45, 1.45].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.6, z]} castShadow>
            <boxGeometry args={[0.07, 2.4, 0.07]} />
            <meshStandardMaterial color={WHITE} />
          </mesh>
        )),
      )}
      <mesh position={[0, 3.82, 0]}>
        <boxGeometry args={[0.1, 0.1, 3]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      <Model id="crop-tomato-4" position={[-1, 0.4, 0.6]} scale={0.6} />
      <Model id="crop-lettuce-4" position={[0.8, 0.4, 0.6]} scale={0.8} />
      <Model id="crop-carrot-3" position={[-0.8, 0.4, -0.7]} scale={0.6} />
      <Model id="flowers-a" position={[1, 0.4, -0.6]} />
    </group>
  );
}

function Birdhouse() {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1.6, 8]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <boxGeometry args={[0.36, 0.4, 0.34]} />
        <meshStandardMaterial color="#e9d3a5" />
      </mesh>
      <mesh position={[0, 1.78, 0.171]}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color="#3a2618" />
      </mesh>
      <mesh position={[0, 2.06, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[0.36, 0.3, 4]} />
        <meshStandardMaterial color={ROOF} />
      </mesh>
      <Model id="flower-a" position={[0.15, 0, 0.1]} scale={0.8} />
    </group>
  );
}

function FlowerArch() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation-x={0} castShadow>
        <torusGeometry args={[1.1, 0.07, 8, 24, Math.PI]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <meshStandardMaterial color={WHITE} />
        </mesh>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 13) * Math.PI;
        return <Model key={i} id={i % 2 ? "flower-a" : "flower-b"} position={[Math.cos(a) * 1.1, Math.sin(a) * 1.1 - 0.15, 0]} scale={0.45} rotationY={i} />;
      })}
      <Model id="bush-flowers" position={[-1.15, 0, 0]} scale={0.55} />
      <Model id="bush-flowers" position={[1.15, 0, 0]} scale={0.55} rotationY={2} />
    </group>
  );
}

/** Water droplets bobbing above the fountain bowl. */
function FountainSpray() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.9 + i / g.children.length) % 1;
      const a = (i / g.children.length) * Math.PI * 2;
      c.position.set(Math.cos(a) * t * 0.6, 1.7 + Math.sin(t * Math.PI) * 0.5 - t * 0.4, Math.sin(a) * t * 0.6);
      c.scale.setScalar(1 - t * 0.6);
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#bfeaff" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** One store item as it stands in the world (also used for previews). */
export function ItemModel({ model }: { model: string }) {
  switch (model) {
    case "flower-cart":
      return (
        <group>
          <Model id="cart" />
          <Model id="flowers-a" position={[-0.4, 0.95, 0]} scale={0.9} />
          <Model id="flowers-b" position={[0.35, 0.95, 0.1]} scale={0.8} rotationY={1} />
          <Model id="flower-a" position={[0, 0.95, -0.2]} scale={0.8} />
        </group>
      );
    case "garden-bench":
      return <Model id="k-bench" />;
    case "fountain":
      return (
        <group>
          <Model id="fountain-k" scale={1.3} />
          <FountainSpray />
        </group>
      );
    case "lamp-post":
      return <Model id="lantern" />;
    case "flower-arch":
      return <FlowerArch />;
    case "birdhouse":
      return <Birdhouse />;
    case "flower-pot":
      return (
        <group>
          <Model id="pot-large" />
          <Model id="flowers-a" position={[0, 0.55, 0]} scale={0.7} />
        </group>
      );
    case "statue":
      return <Model id="obelisk" />;
    case "gazebo":
      return <Gazebo />;
    case "greenhouse":
      return <Greenhouse />;
    case "cottage":
      return <Model id="house-2" />;
    case "small-barn":
      return <Model id="barn-small" />;
    case "animal-shelter":
      return <Model id="barn-open" />;
    case "windmill":
      return <Model id="windmill" scale={0.75} />;
    case "blossom-tree":
      return <Model id="blossom-1" />;
    case "apple-tree":
      return <Model id="crop-apple-4" scale={1.6} />;
    case "sunflowers":
      return (
        <group>
          <Model id="flowers-b" />
          <Model id="flower-b" position={[0.35, 0, 0.2]} rotationY={2} />
        </group>
      );
    case "stepping-stones":
      return (
        <group>
          <Model id="path-stone-1" position={[-0.35, 0, 0]} />
          <Model id="path-stone-2" position={[0.4, 0, 0.2]} rotationY={1} />
        </group>
      );
    case "picnic-table":
      return <Model id="table" />;
    case "gate":
      return <Model id="fence-gate-k" />;
    case "log-pile":
      return <Model id="log-stack" />;
    default:
      return <Model id={model as ModelId} />;
  }
}
