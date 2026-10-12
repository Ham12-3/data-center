import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Shared unit geometries. Meshes scale these instead of allocating a new
 * geometry per object, so the GPU holds one copy of each shape.
 */
export const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** 1 x 1 plane facing +Z. */
export const unitPlane = new THREE.PlaneGeometry(1, 1);

/** Unit cylinder along Y (radius 1, height 1). */
export const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 16);

const roundedCache = new Map<string, THREE.BufferGeometry>();

/**
 * Bevelled box of an exact size (not scaled afterwards, so the bevel radius
 * stays true). Real objects never have razor-sharp edges; a 1-5 cm bevel
 * catches a highlight from the environment and makes boxes read as
 * manufactured objects. Cached per size.
 */
export function roundedBox(w: number, h: number, d: number, radius: number): THREE.BufferGeometry {
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  let g = roundedCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, r);
    roundedCache.set(key, g);
  }
  return g;
}
