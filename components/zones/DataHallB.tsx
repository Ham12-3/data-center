import { type ReactNode, useMemo } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Box, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { CDU_STUBS, Cdu, FAN_WALL_DIMS, FanWall, FanWallFans } from "@/components/equipment/Cooling";
import { CeilingFireSystems } from "@/components/equipment/FireSafety";
import { OverheadRuns, type TrayRun } from "@/components/equipment/Overhead";
import { RackField } from "@/components/equipment/RackField";
import { HALL_B, HALL_B_LAYOUT, hallBPodX, hallBRowZ0, hallBRowZ1 } from "@/data/halls";
import { roomById } from "@/data/site";
import { GPU_RACK } from "@/lib/rack/gpuRack";
import { rackLocalToWorld } from "@/lib/rack/transform";
import { PAL, std } from "@/lib/three/materialCache";
import { useStore } from "@/store/useStore";

const room = roomById("hallB").rect;
const { racks: RACKS, cdus: CDUS } = HALL_B_LAYOUT;
/** Ceiling height where the roof risers enter the hall. */
const BUILDING_TOP = 7;

/** Rack-local tops of the coolant manifolds (see gpuRackCoolant). */
const MANIFOLD_TOP_SUPPLY: V3 = [-0.255, GPU_RACK.height + 0.25, GPU_RACK.frontZ - GPU_RACK.trayDepth - 0.15];
const MANIFOLD_TOP_RETURN: V3 = [0.255, GPU_RACK.height + 0.25, GPU_RACK.frontZ - GPU_RACK.trayDepth - 0.15];

const FAN_WALLS = Array.from({ length: 7 }, (_, i) => ({
  id: `FW-B${i + 1}`,
  position: [10.5 + i * 4.4, 0, room.z0 + FAN_WALL_DIMS[2] / 2 + 0.05] as V3,
  rotationY: 0,
}));

/** Rows as lists of racks/CDUs sharing a row id, e.g. "B03". */
function rows(): { id: string; racks: typeof RACKS; cdus: typeof CDUS }[] {
  const ids = [...new Set(RACKS.map((r) => r.id.slice(0, 3)))];
  return ids.map((id) => ({
    id,
    racks: RACKS.filter((r) => r.id.startsWith(id)),
    cdus: CDUS.filter((c) => c.id.startsWith(`CDU-${id}`)),
  }));
}

/**
 * Liquid-cooling pipework:
 * - TCS (technology cooling system): CDU → overhead supply/return headers
 *   along each row's hot aisle → a drop to every rack's manifolds.
 * - FWS (facility water system): roof dry coolers → riser → headers north and
 *   south of the rows → each CDU's heat exchanger.
 */
function useCoolantPipes(): { tcsS: V3[][]; tcsR: V3[][]; fwsS: V3[][]; fwsR: V3[][] } {
  return useMemo(() => {
    const tcsS: V3[][] = [];
    const tcsR: V3[][] = [];
    const fwsS: V3[][] = [];
    const fwsR: V3[][] = [];
    const hyS = 2.78;
    const hyR = 2.98;
    for (const row of rows()) {
      const r0 = row.racks[0];
      // Header line sits 0.62 m behind the racks, inside the hot aisle.
      const hx = rackLocalToWorld(r0.position, r0.rotationY, [0, 0, -0.62])[0];
      const zs = row.cdus.map((c) => c.position[2]);
      tcsS.push([[hx, hyS, Math.min(...zs)], [hx, hyS, Math.max(...zs)]]);
      tcsR.push([[hx + 0.12, hyR, Math.min(...zs)], [hx + 0.12, hyR, Math.max(...zs)]]);
      for (const r of row.racks) {
        const s = rackLocalToWorld(r.position, r.rotationY, MANIFOLD_TOP_SUPPLY);
        const t = rackLocalToWorld(r.position, r.rotationY, MANIFOLD_TOP_RETURN);
        tcsS.push([s, [s[0], hyS, s[2]], [hx, hyS, s[2]]]);
        tcsR.push([t, [t[0], hyR, t[2]], [hx + 0.12, hyR, t[2]]]);
      }
      for (const c of row.cdus) {
        const s = rackLocalToWorld(c.position, c.rotationY, CDU_STUBS.tcsSupply);
        const t = rackLocalToWorld(c.position, c.rotationY, CDU_STUBS.tcsReturn);
        tcsS.push([s, [s[0], hyS, s[2]], [hx, hyS, s[2]]]);
        tcsR.push([t, [t[0], hyR, t[2]], [hx + 0.12, hyR, t[2]]]);
        // Facility water drops from the north or south header.
        const north = c.position[2] < HALL_B.rowCenterZ;
        const hz = north ? hallBRowZ0 - 1.4 : hallBRowZ1 + 1.4;
        const fs = rackLocalToWorld(c.position, c.rotationY, CDU_STUBS.fwsSupply);
        const fr = rackLocalToWorld(c.position, c.rotationY, CDU_STUBS.fwsReturn);
        fwsS.push([fs, [fs[0], 3.55, fs[2]], [fs[0], 3.55, hz]]);
        fwsR.push([fr, [fr[0], 3.85, fr[2]], [fr[0], 3.85, hz - 0.35]]);
      }
    }
    // Headers and the riser from the roof dry coolers in the north-east corner.
    for (const [hz, list, y, off] of [
      [hallBRowZ0 - 1.4, fwsS, 3.55, 0],
      [hallBRowZ1 + 1.4, fwsS, 3.55, 0],
      [hallBRowZ0 - 1.75, fwsR, 3.85, 0.4],
      [hallBRowZ1 + 1.05, fwsR, 3.85, 0.4],
    ] as const) {
      list.push([[12.5, y, hz], [40.5 + off, y, hz]]);
    }
    fwsS.push([[40.5, BUILDING_TOP, -21.7], [40.5, 3.55, -21.7], [40.5, 3.55, hallBRowZ1 + 1.4]]);
    fwsR.push([[40.9, BUILDING_TOP, -22.2], [40.9, 3.85, -22.2], [40.9, 3.85, hallBRowZ1 + 1.05]]);
    return { tcsS, tcsR, fwsS, fwsR };
  }, []);
}

function useOverhead(): { trays: TrayRun[]; busway: TrayRun[] } {
  return useMemo(() => {
    const trays: TrayRun[] = [];
    const busway: TrayRun[] = [];
    const z0 = hallBRowZ0 - 0.2;
    const z1 = hallBRowZ1 + 0.2;
    for (const row of rows()) {
      const r0 = row.racks[0];
      // Busway A and B above the rear of the row: power shelves take their AC input at the back.
      const a = rackLocalToWorld(r0.position, r0.rotationY, [0, 0, -0.1])[0];
      const b = rackLocalToWorld(r0.position, r0.rotationY, [0, 0, -0.38])[0];
      busway.push({ kind: "buswayA", from: [a, 2.62, z0], to: [a, 2.62, z1] });
      busway.push({ kind: "buswayB", from: [b, 2.62, z0], to: [b, 2.62, z1] });
    }
    // Fibre raceways over each cold aisle, plus a backbone west to the network core.
    const coldX = [hallBPodX(0) - HALL_B.coldAisle / 2];
    for (let p = 0; p < HALL_B.pods; p++) coldX.push(hallBPodX(p) + 2 * HALL_B.rowDepth + HALL_B.hotAisle + HALL_B.coldAisle / 2);
    for (const x of coldX) trays.push({ kind: "fiber", from: [x, 3.3, z0], to: [x, 3.3, z1 + 1] });
    trays.push({ kind: "fiber", from: [room.x0 - 0.3, 3.3, hallBRowZ1 + 0.8], to: [coldX[coldX.length - 1], 3.3, hallBRowZ1 + 0.8] });
    return { trays, busway };
  }, []);
}

/** Hot-aisle containment: roof and doors enclose the aisle between each pod's two rows. */
function HotAisleContainment(): ReactNode {
  const panel = std("#cfd6de", { transparent: true, opacity: 0.35, roughness: 0.3, metalness: 0.2, doubleSide: true });
  const frame = std("#2a2f35", { metalness: 0.6, roughness: 0.4 });
  const top = GPU_RACK.height + 0.04;
  const len = hallBRowZ1 - hallBRowZ0;
  return (
    <group>
      {Array.from({ length: HALL_B.pods }, (_, p) => {
        const x0 = hallBPodX(p) + HALL_B.rowDepth;
        const x1 = x0 + HALL_B.hotAisle;
        const cx = (x0 + x1) / 2;
        return (
          <Selectable key={p} id={`hallB-hac-${p + 1}`} type="cold-aisle-containment" label={`Hot aisle containment, pod ${p + 1}`}>
            <Box size={[x1 - x0, 0.03, len]} position={[cx, top, (hallBRowZ0 + hallBRowZ1) / 2]} material={panel} cast={false} />
            {[hallBRowZ0, hallBRowZ1].map((z) => (
              <group key={z}>
                <Box size={[x1 - x0, top, 0.03]} position={[cx, top / 2, z]} material={panel} cast={false} />
                <Box size={[x1 - x0, 0.06, 0.06]} position={[cx, top, z]} material={frame} cast={false} />
                <Box size={[0.05, top, 0.06]} position={[cx, top / 2, z]} material={frame} cast={false} />
              </group>
            ))}
          </Selectable>
        );
      })}
    </group>
  );
}

/**
 * Data Hall B: 60 liquid-cooled NVL72 racks (~130 kW each, ~7.9 MW IT) in
 * three hot-aisle-contained pods, with N+1 in-row CDUs per row and fan walls
 * for the ~15% of heat that is still removed by air.
 */
export function DataHallB(): ReactNode {
  const showPipes = useStore((s) => s.layers.pipes);
  const pipes = useCoolantPipes();
  const overhead = useOverhead();
  return (
    <group>
      <RackField placements={RACKS} maxDetailed={6} radius={6} />
      {CDUS.map((c) => (
        <Cdu key={c.id} id={c.id} position={[...c.position]} rotationY={c.rotationY} />
      ))}
      <HotAisleContainment />
      {FAN_WALLS.map((w) => (
        <FanWall key={w.id} id={w.id} position={w.position} rotationY={w.rotationY} />
      ))}
      <FanWallFans walls={FAN_WALLS} />
      {showPipes && (
        <>
          <Selectable id="hallB-tcs" type="cdu" label="Rack coolant loop (TCS): CDU to rack manifolds">
            <PipeRuns runs={pipes.tcsS} radius={0.045} material={std(PAL.chwSupply, { roughness: 0.4 })} />
            <PipeRuns runs={pipes.tcsR} radius={0.045} material={std(PAL.chwReturn, { roughness: 0.4 })} />
          </Selectable>
          <Selectable id="hallB-fws" type="chilled-water-pipe" label="Facility water (FWS): dry coolers to CDUs">
            <PipeRuns runs={pipes.fwsS} radius={0.1} material={std(PAL.chwSupply, { roughness: 0.4 })} />
            <PipeRuns runs={pipes.fwsR} radius={0.1} material={std(PAL.chwReturn, { roughness: 0.4 })} />
          </Selectable>
        </>
      )}
      <Selectable id="hallB-trays" type="cable-tray" label="Overhead fibre raceways">
        <OverheadRuns runs={overhead.trays} />
      </Selectable>
      <Selectable id="hallB-busway" type="busway" label="Overhead busway (A and B feeds)">
        <OverheadRuns runs={overhead.busway} tapSpacing={GPU_RACK.width} />
      </Selectable>
      <CeilingFireSystems id="hallB" rect={room} />
    </group>
  );
}
