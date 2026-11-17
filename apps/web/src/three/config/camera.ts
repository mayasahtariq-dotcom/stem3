/**
 * Camera: a low three-quarter view over Golu's shoulder towards the barn, with
 * the sky, hills and rainbow on the horizon; orbit limits
 * keep the player from going under the ground or losing the farm.
 */
export const CAMERA = {
  fov: 45,
  near: 0.5,
  far: 400,
  position: [22, 11, 27] as [number, number, number],
  target: [0, 5, -4] as [number, number, number],
} as const;

export const ORBIT_LIMITS = {
  minDistance: 18,
  maxDistance: 110,
  minPolarAngle: Math.PI * 0.18, // not straight down
  maxPolarAngle: Math.PI * 0.46, // never level with or below the horizon
  enablePan: false,
  dampingFactor: 0.08,
  rotateSpeed: 0.6,
  zoomSpeed: 0.8,
} as const;
