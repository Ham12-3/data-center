import type { ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CableKind, CableRoute } from "@/lib/rack/cabling";
import { cableMaterials } from "@/lib/three/materials";
import { mm } from "@/lib/units";

const CABLE_RADIUS: Record<CableKind, number> = {
  powerA: mm(3.5), // C13-C14 cord, ~7 mm OD
  powerB: mm(3.5),
  copper: mm(2.8), // 25G DAC / Cat6A
  fiber: mm(1.4), // duplex LC jumper
};

const KINDS: readonly CableKind[] = ["powerA", "powerB", "copper", "fiber"];

/**
 * All of a rack's cables, merged into one geometry per cable kind. Each route
 * becomes a tube along a centripetal Catmull-Rom curve (centripetal avoids the
 * overshoot loops a uniform spline makes when control points are unevenly spaced).
 */
type MergedCables = { kind: CableKind; geometry: THREE.BufferGeometry | null }[];

/** Cached per route list: racks sharing a model share their cable geometry. */
const cache = new WeakMap<readonly CableRoute[], MergedCables>();

function mergedCables(routes: readonly CableRoute[]): MergedCables {
  let merged = cache.get(routes);
  if (!merged) {
    merged = KINDS.map((kind) => {
      const tubes = routes
        .filter((r) => r.kind === kind)
        .map((r) => {
          const curve = new THREE.CatmullRomCurve3(
            r.points.map((p) => new THREE.Vector3(...p)),
            false,
            "centripetal",
          );
          // ~6 cm per segment and 4 sides: cables are millimetres thick, so this
          // looks the same at viewing distance with a quarter of the triangles.
          const segments = Math.max(6, Math.ceil(curve.getLength() / 0.06));
          return new THREE.TubeGeometry(curve, segments, CABLE_RADIUS[kind], 4, false);
        });
      const geometry = tubes.length > 0 ? mergeGeometries(tubes) : null;
      tubes.forEach((t) => t.dispose());
      return { kind, geometry };
    });
    cache.set(routes, merged);
  }
  return merged;
}

export function RackCabling({ routes }: { routes: readonly CableRoute[] }): ReactNode {
  const merged = mergedCables(routes);

  return (
    <group>
      {merged.map(({ kind, geometry }) =>
        geometry ? <mesh key={kind} geometry={geometry} material={cableMaterials[kind]} castShadow /> : null,
      )}
    </group>
  );
}
