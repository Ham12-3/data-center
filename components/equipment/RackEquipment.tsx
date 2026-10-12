import type { ThreeEvent } from "@react-three/fiber";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BoxPart, PartMaterialKey } from "@/lib/rack/parts";
import { unitBox } from "@/lib/three/geometries";
import { partMaterials } from "@/lib/three/materials";

const MATERIAL_KEYS: readonly PartMaterialKey[] = ["metal", "plastic", "port"];
const CLICK_TOLERANCE = 5;

interface PartBatchProps {
  mat: PartMaterialKey;
  parts: readonly BoxPart[];
  onPick?: (owner: number, kind: "click" | "hover" | "out") => void;
  /** Owners (devices) not drawn here, e.g. a tray pulled out for service. */
  hidden?: number | null;
}

function PartBatch({ mat, parts, onPick, hidden = null }: PartBatchProps): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    parts.forEach((part, i) => {
      // Each instance is the shared unit cube scaled to the part's size.
      if (part.owner === hidden) scale.set(0, 0, 0);
      else scale.set(...part.size);
      matrix.compose(position.set(...part.pos), rotation, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(part.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Bounds must cover all instances for frustum culling and raycasting.
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [parts, hidden]);

  const owner = (e: ThreeEvent<PointerEvent | MouseEvent>): number | null =>
    e.instanceId === undefined ? null : (parts[e.instanceId]?.owner ?? null);

  return (
    <instancedMesh
      key={parts.length}
      ref={ref}
      args={[unitBox, partMaterials[mat], parts.length]}
      castShadow={mat === "metal"}
      receiveShadow
      onClick={(e) => {
        const o = owner(e);
        if (o === null || !onPick || e.delta > CLICK_TOLERANCE) return;
        e.stopPropagation();
        onPick(o, "click");
      }}
      onPointerMove={(e) => {
        const o = owner(e);
        if (o === null || !onPick) return;
        e.stopPropagation();
        onPick(o, "hover");
      }}
      onPointerOut={() => onPick?.(-1, "out")}
    />
  );
}

/**
 * Draws all rack-mounted devices with one InstancedMesh per material bucket.
 * `onPick` reports which device (owner index) was clicked or hovered.
 */
export function RackEquipment({
  boxes,
  onPick,
  hidden = null,
}: {
  boxes: readonly BoxPart[];
  onPick?: PartBatchProps["onPick"];
  hidden?: number | null;
}): ReactNode {
  const buckets = useMemo(
    () => MATERIAL_KEYS.map((mat) => ({ mat, parts: boxes.filter((b) => b.mat === mat) })),
    [boxes],
  );
  return (
    <group>
      {buckets.map(({ mat, parts }) => (parts.length > 0 ? <PartBatch key={mat} mat={mat} parts={parts} onPick={onPick} hidden={hidden} /> : null))}
    </group>
  );
}
