import { type ReactNode, useMemo } from "react";
import * as THREE from "three";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { Crah } from "@/components/equipment/Cooling";
import { CeilingFireSystems } from "@/components/equipment/FireSafety";
import { OverheadRuns, type TrayRun } from "@/components/equipment/Overhead";
import { RackField } from "@/components/equipment/RackField";
import { type InstanceSpec, InstancedBoxes } from "@/components/site/Instanced";
import { HALL_A, HALL_A_RACKS, hallAPodX, hallARowZ0, hallARowZ1 } from "@/data/halls";
import { roomById } from "@/data/site";
import { unitCylinder } from "@/lib/three/geometries";
import { PAL, glow, std } from "@/lib/three/materialCache";
import { perforatedTileTexture, solidTileTexture } from "@/lib/three/textures";
import { RACK_DEPTH, RACK_HEIGHT } from "@/lib/units";
import { useStore } from "@/store/useStore";

const room = roomById("hallA").rect;
const FY = HALL_A.floorY;
const TILE = 0.6;

/** X ranges of every cold aisle (between the two rows of a pod). */
const COLD_AISLES: [number, number][] = Array.from({ length: HALL_A.pods }, (_, p) => {
  const x = hallAPodX(p) + RACK_DEPTH;
  return [x, x + HALL_A.aisle];
});

/** X centres of the hot aisles (between pods and at both ends). */
const HOT_AISLE_X: number[] = Array.from({ length: HALL_A.pods + 1 }, (_, p) => hallAPodX(p) - HALL_A.aisle / 2);

/**
 * Raised floor: 600 mm tiles on pedestals, with perforated tiles in the cold
 * aisles. The plenum underneath is pressurised by the CRAHs, so cold air rises
 * exactly where the server intakes are. Toggling "Floor tiles" lifts them all.
 */
function RaisedFloor(): ReactNode {
  const showTiles = useStore((s) => s.layers.floorTiles);
  const { solid, perforated, pedestals } = useMemo(() => {
    const solid: InstanceSpec[] = [];
    const perforated: InstanceSpec[] = [];
    const pedestals: InstanceSpec[] = [];
    const cols = Math.floor((room.x1 - room.x0) / TILE);
    const rows = Math.floor((room.z1 - room.z0) / TILE);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = room.x0 + (i + 0.5) * TILE;
        const z = room.z0 + (j + 0.5) * TILE;
        const inAisle = COLD_AISLES.some(([a, b]) => x > a && x < b) && z > hallARowZ0 && z < hallARowZ1;
        (inAisle ? perforated : solid).push({ position: [x, FY - 0.015, z], scale: [TILE - 0.004, 0.03, TILE - 0.004] });
        pedestals.push({ position: [room.x0 + i * TILE, (FY - 0.03) / 2, room.z0 + j * TILE], scale: [0.018, FY - 0.03, 0.018] });
      }
    }
    return { solid, perforated, pedestals };
  }, []);

  const materials = useMemo(
    () => ({
      solid: new THREE.MeshStandardMaterial({ map: solidTileTexture(), roughness: 0.55 }),
      perforated: new THREE.MeshStandardMaterial({ map: perforatedTileTexture(), roughness: 0.5, metalness: 0.3 }),
    }),
    [],
  );

  return (
    <Selectable id="hallA-raised-floor" type="raised-floor" label="Raised floor and plenum">
      {showTiles && <InstancedBoxes items={solid} material={materials.solid} cast={false} />}
      {showTiles && <InstancedBoxes items={perforated} material={materials.perforated} cast={false} />}
      <InstancedBoxes items={pedestals} material={std("#9aa1a8", { metalness: 0.7 })} geometry={unitCylinder} cast={false} />
      {/* Perimeter edge so the raised floor reads as a platform from the corridor. */}
      <Box size={[room.x1 - room.x0, FY, 0.04]} position={[(room.x0 + room.x1) / 2, FY / 2, room.z1 - 0.02]} material={std("#6d747c")} cast={false} />
    </Selectable>
  );
}

/** Cold-aisle containment: a glazed roof over each cold aisle and sliding doors at both ends. */
function Containment(): ReactNode {
  const glass = std("#bfe3ff", { transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, doubleSide: true });
  const frame = std("#aab2bb", { metalness: 0.7, roughness: 0.35 });
  const top = FY + RACK_HEIGHT + 0.03;
  const len = hallARowZ1 - hallARowZ0;
  return (
    <group>
      {COLD_AISLES.map(([x0, x1], p) => {
        const cx = (x0 + x1) / 2;
        const w = x1 - x0;
        return (
          <Selectable key={p} id={`hallA-cac-${p + 1}`} type="cold-aisle-containment" label={`Cold aisle containment, pod ${p + 1}`}>
            <Box size={[w, 0.02, len]} position={[cx, top, (hallARowZ0 + hallARowZ1) / 2]} material={glass} cast={false} />
            {[x0, x1].map((x) => (
              <Box key={x} size={[0.04, 0.05, len]} position={[x, top, (hallARowZ0 + hallARowZ1) / 2]} material={frame} cast={false} />
            ))}
            {[hallARowZ0, hallARowZ1].map((z) => (
              <group key={z}>
                <Box size={[w, RACK_HEIGHT, 0.02]} position={[cx, FY + RACK_HEIGHT / 2, z]} material={glass} cast={false} />
                <Box size={[w, 0.05, 0.05]} position={[cx, top, z]} material={frame} cast={false} />
                <Box size={[0.04, RACK_HEIGHT, 0.05]} position={[cx, FY + RACK_HEIGHT / 2, z]} material={frame} cast={false} />
                <Box size={[0.03, 0.25, 0.04]} position={[cx - 0.08, FY + 1.05, z + (z < -11 ? -0.03 : 0.03)]} material={std(PAL.steel, { metalness: 0.8 })} cast={false} />
              </group>
            ))}
          </Selectable>
        );
      })}
    </group>
  );
}

function useOverheadRuns(): { trays: TrayRun[]; busway: TrayRun[] } {
  return useMemo(() => {
    const trays: TrayRun[] = [];
    const busway: TrayRun[] = [];
    const z0 = hallARowZ0 - 0.3;
    const z1 = hallARowZ1 + 0.3;
    for (let p = 0; p < HALL_A.pods; p++) {
      const base = hallAPodX(p);
      const rowCenters = [base + RACK_DEPTH / 2, base + RACK_DEPTH + HALL_A.aisle + RACK_DEPTH / 2];
      for (const rx of rowCenters) {
        busway.push({ kind: "buswayA", from: [rx - 0.2, FY + 2.6, z0], to: [rx - 0.2, FY + 2.6, z1] });
        busway.push({ kind: "buswayB", from: [rx + 0.2, FY + 2.6, z0], to: [rx + 0.2, FY + 2.6, z1] });
        trays.push({ kind: "copper", from: [rx, FY + 2.95, z0], to: [rx, FY + 2.95, z1] });
      }
      const ax = base + RACK_DEPTH + HALL_A.aisle / 2;
      trays.push({ kind: "fiber", from: [ax, FY + 3.25, z0], to: [ax, FY + 3.25, z1 + 1.2] });
    }
    // Fibre backbone along the south end of the rows to the network core.
    trays.push({ kind: "fiber", from: [hallAPodX(0), FY + 3.25, hallARowZ1 + 1.5], to: [room.x1 + 0.3, FY + 3.25, hallARowZ1 + 1.5] });
    // Busway feeders from the floor PDUs along the east side.
    busway.push({ kind: "buswayA", from: [hallAPodX(0) - 0.2, FY + 2.6, z1], to: [room.x1 - 1.5, FY + 2.6, z1] });
    busway.push({ kind: "buswayB", from: [hallAPodX(0) - 0.2, FY + 2.6, z0], to: [room.x1 - 1.5, FY + 2.6, z0] });
    return { trays, busway };
  }, []);
}

/** Chilled-water mains under the raised floor, with a branch to every CRAH. */
function useUnderfloorPipes(): { supply: V3[][]; ret: V3[][] } {
  return useMemo(() => {
    const supply: V3[][] = [];
    const ret: V3[][] = [];
    for (const [wallZ, dir] of [
      [room.z0 + 1.6, -1],
      [room.z1 - 1.6, 1],
    ] as const) {
      supply.push([[room.x1 - 0.5, 0.18, wallZ], [room.x0 + 1, 0.18, wallZ]]);
      ret.push([[room.x1 - 0.5, 0.4, wallZ - dir * 0.35], [room.x0 + 1, 0.4, wallZ - dir * 0.35]]);
      for (const x of HOT_AISLE_X) {
        supply.push([[x - 0.3, 0.18, wallZ], [x - 0.3, 0.18, wallZ + dir * 0.6], [x - 0.3, 0.5, wallZ + dir * 0.6]]);
        ret.push([[x + 0.3, 0.4, wallZ - dir * 0.35], [x + 0.3, 0.4, wallZ + dir * 0.6], [x + 0.3, 0.55, wallZ + dir * 0.6]]);
      }
    }
    // Risers from the corridor mains (cooling plant) into the hall.
    supply.push([[room.x1 - 0.5, 0.18, room.z0 + 1.6], [room.x1 - 0.5, 0.18, room.z1 - 1.6], [room.x1 - 0.5, 0.18, 5.4]]);
    ret.push([[room.x1 - 0.9, 0.4, room.z0 + 1.95], [room.x1 - 0.9, 0.4, room.z1 - 1.95], [room.x1 - 0.9, 0.4, 6.2]]);
    return { supply, ret };
  }, []);
}

/** Floor-standing power distribution units feeding the busway (A and B sides). */
function FloorPdus(): ReactNode {
  const units: { id: string; z: number; feed: "A" | "B" }[] = [
    { id: "PDU-A1", z: -22.5, feed: "A" },
    { id: "PDU-B1", z: -20.8, feed: "B" },
    { id: "PDU-A2", z: -1.5, feed: "A" },
    { id: "PDU-B2", z: 0.2, feed: "B" },
  ];
  return (
    <group>
      {units.map((u) => (
        <Selectable key={u.id} id={u.id} type="rpp" label={`Power distribution unit ${u.id} (feed ${u.feed})`} position={[room.x1 - 0.75, FY, u.z]} rotation={[0, -Math.PI / 2, 0]}>
          <Block size={[1.4, 2.0, 0.9]} material={std(PAL.cabinetGrey, { roughness: 0.45, metalness: 0.15 })} />
          <Box size={[0.25, 0.15, 0.01]} position={[-0.35, 1.5, 0.456]} material={glow("#67e8f9", 0.9)} cast={false} />
          <Box size={[1.3, 0.05, 0.01]} position={[0, 1.85, 0.456]} material={std(u.feed === "A" ? "#3b82f6" : "#f97316")} cast={false} />
          <Box size={[0.9, 0.9, 0.01]} position={[0.15, 0.8, 0.456]} material={std("#b9bec5", { metalness: 0.3 })} cast={false} />
        </Selectable>
      ))}
    </group>
  );
}

/**
 * Data Hall A: ~200 air-cooled racks (~8 kW each, ~1.6 MW IT) in five pods
 * with contained cold aisles, fed by downflow CRAHs through a 600 mm raised floor.
 */
export function DataHallA(): ReactNode {
  const showPipes = useStore((s) => s.layers.pipes);
  const overhead = useOverheadRuns();
  const pipes = useUnderfloorPipes();
  return (
    <group>
      <RaisedFloor />
      <RackField placements={HALL_A_RACKS} maxDetailed={8} radius={6} />
      <Containment />
      {HOT_AISLE_X.map((x, i) => (
        <Crah key={`n${i}`} id={`CRAH-A${i + 1}`} position={[x, FY, room.z0 + 0.1 + 1.07 / 2]} floorY={FY} />
      ))}
      {HOT_AISLE_X.map((x, i) => (
        <Crah key={`s${i}`} id={`CRAH-A${i + 7}`} position={[x, FY, room.z1 - 0.1 - 1.07 / 2]} rotationY={Math.PI} floorY={FY} />
      ))}
      <FloorPdus />
      <Selectable id="hallA-trays" type="cable-tray" label="Overhead cable trays (fibre and copper)">
        <OverheadRuns runs={overhead.trays} />
      </Selectable>
      <Selectable id="hallA-busway" type="busway" label="Overhead busway (A and B feeds)">
        <OverheadRuns runs={overhead.busway} />
      </Selectable>
      {showPipes && (
        <Selectable id="hallA-chw" type="chilled-water-pipe" label="Under-floor chilled water (blue supply, red return)">
          <PipeRuns runs={pipes.supply} radius={0.08} material={std(PAL.chwSupply, { roughness: 0.4 })} />
          <PipeRuns runs={pipes.ret} radius={0.08} material={std(PAL.chwReturn, { roughness: 0.4 })} />
        </Selectable>
      )}
      <CeilingFireSystems id="hallA" rect={room} />
    </group>
  );
}
