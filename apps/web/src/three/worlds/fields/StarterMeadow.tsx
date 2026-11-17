"use client";
import { useMemo } from "react";
import { FIELD_GEOMETRY } from "@/lib/world/fields";
import type { QualitySettings } from "../../engine/quality";
import { Duck } from "../../world/animals";
import { Animal } from "../Animal";
import { Model } from "../Model";
import type { CropId } from "../models";
import { CropBed, FenceLine, PondDressing, Prop, Scatter, SpinningWindmill, ground, plainWrap, type Wrap } from "./common";

const g = FIELD_GEOMETRY["starter-meadow"];

/**
 * Starter Meadow: red barn in the middle, farmhouse and vegetable garden to
 * the right, the duck pond and shed to the left, a windmill on the rise
 * behind, cows in their paddock, forest and mountains all round.
 */
export function StarterMeadow({ quality, reducedMotion, growth, wrap = plainWrap }: { quality: QualitySettings; reducedMotion?: boolean; growth: number; wrap?: Wrap }) {
  const d = quality.detail;
  const stage = (Math.min(4, Math.max(1, Math.round(1 + growth * 3))) as 1 | 2 | 3 | 4);
  const plot = g.plots[0]!;
  const pond = g.water[0]!;
  const notFront = useMemo(() => (x: number, z: number) => !(z > 22 && Math.abs(x) < 16), []);
  return (
    <group name="starter-meadow">
      {/* Landmarks (learning destinations in FarmWorld) */}
      {wrap("barn", <Model id="barn" />, ground(g, 0, -9), 0)}
      {wrap("farmhouse", <Model id="house-1" />, ground(g, 17, -6), -0.5)}
      {wrap("lab", <Model id="house-2" scale={0.85} />, ground(g, -14, -11), 0.55)}
      {wrap("windmill", <SpinningWindmill speed={reducedMotion ? 0 : 0.5} />, ground(g, -5, -21), 0.35)}
      {wrap("market", <Model id="stall" />, ground(g, 13, 15), -0.6)}

      {/* Barnyard props */}
      <Prop g={g} id="hay-bale" x={5.2} z={-3.6} r={0.4} />
      <Prop g={g} id="hay-bale" x={6.4} z={-2.4} r={1.3} s={0.95} />
      <Prop g={g} id="hay-bundle" x={-5} z={-4} r={0.3} />
      <Prop g={g} id="barrel" x={-4.2} z={-2.6} />
      <Prop g={g} id="barrel-apples" x={-5.1} z={-2.1} r={1} />
      <Prop g={g} id="crate" x={4.6} z={-5.5} r={0.2} />
      <Prop g={g} id="cart" x={8.5} z={-12} r={-0.9} />
      <Prop g={g} id="well" x={-8} z={-1.5} r={0.4} />
      <Prop g={g} id="silo" x={6.5} z={-14} />
      <Prop g={g} id="crate-apple" x={12.2} z={14.4} r={-0.6} />
      <Prop g={g} id="crate-carrot" x={14.3} z={15.8} r={-0.4} />
      <Prop g={g} id="barrel-apples" x={11.4} z={16.6} />
      <Prop g={g} id="lantern" x={2.8} z={4.2} />
      <Prop g={g} id="lantern" x={-2.6} z={12} />
      <Prop g={g} id="k-bench" x={20.5} z={-1.5} r={-1.9} />
      <Prop g={g} id="signpost" x={-2.4} z={26} r={0.3} />

      {/* Vegetable garden */}
      <CropBed g={g} plot={{ ...plot, w: plot.w / 2 - 0.4, x: plot.x - plot.w / 4 - 0.2 }} crop="lettuce" stage={stage} spacing={1} fenced={false} />
      <CropBed g={g} plot={{ ...plot, w: plot.w / 2 - 0.4, x: plot.x + plot.w / 4 + 0.2 }} crop="carrot" stage={stage} spacing={0.8} fenced={false} />
      <FenceLine g={g} from={[plot.x - plot.w / 2 - 1, plot.z + plot.d / 2 + 1]} to={[plot.x + plot.w / 2 + 1, plot.z + plot.d / 2 + 1]} />
      <FenceLine g={g} from={[plot.x + plot.w / 2 + 1, plot.z + plot.d / 2 + 1]} to={[plot.x + plot.w / 2 + 1, plot.z - plot.d / 2 - 1]} />
      <FenceLine g={g} from={[plot.x - plot.w / 2 - 1, plot.z - plot.d / 2 - 1]} to={[plot.x + plot.w / 2 + 1, plot.z - plot.d / 2 - 1]} />
      <Model id={`crop-pumpkin-${stage}` as CropId} position={ground(g, 20.5, 6)} rotationY={0.5} />
      <Model id={`crop-pumpkin-${stage}` as CropId} position={ground(g, 21.3, 3.8)} rotationY={2} scale={0.9} />
      <Model id={`crop-tomato-${stage}` as CropId} position={ground(g, 21, 9)} />

      {/* Paddock with the herd behind the barn */}
      <FenceLine g={g} from={[8, -18]} to={[22, -18]} />
      <FenceLine g={g} from={[22, -18]} to={[22, -28]} />
      <FenceLine g={g} from={[8, -28]} to={[22, -28]} />
      <FenceLine g={g} from={[8, -18]} to={[8, -28]} />
      <Animal id="cow" g={g} home={{ x: 15, z: -23, r: 4 }} seed={3} reducedMotion={reducedMotion} />
      <Animal id="cow" g={g} home={{ x: 15, z: -23, r: 4 }} seed={8} reducedMotion={reducedMotion} />
      <Animal id="cow-brown" g={g} home={{ x: 15, z: -23, r: 4 }} seed={13} reducedMotion={reducedMotion} />
      <Animal id="cow" g={g} home={{ x: -10, z: 22, r: 5 }} seed={21} reducedMotion={reducedMotion} />
      <Animal id="sheep" g={g} home={{ x: -20, z: -4, r: 4 }} seed={5} reducedMotion={reducedMotion} />
      <Animal id="sheep" g={g} home={{ x: -20, z: -4, r: 4 }} seed={9} reducedMotion={reducedMotion} />
      <Animal id="horse" g={g} home={{ x: 24, z: 16, r: 4 }} seed={4} reducedMotion={reducedMotion} />
      <Animal id="dog" g={g} home={{ x: 4, z: 0, r: 5 }} seed={17} reducedMotion={reducedMotion} speed={1.6} />

      {/* Foreground fences framing the view */}
      <FenceLine g={g} from={[-22, 31]} to={[-4, 31]} />
      <FenceLine g={g} from={[7, 31]} to={[24, 31]} />

      {/* Pond */}
      <PondDressing g={g} ducks={<>
        <Duck center={[pond.x, ground(g, pond.x + pond.r * 1.4, pond.z)[1] - pond.depth * 0.38 + 0.05, pond.z]} radius={2.6} reducedMotion={reducedMotion} />
        <Duck center={[pond.x + 1, ground(g, pond.x + pond.r * 1.4, pond.z)[1] - pond.depth * 0.38 + 0.05, pond.z - 1]} radius={1.6} offset={2} reducedMotion={reducedMotion} />
      </>} />

      {/* Trees: framing trees near the farm, then forest, then the hills */}
      <Prop g={g} id="tree-2" x={-26} z={26} r={1} s={1.2} />
      <Prop g={g} id="tree-1" x={27} z={24} r={2} s={1.15} />
      <Prop g={g} id="tree-5" x={-24} z={-16} r={0.5} />
      <Prop g={g} id="tree-1" x={-9} z={-28} r={0.3} />
      <Prop g={g} id="tree-3" x={27} z={-10} r={1.3} />
      <Prop g={g} id="tree-4" x={-27} z={8} r={2.2} />
      <Scatter g={g} ids={["tree-1", "tree-2", "tree-3", "tree-5", "pine-2", "tree-4"]} seed={101} count={Math.round(70 * d)} rMin={33} rMax={62} clearance={3} scale={[0.85, 1.25]} mask={notFront} />
      <Scatter g={g} ids={["pine-1", "pine-3", "pine-4", "tree-3", "pine-5"]} seed={202} count={Math.round(140 * d)} rMin={60} rMax={115} clearance={3} scale={[1, 1.6]} />
      {/* Undergrowth */}
      <Scatter g={g} ids={["bush", "bush-flowers", "plant-big", "fern"]} seed={303} count={Math.round(70 * d)} rMin={8} rMax={36} clearance={1.4} scale={[0.7, 1.2]} />
      <Scatter g={g} ids={["flowers-a", "flowers-b", "flower-a", "flower-b", "clover"]} seed={404} count={Math.round(220 * d)} rMin={4} rMax={34} clearance={0.6} scale={[0.7, 1.3]} />
      <Scatter g={g} ids={["rock-1", "rock-3", "pebble-1", "pebble-2", "mushroom"]} seed={505} count={Math.round(50 * d)} rMin={6} rMax={45} clearance={1} scale={[0.6, 1.2]} sink={0.1} />
      <Scatter g={g} ids={["grass-tall", "grass-wispy", "grass-short"]} seed={606} count={Math.round(260 * d)} rMin={3} rMax={38} clearance={0.4} scale={[0.8, 1.5]} />
    </group>
  );
}
