import type { Vec3 } from "./parts";

/**
 * Map a rack-local point to world space for a rack standing at `position`
 * rotated by `rotationY` about Y: local +Z maps to (sin r, 0, cos r).
 */
export function rackLocalToWorld(position: Vec3, rotationY: number, local: Vec3): [number, number, number] {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return [position[0] + local[0] * c + local[2] * s, position[1] + local[1], position[2] - local[0] * s + local[2] * c];
}
