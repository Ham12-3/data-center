import type { ReactNode } from "react";
import type * as THREE from "three";
import { roundedBox, unitBox, unitCylinder } from "@/lib/three/geometries";

export type V3 = [number, number, number];

interface BaseProps {
  position?: V3;
  rotation?: V3;
  material: THREE.Material;
  cast?: boolean;
  receive?: boolean;
  /** Appearance changes at runtime (e.g. a status light): never merged by StaticBatch. */
  dynamic?: boolean;
}

interface BoxProps extends BaseProps {
  size: V3;
  /** Edge bevel radius in metres; omit for a sharp (cheaper) box. */
  bevel?: number;
}

/** Axis-aligned box. `position` is the box centre. */
export function Box({ size, position = [0, 0, 0], rotation, material, cast = true, receive = true, bevel, dynamic }: BoxProps): ReactNode {
  return (
    <mesh
      userData={dynamic ? { dynamic: true } : undefined}
      geometry={bevel ? roundedBox(size[0], size[1], size[2], bevel) : unitBox}
      material={material}
      position={position}
      rotation={rotation}
      scale={bevel ? 1 : size}
      castShadow={cast}
      receiveShadow={receive}
    />
  );
}

/** Box positioned by its bottom face, which is handier for things that sit on a floor. */
export function Block({ size, position = [0, 0, 0], ...rest }: BoxProps): ReactNode {
  return <Box size={size} position={[position[0], position[1] + size[1] / 2, position[2]]} {...rest} />;
}

/** Cylinder along Y (rotate to orient). `position` is the centre. */
export function Cyl({
  radius,
  height,
  position = [0, 0, 0],
  rotation,
  material,
  cast = true,
  receive = true,
  dynamic,
}: BaseProps & { radius: number; height: number }): ReactNode {
  return (
    <mesh
      userData={dynamic ? { dynamic: true } : undefined}
      geometry={unitCylinder}
      material={material}
      position={position}
      rotation={rotation}
      scale={[radius, height, radius]}
      castShadow={cast}
      receiveShadow={receive}
    />
  );
}
