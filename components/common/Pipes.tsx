import { type ReactNode, useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
/** A pipe vertex; readonly so shared, immutable route data can be passed in directly. */
type P3 = readonly [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Build one merged geometry for a set of polyline pipe runs. Each straight
 * segment is a cylinder rotated from +Y onto the segment direction; a sphere
 * at every interior vertex stands in for the elbow fitting. Merging everything
 * of one colour into a single geometry keeps a whole pipe network to one draw call.
 */
export function buildPipeGeometry(runs: readonly (readonly P3[])[], radius: number): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();

  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      a.set(...run[i]);
      b.set(...run[i + 1]);
      dir.subVectors(b, a);
      const len = dir.length();
      if (len < 1e-4) continue;
      q.setFromUnitVectors(UP, dir.normalize());
      const g = new THREE.CylinderGeometry(radius, radius, 1, 12, 1, true);
      m.compose(a.clone().add(b).multiplyScalar(0.5), q, s.set(1, len, 1));
      g.applyMatrix4(m);
      parts.push(g);
    }
    for (let i = 1; i < run.length - 1; i++) {
      const g = new THREE.SphereGeometry(radius * 1.12, 12, 8);
      g.translate(...run[i]);
      parts.push(g);
    }
  }
  if (parts.length === 0) return null;
  // Cylinders and spheres must share the same attribute set to merge.
  for (const p of parts) p.deleteAttribute("uv");
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  return merged;
}

interface PipeRunsProps {
  runs: readonly (readonly P3[])[];
  radius: number;
  material: THREE.Material;
  /**
   * Set when many instances render the same (module-level) runs array, such as
   * the hoses of every GPU rack: the geometry is built once and kept.
   */
  shared?: boolean;
}

const sharedCache = new WeakMap<readonly (readonly P3[])[], Map<number, THREE.BufferGeometry | null>>();

function sharedGeometry(runs: readonly (readonly P3[])[], radius: number): THREE.BufferGeometry | null {
  let byRadius = sharedCache.get(runs);
  if (!byRadius) sharedCache.set(runs, (byRadius = new Map()));
  if (!byRadius.has(radius)) byRadius.set(radius, buildPipeGeometry(runs, radius));
  return byRadius.get(radius) ?? null;
}

/** A set of pipe runs rendered as one mesh. */
export function PipeRuns({ runs, radius, material, shared = false }: PipeRunsProps): ReactNode {
  const geometry = useMemo(() => (shared ? sharedGeometry(runs, radius) : buildPipeGeometry(runs, radius)), [runs, radius, shared]);
  useEffect(() => () => {
    if (!shared) geometry?.dispose();
  }, [geometry, shared]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}
