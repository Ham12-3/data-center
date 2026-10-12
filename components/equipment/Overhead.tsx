import { type ReactNode, useMemo } from "react";
import type { V3 } from "@/components/common/Primitives";
import { type InstanceSpec, InstancedBoxes } from "@/components/site/Instanced";
import { BUILDING } from "@/data/site";
import { unitCylinder } from "@/lib/three/geometries";
import { PAL, std } from "@/lib/three/materialCache";
import { useStore } from "@/store/useStore";

export type TrayKind = "fiber" | "copper" | "buswayA" | "buswayB";

/** A straight overhead run along X or Z between two points at a fixed height. */
export interface TrayRun {
  readonly kind: TrayKind;
  readonly from: V3;
  readonly to: V3;
}

const SECTION: Record<TrayKind, [number, number]> = {
  fiber: [0.3, 0.1], // yellow fibre raceway (e.g. FiberRunner)
  copper: [0.3, 0.08], // wire-basket tray for copper
  buswayA: [0.14, 0.11], // track busway with tap-off units
  buswayB: [0.14, 0.11],
};

const MATERIALS: Record<TrayKind, ReturnType<typeof std>> = {
  fiber: std(PAL.fiberYellow, { roughness: 0.45 }),
  copper: std(PAL.wireBasket, { metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.85 }),
  buswayA: std(PAL.busway, { metalness: 0.7, roughness: 0.3 }),
  buswayB: std(PAL.busway, { metalness: 0.7, roughness: 0.3 }),
};

/**
 * Overhead cable trays and busway, instanced by kind, with threaded-rod
 * hangers to the ceiling every ~2.4 m and tap-off boxes along the busway.
 */
export function OverheadRuns({ runs, tapSpacing = 0.6 }: { runs: readonly TrayRun[]; tapSpacing?: number }): ReactNode {
  const showCables = useStore((s) => s.layers.cables);
  const built = useMemo(() => {
    const byKind: Record<TrayKind, InstanceSpec[]> = { fiber: [], copper: [], buswayA: [], buswayB: [] };
    const hangers: InstanceSpec[] = [];
    const taps: InstanceSpec[] = [];
    const ceiling = BUILDING.partitionHeight;
    for (const r of runs) {
      const [w, h] = SECTION[r.kind];
      const dx = r.to[0] - r.from[0];
      const dz = r.to[2] - r.from[2];
      const len = Math.hypot(dx, dz);
      const alongX = Math.abs(dx) > Math.abs(dz);
      const cx = (r.from[0] + r.to[0]) / 2;
      const cz = (r.from[2] + r.to[2]) / 2;
      const y = r.from[1];
      byKind[r.kind].push({ position: [cx, y, cz], scale: alongX ? [len, h, w] : [w, h, len] });
      const n = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = r.from[0] + dx * t;
        const z = r.from[2] + dz * t;
        for (const s of [-1, 1]) {
          const ox = alongX ? 0 : (s * w) / 2;
          const oz = alongX ? (s * w) / 2 : 0;
          hangers.push({ position: [x + ox, (y + ceiling) / 2, z + oz], scale: [0.008, ceiling - y, 0.008] });
        }
      }
      if (r.kind === "buswayA" || r.kind === "buswayB") {
        const m = Math.floor(len / tapSpacing);
        for (let i = 0; i < m; i++) {
          const t = (i + 0.5) / m;
          taps.push({ position: [r.from[0] + dx * t, y - h / 2 - 0.09, r.from[2] + dz * t], scale: [0.16, 0.18, 0.16] });
        }
      }
    }
    return { byKind, hangers, taps };
  }, [runs, tapSpacing]);

  return (
    <group>
      {showCables && <InstancedBoxes items={built.byKind.fiber} material={MATERIALS.fiber} cast={false} />}
      {showCables && <InstancedBoxes items={built.byKind.copper} material={MATERIALS.copper} cast={false} />}
      <InstancedBoxes items={built.byKind.buswayA} material={MATERIALS.buswayA} cast={false} />
      <InstancedBoxes items={built.byKind.buswayB} material={MATERIALS.buswayB} cast={false} />
      <InstancedBoxes items={built.taps} material={std("#3b4552", { metalness: 0.3 })} cast={false} />
      <InstancedBoxes items={built.hangers} material={std("#7a828c", { metalness: 0.8 })} geometry={unitCylinder} cast={false} />
    </group>
  );
}
