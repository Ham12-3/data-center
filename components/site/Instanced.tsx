import { type ReactNode, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { unitBox } from "@/lib/three/geometries";

export interface InstanceSpec {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly rotationY?: number;
  readonly color?: string;
}

interface InstancedBoxesProps {
  items: readonly InstanceSpec[];
  material: THREE.Material;
  geometry?: THREE.BufferGeometry;
  cast?: boolean;
  receive?: boolean;
}

/**
 * Generic instanced renderer for many copies of one shape (fence posts, cars,
 * trees, floor tiles…). Optional per-instance colour tints a white material.
 */
export function InstancedBoxes({ items, material, geometry = unitBox, cast = true, receive = true }: InstancedBoxesProps): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const yAxis = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      q.setFromAxisAngle(yAxis, it.rotationY ?? 0);
      mesh.setMatrixAt(i, m.compose(p.set(...it.position), q, s.set(...it.scale)));
      if (it.color) mesh.setColorAt(i, c.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (items.length === 0) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={cast}
      receiveShadow={receive}
    />
  );
}
