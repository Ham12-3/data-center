import { useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Layer used for the original (pre-merge) meshes: not rendered by the camera,
 * but still raycast, so clicking, hovering and outlining keep working.
 */
export const PICK_LAYER = 1;

/** How often (s) to check whether the batched subtree changed (mounts / unmounts). */
const CHECK_INTERVAL = 0.5;

interface Merged {
  meshes: THREE.Mesh[];
  hidden: THREE.Object3D[];
  signature: string;
}

const isBatchable = (o: THREE.Object3D): o is THREE.Mesh =>
  o instanceof THREE.Mesh &&
  !(o instanceof THREE.InstancedMesh) &&
  !Array.isArray(o.material) &&
  o.userData.dynamic !== true &&
  o.userData.batched !== true;

/** Walk the tree, skipping subtrees that opt out (userData.noBatch) and the batch's own output. */
function collect(root: THREE.Object3D, out: THREE.Mesh[]): void {
  for (const child of root.children) {
    if (child.userData.noBatch || child.userData.batched) continue;
    if (isBatchable(child) && child.visible) out.push(child);
    collect(child, out);
  }
}

/** Cheap fingerprint of the batchable meshes, to detect children mounting / unmounting. */
function signatureOf(meshes: THREE.Mesh[]): string {
  let h = meshes.length;
  for (const m of meshes) h = (h * 31 + m.id) | 0;
  return String(h);
}

/**
 * Merges every static mesh in its subtree into one mesh per material (and
 * shadow / index / attribute layout), which turns hundreds of draw calls for
 * equipment built from primitives into a handful.
 *
 * The originals stay in the scene on PICK_LAYER: the camera no longer draws
 * them, but raycasting still hits them, so selection, hover labels and the
 * selection outline work as before. Meshes marked `userData.dynamic` (e.g.
 * status lights that change colour), instanced meshes, points and subtrees
 * marked `userData.noBatch` are left untouched. The batch rebuilds itself
 * when children mount or unmount.
 */
export function StaticBatch({ children }: { children: ReactNode }): ReactNode {
  const rootRef = useRef<THREE.Group>(null);
  const outRef = useRef<THREE.Group>(null);
  const merged = useRef<Merged | null>(null);
  const since = useRef(CHECK_INTERVAL);

  const clear = () => {
    const m = merged.current;
    if (!m) return;
    for (const mesh of m.meshes) {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    }
    for (const o of m.hidden) o.layers.enable(0);
    merged.current = null;
  };

  const build = () => {
    const root = rootRef.current;
    const out = outRef.current;
    if (!root || !out) return;
    const meshes: THREE.Mesh[] = [];
    collect(root, meshes);
    const signature = signatureOf(meshes);
    if (merged.current?.signature === signature) return;
    clear();

    root.updateWorldMatrix(true, true);
    const toLocal = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[] }>();
    const hidden: THREE.Object3D[] = [];

    for (const mesh of meshes) {
      const geo = mesh.geometry;
      if (!geo.getAttribute("position") || !geo.getAttribute("normal")) continue;
      const material = mesh.material as THREE.Material;
      // Only position + normal (+ uv when the material samples a texture) are kept, so geometries merge cleanly.
      const needsUv = "map" in material && (material as THREE.MeshStandardMaterial).map !== null;
      if (needsUv && !geo.getAttribute("uv")) continue;
      const g = new THREE.BufferGeometry();
      const src = geo.index ? geo.toNonIndexed() : geo;
      g.setAttribute("position", src.getAttribute("position").clone());
      g.setAttribute("normal", src.getAttribute("normal").clone());
      if (needsUv) g.setAttribute("uv", src.getAttribute("uv").clone());
      if (src !== geo) src.dispose();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
      const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${needsUv}`;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] }));
      group.geos.push(g);
      // Originals move to the pick-only layer: raycast, but not drawn.
      mesh.layers.disable(0);
      mesh.layers.enable(PICK_LAYER);
      hidden.push(mesh);
    }

    const outMeshes: THREE.Mesh[] = [];
    for (const group of groups.values()) {
      const geometry = mergeGeometries(group.geos);
      group.geos.forEach((g) => g.dispose());
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, group.material);
      mesh.castShadow = group.cast;
      mesh.receiveShadow = group.receive;
      mesh.userData.batched = true;
      mesh.raycast = () => undefined; // picking uses the originals
      out.add(mesh);
      outMeshes.push(mesh);
    }
    merged.current = { meshes: outMeshes, hidden, signature };
  };

  // Rebuild when the subtree changes; first build happens on the next frame
  // so children have run their layout effects.
  useFrame((_, dt) => {
    since.current += dt;
    if (since.current < CHECK_INTERVAL) return;
    since.current = 0;
    build();
  });

  useEffect(() => () => clear(), []);

  return (
    // noBatch: an enclosing StaticBatch leaves this one (and its output) alone.
    <group userData={{ noBatch: true }}>
      <group ref={rootRef}>{children}</group>
      <group ref={outRef} />
    </group>
  );
}
