import { type ReactNode, useEffect, useMemo } from "react";
import * as THREE from "three";
import { unitPlane } from "@/lib/three/geometries";
import { FLOOR_TILE, floorTileTexture } from "@/lib/three/textures";

interface FloorProps {
  width: number;
  depth: number;
}

/** Tiled floor; one texture repeat = one 600 mm tile. */
export function Floor({ width, depth }: FloorProps): ReactNode {
  const material = useMemo(() => {
    // Clone so this floor can have its own repeat; the image is still shared.
    const map = floorTileTexture().clone();
    map.repeat.set(width / FLOOR_TILE, depth / FLOOR_TILE);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0.05 });
  }, [width, depth]);

  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );

  return (
    <mesh
      geometry={unitPlane}
      material={material}
      rotation-x={-Math.PI / 2}
      scale={[width, depth, 1]}
      receiveShadow
    />
  );
}
