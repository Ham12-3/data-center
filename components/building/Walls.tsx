import type { ReactNode } from "react";
import { unitPlane } from "@/lib/three/geometries";
import { roomMaterials } from "@/lib/three/materials";

interface WallsProps {
  width: number;
  depth: number;
  height: number;
}

/**
 * Room shell built from single-sided planes facing inwards. From outside the
 * room their back faces are culled, so the orbit camera sees straight in
 * (a "dollhouse" view) while a camera inside sees solid walls.
 *
 * A PlaneGeometry faces +Z; rotating it by θ about Y points its normal at
 * (sin θ, 0, cos θ), which gives the rotations used below.
 */
export function Walls({ width, depth, height }: WallsProps): ReactNode {
  const y = height / 2;
  const walls: { key: string; position: [number, number, number]; rotationY: number; span: number }[] = [
    { key: "north", position: [0, y, -depth / 2], rotationY: 0, span: width },
    { key: "south", position: [0, y, depth / 2], rotationY: Math.PI, span: width },
    { key: "west", position: [-width / 2, y, 0], rotationY: Math.PI / 2, span: depth },
    { key: "east", position: [width / 2, y, 0], rotationY: -Math.PI / 2, span: depth },
  ];

  return (
    <group>
      {walls.map((w) => (
        <mesh
          key={w.key}
          geometry={unitPlane}
          material={roomMaterials.wall}
          position={w.position}
          rotation-y={w.rotationY}
          scale={[w.span, height, 1]}
          receiveShadow
        />
      ))}
    </group>
  );
}
