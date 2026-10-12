import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PowerFeed } from "@/types/equipment";
import {
  PDU_BOTTOM,
  PDU_CENTER_Z,
  PDU_DEPTH,
  PDU_HEIGHT,
  PDU_TOP,
  PDU_WIDTH,
  PDU_X,
  pduOutlets,
} from "@/lib/rack/pdu";
import { unitBox } from "@/lib/three/geometries";
import { pduMaterials } from "@/lib/three/materials";
import { mm } from "@/lib/units";

/** Zero-U vertical PDU with inward-facing C13/C19 outlets and a feed-colour stripe. */
export function RackPDU({ feed }: { feed: PowerFeed }): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  const outlets = useMemo(() => pduOutlets(feed), [feed]);
  const x = PDU_X[feed];
  const inward = feed === "A" ? 1 : -1;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    outlets.forEach((o, i) => {
      // Outlet body sits half its protrusion behind the outlet face.
      p.set(o.pos[0] - inward * mm(3), o.pos[1], o.pos[2]);
      s.set(mm(6), o.type === "C19" ? mm(32) : mm(24), o.type === "C19" ? mm(26) : mm(20));
      mesh.setMatrixAt(i, matrix.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [outlets, inward]);

  const stripe = feed === "A" ? pduMaterials.feedA : pduMaterials.feedB;
  const rearFaceZ = PDU_CENTER_Z - PDU_DEPTH / 2;

  return (
    <group>
      <mesh
        geometry={unitBox}
        material={pduMaterials.body}
        position={[x, PDU_BOTTOM + PDU_HEIGHT / 2, PDU_CENTER_Z]}
        scale={[PDU_WIDTH, PDU_HEIGHT, PDU_DEPTH]}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={ref} args={[unitBox, pduMaterials.outlet, outlets.length]} />
      {/* Feed identification stripe along the rear face. */}
      <mesh
        geometry={unitBox}
        material={stripe}
        position={[x, PDU_BOTTOM + PDU_HEIGHT / 2, rearFaceZ - mm(1)]}
        scale={[mm(10), PDU_HEIGHT - mm(40), mm(2)]}
      />
      {/* Current meter display. */}
      <mesh
        geometry={unitBox}
        material={pduMaterials.display}
        position={[x + inward * mm(8), PDU_TOP - mm(70), rearFaceZ - mm(1.5)]}
        scale={[mm(26), mm(16), mm(2)]}
      />
    </group>
  );
}
