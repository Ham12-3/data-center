import { type ReactNode, useMemo } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, Cyl, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { type InstanceSpec, InstancedBoxes } from "@/components/site/Instanced";
import { BUILDING, type Rect } from "@/data/site";
import { unitCylinder } from "@/lib/three/geometries";
import { PAL, glow, std } from "@/lib/three/materialCache";

const red = std(PAL.fireRed, { roughness: 0.5 });

/**
 * Ceiling-level fire protection for one room:
 * - VESDA aspirating smoke detection: small red sampling pipes that
 *   continuously draw air back to a laser detector (alert at ~0.005% obs/m).
 * - Pre-action sprinkler mains and branches with heads. The pipes stay dry
 *   until detection *and* a fused head both occur (double interlock).
 */
export function CeilingFireSystems({ id, rect }: { id: string; rect: Rect }): ReactNode {
  const ceiling = BUILDING.partitionHeight;
  const built = useMemo(() => {
    const vesda: V3[][] = [];
    const sprinklerMains: V3[][] = [];
    const heads: InstanceSpec[] = [];
    const detectors: InstanceSpec[] = [];
    const yV = ceiling - 0.25;
    const yS = ceiling - 0.45;
    // VESDA pipes every ~6 m along X, joined by a header on the west side.
    const vz: number[] = [];
    for (let z = rect.z0 + 2; z < rect.z1 - 1; z += 6) vz.push(z);
    for (const z of vz) vesda.push([[rect.x0 + 0.6, yV, z], [rect.x1 - 0.6, yV, z]]);
    if (vz.length > 1) vesda.push([[rect.x0 + 0.6, yV, vz[0]], [rect.x0 + 0.6, yV, vz[vz.length - 1]]]);
    // Sprinkler branches every ~3.6 m, heads every ~3 m (light hazard spacing).
    const sx: number[] = [];
    for (let x = rect.x0 + 1.8; x < rect.x1 - 1; x += 3.6) sx.push(x);
    for (const x of sx) {
      sprinklerMains.push([[x, yS, rect.z0 + 0.8], [x, yS, rect.z1 - 0.8]]);
      for (let z = rect.z0 + 1.5; z < rect.z1 - 1; z += 3) heads.push({ position: [x, yS - 0.09, z], scale: [0.03, 0.12, 0.03] });
    }
    if (sx.length > 1) sprinklerMains.push([[sx[0], yS, rect.z0 + 0.8], [sx[sx.length - 1], yS, rect.z0 + 0.8]]);
    for (let x = rect.x0 + 3; x < rect.x1 - 2; x += 7) {
      for (let z = rect.z0 + 3; z < rect.z1 - 2; z += 7) detectors.push({ position: [x, ceiling - 0.03, z], scale: [0.07, 0.04, 0.07] });
    }
    return { vesda, sprinklerMains, heads, detectors };
  }, [rect, ceiling]);

  return (
    <group>
      <Selectable id={`${id}-vesda`} type="vesda" label="VESDA aspirating smoke detection">
        <PipeRuns runs={built.vesda} radius={0.013} material={red} />
        <InstancedBoxes items={built.detectors} material={std("#f2f2f0")} geometry={unitCylinder} cast={false} />
        {/* VESDA detector unit on the wall at the end of the header. */}
        <Block size={[0.35, 0.25, 0.12]} position={[rect.x0 + 0.3, 1.6, rect.z0 + 2]} material={std("#e8e8e6")} />
        <Box size={[0.2, 0.04, 0.01]} position={[rect.x0 + 0.37, 1.8, rect.z0 + 2]} rotation={[0, Math.PI / 2, 0]} material={glow("#3dff6e", 1.2)} cast={false} />
      </Selectable>
      <Selectable id={`${id}-sprinkler`} type="sprinkler" label="Pre-action sprinkler system">
        <PipeRuns runs={built.sprinklerMains} radius={0.035} material={red} />
        <InstancedBoxes items={built.heads} material={std("#b9a13a", { metalness: 0.8, roughness: 0.3 })} geometry={unitCylinder} cast={false} />
      </Selectable>
    </group>
  );
}

/**
 * Bank of clean-agent cylinders with a discharge manifold. Halocarbon agents
 * (FK-5-1-12 / FM-200) reach design concentration in ≤10 s; inert gas
 * (IG-541) uses larger 200-300 bar cylinders over ~60 s.
 */
export function AgentCylinderBank({ id, position, count, label }: { id: string; position: V3; count: number; label: string }): ReactNode {
  const pitch = 0.42;
  return (
    <Selectable id={id} type="gas-suppression" label={label} position={position}>
      {/* Wall-mounted rack rail and manifold. */}
      <Box size={[count * pitch + 0.3, 0.06, 0.06]} position={[(count - 1) * pitch * 0.5, 1.2, -0.28]} material={std(PAL.darkSteel, { metalness: 0.6 })} />
      <Cyl radius={0.05} height={count * pitch + 0.2} position={[(count - 1) * pitch * 0.5, 1.95, -0.05]} rotation={[0, 0, Math.PI / 2]} material={red} />
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[i * pitch, 0, 0]}>
          <Cyl radius={0.17} height={1.5} position={[0, 0.8, 0]} material={red} />
          <Cyl radius={0.12} height={0.12} position={[0, 1.6, 0]} material={red} />
          <Cyl radius={0.05} height={0.16} position={[0, 1.74, 0]} material={std("#b9bfc5", { metalness: 0.8 })} />
          <Cyl radius={0.015} height={0.2} position={[0, 1.88, -0.03]} material={std("#b9bfc5", { metalness: 0.8 })} />
          <Box size={[0.2, 0.08, 0.01]} position={[0, 1.1, 0.17]} material={std("#f2f2f0")} cast={false} />
        </group>
      ))}
    </Selectable>
  );
}
