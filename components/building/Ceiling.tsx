import type { ReactNode } from "react";
import { unitPlane } from "@/lib/three/geometries";
import { roomMaterials } from "@/lib/three/materials";

interface CeilingProps {
  width: number;
  depth: number;
  height: number;
}

const FIXTURE_SPACING_X = 2.4;
const FIXTURE_SPACING_Z = 1.8;

/**
 * Downward-facing ceiling and linear LED light fixtures. Like the walls, these
 * are single-sided, so they disappear when the orbit camera looks from above.
 * Rotating a +Z plane by +90° about X points it straight down.
 */
export function Ceiling({ width, depth, height }: CeilingProps): ReactNode {
  const fixtures: [number, number][] = [];
  for (let x = -width / 2 + FIXTURE_SPACING_X / 2; x < width / 2; x += FIXTURE_SPACING_X) {
    for (let z = -depth / 2 + FIXTURE_SPACING_Z / 2; z < depth / 2; z += FIXTURE_SPACING_Z) {
      fixtures.push([x, z]);
    }
  }

  return (
    <group>
      <mesh
        geometry={unitPlane}
        material={roomMaterials.ceiling}
        position={[0, height, 0]}
        rotation-x={Math.PI / 2}
        scale={[width, depth, 1]}
      />
      {fixtures.map(([x, z]) => (
        <mesh
          key={`${x}-${z}`}
          geometry={unitPlane}
          material={roomMaterials.fixture}
          position={[x, height - 0.01, z]}
          rotation-x={Math.PI / 2}
          scale={[1.2, 0.1, 1]}
        />
      ))}
    </group>
  );
}
