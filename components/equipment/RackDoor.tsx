import { useFrame } from "@react-three/fiber";
import { type ReactNode, useRef } from "react";
import * as THREE from "three";
import type { RackFace } from "@/types/equipment";
import { unitBox, unitPlane } from "@/lib/three/geometries";
import { getPerforatedDoorMaterial, rackMaterials } from "@/lib/three/materials";
import { RACK_BASE_HEIGHT, RACK_DEPTH, RACK_HEIGHT, RACK_WIDTH, mm } from "@/lib/units";

const DOOR_W = RACK_WIDTH - mm(4);
const DOOR_H = RACK_HEIGHT - RACK_BASE_HEIGHT - mm(30);
const DOOR_T = mm(12);
const STILE = mm(30);
const RAIL = mm(40);

/**
 * Doors swing outwards by ~100°. Rotating about +Y by a negative angle moves
 * the front door's free edge towards +Z and the rear door's towards -Z (the
 * rear door extends in -X from its hinge), so both open away from the rack.
 */
const OPEN_ANGLE = THREE.MathUtils.degToRad(-100);

interface RackDoorProps {
  face: RackFace;
  open: boolean;
}

/** Hinged perforated door. The front door hinges on the left, the rear on the right. */
export function RackDoor({ face, open }: RackDoorProps): ReactNode {
  const group = useRef<THREE.Group>(null);
  const angle = useRef(open ? OPEN_ANGLE : 0);

  const front = face === "front";
  const hingeX = front ? -RACK_WIDTH / 2 : RACK_WIDTH / 2;
  const z = (front ? 1 : -1) * (RACK_DEPTH / 2 - DOOR_T / 2);
  // Direction the door panel extends from its hinge, in X.
  const ext = front ? 1 : -1;
  const outward = front ? 1 : -1;

  useFrame((_, delta) => {
    if (!group.current) return;
    // Frame-rate independent exponential ease towards the target angle.
    angle.current = THREE.MathUtils.damp(angle.current, open ? OPEN_ANGLE : 0, 5, delta);
    group.current.rotation.y = angle.current;
  });

  const perforated = getPerforatedDoorMaterial(DOOR_W - 2 * STILE, DOOR_H - 2 * RAIL);

  return (
    <group ref={group} position={[hingeX, RACK_BASE_HEIGHT + DOOR_H / 2, z]}>
      <mesh
        geometry={unitPlane}
        material={perforated}
        position={[(ext * DOOR_W) / 2, 0, 0]}
        scale={[DOOR_W - 2 * STILE, DOOR_H - 2 * RAIL, 1]}
      />
      {[STILE / 2, DOOR_W - STILE / 2].map((x) => (
        <mesh
          key={`stile-${x}`}
          geometry={unitBox}
          material={rackMaterials.frame}
          position={[ext * x, 0, 0]}
          scale={[STILE, DOOR_H, DOOR_T]}
          castShadow
        />
      ))}
      {[-1, 1].map((sy) => (
        <mesh
          key={`rail-${sy}`}
          geometry={unitBox}
          material={rackMaterials.frame}
          position={[(ext * DOOR_W) / 2, sy * (DOOR_H / 2 - RAIL / 2), 0]}
          scale={[DOOR_W - 2 * STILE, RAIL, DOOR_T]}
          castShadow
        />
      ))}
      <mesh
        geometry={unitBox}
        material={rackMaterials.handle}
        position={[ext * (DOOR_W - STILE / 2), mm(80), outward * (DOOR_T / 2 + mm(10))]}
        scale={[mm(14), mm(160), mm(20)]}
      />
    </group>
  );
}
