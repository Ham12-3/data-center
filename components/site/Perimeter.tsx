import { type ReactNode, useMemo } from "react";
import { Block, Box, Cyl } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { FENCE, GATE, GUARD_HOUSE } from "@/data/site";
import { unitCylinder } from "@/lib/three/geometries";
import { PAL, glow, std } from "@/lib/three/materialCache";
import { type InstanceSpec, InstancedBoxes } from "./Instanced";

const FENCE_H = 2.4;
const POST_SPACING = 3;

/** Straight fence runs as [x0, z0, x1, z1], leaving the gate gap open. */
const RUNS: [number, number, number, number][] = [
  [FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0],
  [FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1],
  [FENCE.x0, FENCE.z1, GATE.x0, FENCE.z1],
  [GATE.x1, FENCE.z1, FENCE.x1, FENCE.z1],
  [FENCE.x0, FENCE.z0, FENCE.x0, FENCE.z1],
];

function useFence(): { posts: InstanceSpec[]; panels: InstanceSpec[]; wire: InstanceSpec[] } {
  return useMemo(() => {
    const posts: InstanceSpec[] = [];
    const panels: InstanceSpec[] = [];
    const wire: InstanceSpec[] = [];
    for (const [x0, z0, x1, z1] of RUNS) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / POST_SPACING));
      const rot = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        posts.push({ position: [x0 + (x1 - x0) * t, (FENCE_H + 0.5) / 2, z0 + (z1 - z0) * t], scale: [0.06, FENCE_H + 0.5, 0.06] });
      }
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      panels.push({ position: [cx, FENCE_H / 2, cz], scale: [len, FENCE_H, 0.02], rotationY: rot });
      // Three strands of barbed wire on top of the mesh.
      for (let k = 0; k < 3; k++) {
        wire.push({ position: [cx, FENCE_H + 0.12 + k * 0.14, cz], scale: [len, 0.012, 0.012], rotationY: rot });
      }
    }
    return { posts, panels, wire };
  }, []);
}

/** Security perimeter: anti-climb fence, gate with crash-rated barrier, guard house and CCTV masts. */
export function Perimeter(): ReactNode {
  const fence = useFence();
  const gateW = GATE.x1 - GATE.x0;
  const cctvMasts: [number, number][] = [
    [FENCE.x0 + 2, FENCE.z0 + 2],
    [FENCE.x1 - 2, FENCE.z0 + 2],
    [FENCE.x0 + 2, FENCE.z1 - 2],
    [FENCE.x1 - 2, FENCE.z1 - 2],
    [GATE.x1 + 3, FENCE.z1 - 3],
  ];

  return (
    <group>
      <Selectable id="perimeter-fence" type="security-fence" label="Perimeter fence">
        <InstancedBoxes items={fence.posts} material={std(PAL.darkSteel, { metalness: 0.6, roughness: 0.4 })} geometry={unitCylinder} />
        <InstancedBoxes
          items={fence.panels}
          material={std("#8a939c", { transparent: true, opacity: 0.32, doubleSide: true, metalness: 0.5 })}
          cast={false}
        />
        <InstancedBoxes items={fence.wire} material={std("#6b7178", { metalness: 0.6 })} cast={false} />
      </Selectable>

      {/* Gate: sliding steel gate (half open), wedge barrier and drop arm. */}
      <Selectable id="main-gate" type="security-fence" label="Main vehicle gate">
        {/* Sliding steel gate, rolled half open: frame plus vertical bars. */}
        <group position={[GATE.x1 + gateW * 0.2, 0, GATE.z + 0.6]}>
          {[0.15, 2.25].map((y) => (
            <Box key={y} size={[gateW * 0.5, 0.08, 0.08]} position={[0, y, 0]} material={std(PAL.darkSteel, { metalness: 1, roughness: 0.45 })} />
          ))}
          {Array.from({ length: Math.round(gateW * 0.5 / 0.15) }, (_, i) => (
            <Box key={i} size={[0.03, 2.1, 0.03]} position={[-gateW * 0.25 + 0.075 + i * 0.15, 1.2, 0]} material={std(PAL.darkSteel, { metalness: 1, roughness: 0.45 })} cast={false} />
          ))}
        </group>
        <Box size={[gateW - 1, 0.35, 1.2]} position={[(GATE.x0 + GATE.x1) / 2, 0.18, GATE.z - 4]} material={std(PAL.safetyYellow)} />
        <Box size={[gateW * 0.45, 0.1, 0.1]} position={[GATE.x0 + gateW * 0.25, 1.1, GATE.z - 1.2]} material={std("#d92d2d")} />
        <Block size={[0.4, 1.2, 0.4]} position={[GATE.x0 + 0.3, 0, GATE.z - 1.2]} material={std(PAL.safetyYellow)} />
        {Array.from({ length: 6 }, (_, i) => (
          <Cyl
            key={i}
            radius={0.12}
            height={1}
            position={[GATE.x0 - 4 + (i % 3) * 1.4 + (i < 3 ? 0 : gateW + 5.2), 0.5, GATE.z - 0.8]}
            material={std(PAL.safetyYellow)}
          />
        ))}
      </Selectable>

      <Selectable id="guard-house" type="guard-house" label="Guard house">
        <group position={[GUARD_HOUSE.x, 0, GUARD_HOUSE.z]}>
          <Block size={[5, 0.25, 4]} material={std(PAL.concrete)} />
          <Block size={[4.4, 2.9, 3.4]} position={[0, 0.25, 0]} material={std(PAL.cladding)} />
          <Box size={[4.46, 1.1, 3.46]} position={[0, 2.1, 0]} material={std(PAL.glass, { transparent: true, opacity: 0.6, metalness: 0.3, roughness: 0.1 })} cast={false} />
          <Block size={[5.2, 0.3, 4.2]} position={[0, 3.15, 0]} material={std(PAL.claddingDark)} />
          <Box size={[1.6, 0.06, 0.6]} position={[0, 3.3, 0]} material={glow("#ff3b30", 0.8)} cast={false} />
        </group>
      </Selectable>

      {cctvMasts.map(([x, z], i) => (
        <Selectable key={i} id={`cctv-mast-${i}`} type="cctv" label={`Perimeter CCTV mast ${i + 1}`}>
          <Cyl radius={0.08} height={6} position={[x, 3, z]} material={std(PAL.steel, { metalness: 0.6 })} />
          <Box size={[0.25, 0.22, 0.5]} position={[x, 6, z + 0.2]} material={std("#f2f2f2")} />
          <Box size={[0.25, 0.22, 0.5]} position={[x + 0.3, 5.8, z - 0.1]} rotation={[0, 1.2, 0]} material={std("#f2f2f2")} />
        </Selectable>
      ))}
    </group>
  );
}
