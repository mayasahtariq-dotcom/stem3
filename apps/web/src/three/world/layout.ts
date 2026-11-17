import { terrainHeight } from "./terrain-math";

/**
 * Where everything stands on the farm (pure data, unit-tested). Learning
 * destinations sit around the farmstead; lesson markers line the winding
 * dirt path that starts at the barn door and heads south.
 */
export const PLACES = {
  barn: { x: -2, z: -6, rotationY: 0 },
  farmhouse: { x: 15, z: -17, rotationY: -0.72 },
  lab: { x: -12, z: -1, rotationY: 0.9 },
  signboard: { x: 3.4, z: 3.2, rotationY: -0.3 },
  market: { x: 13, z: 10, rotationY: -2.2 },
  // Golu stands in the foreground on the path, looking up at the barn.
  golu: { x: 8, z: 11.5, rotationY: -2.6 },
  windmill: { x: -11, z: -9, rotationY: 0.5 },
} as const;

export const PASTURE = { x: 2, z: -16, width: 12, depth: 6 } as const;

/** The dirt path's centre line (matches groundKind's "path" band). */
export const pathX = (z: number) => Math.sin(z * 0.12) * 2.5;

/** Lesson marker positions: evenly spaced along the path, alternating sides. */
export function stationPositions(n: number, from = 6, spacing = 2.6): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const z = from + i * spacing;
    const side = i % 2 === 0 ? 1 : -1;
    const x = pathX(z) + side * 2.1;
    return [x, terrainHeight(x, z), z];
  });
}

/** Flower beds along the path; one blooms for each finished lesson. */
export function flowerSpots(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const z = 5 + i * 1.3;
    const side = i % 2 === 0 ? -1 : 1;
    return [pathX(z) + side * (3.4 + (i % 3) * 0.35), z];
  });
}

/** Spots for bought decorations, by item id. */
export const DECORATION_SPOTS: Record<string, [number, number]> = {
  "deco-sunflowers": [13.5, 1],
  "deco-beehive": [-8, 8],
  "deco-scarecrow": [11, -2],
};
