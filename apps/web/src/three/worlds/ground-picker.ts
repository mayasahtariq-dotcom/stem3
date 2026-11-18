/**
 * Screen point -> spot on the farm's ground, for UI outside the 3D canvas (dragging an item from the store onto
 * the farm). The scene registers `pick` while it is mounted; it returns null off the canvas or off the terrain.
 */
export const groundPicker: { pick: ((clientX: number, clientY: number) => { x: number; z: number } | null) | null } = { pick: null };
