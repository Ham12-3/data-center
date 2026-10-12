import { type ReactNode, useMemo } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, Cyl, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { type FanSpec, SpinningFans } from "@/components/common/SpinningFans";
import { BUILDING } from "@/data/site";
import { PAL, std } from "@/lib/three/materialCache";

const Y = BUILDING.roofY;

const DC_L = 10.5;
const DC_W = 2.4;
const DC_H = 2.6;
const DC_FANS_PER_ROW = 5;
const DC_FAN_R = 0.5;

/** Dry-cooler grid on each hall roof: 3 columns x 3 rows of units. */
const DRY_COOLERS: { id: string; x: number; z: number; hall: "A" | "B" }[] = (["A", "B"] as const).flatMap((hall) =>
  [-20, -12, -4].flatMap((z, r) =>
    (hall === "A" ? [-35.5, -24.5, -13.5] : [13.5, 24.5, 35.5]).map((x, c) => ({
      id: `DC-${hall}${r * 3 + c + 1}`,
      x,
      z,
      hall,
    })),
  ),
);

const COOLING_TOWERS: { id: string; x: number; z: number }[] = [
  { id: "CT-1", x: -36.5, z: 12.5 },
  { id: "CT-2", x: -27.5, z: 12.5 },
  { id: "CT-3", x: -36.5, z: 21 },
  { id: "CT-4", x: -27.5, z: 21 },
];
const CT_SIZE = 6;
const CT_H = 4.2;

/**
 * V-shape dry cooler: two finned coil banks lean together under a fan deck.
 * Fans pull outside air across the coils to cool the water inside, with no
 * compressor. In warm weather, adiabatic pads pre-cool the air with a light
 * water mist.
 */
function DryCooler({ id, x, z, hall }: { id: string; x: number; z: number; hall: "A" | "B" }): ReactNode {
  const coil = std("#6f8a86", { roughness: 0.6, metalness: 0.3 });
  const frame = std(PAL.cabinetGrey, { metalness: 0.3, roughness: 0.5 });
  const label = hall === "A" ? `Free-cooling dry cooler ${id}` : `Liquid-loop dry cooler ${id}`;
  return (
    <Selectable id={id} type="dry-cooler" label={label} position={[x, Y, z]}>
      {/* Steel dunnage legs and frame. */}
      {[-DC_L / 2 + 0.3, 0, DC_L / 2 - 0.3].map((lx) =>
        [-1, 1].map((s) => <Block key={`${lx}${s}`} size={[0.15, 0.6, 0.15]} position={[lx, 0, s * (DC_W / 2 - 0.1)]} material={frame} />),
      )}
      <Box size={[DC_L, 0.12, DC_W]} position={[0, 0.66, 0]} material={frame} />
      {/* V coils. */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[DC_L - 0.3, 1.9, 0.12]} position={[0, 1.65, s * 0.72]} rotation={[s * 0.33, 0, 0]} material={coil} />
      ))}
      {/* End panels and fan deck. */}
      {[-1, 1].map((s) => (
        <Box key={`end${s}`} size={[0.06, DC_H - 0.7, DC_W]} position={[s * (DC_L / 2 - 0.03), 1.65, 0]} material={frame} />
      ))}
      <Box size={[DC_L, 0.1, DC_W]} position={[0, DC_H + 0.05, 0]} material={frame} />
      {Array.from({ length: DC_FANS_PER_ROW * 2 }, (_, i) => {
        const fx = -DC_L / 2 + 1.05 + (i % DC_FANS_PER_ROW) * 2.1;
        const fz = i < DC_FANS_PER_ROW ? -0.6 : 0.6;
        return <Cyl key={i} radius={DC_FAN_R + 0.05} height={0.25} position={[fx, DC_H + 0.22, fz]} material={std("#3a3f45", { metalness: 0.4 })} />;
      })}
    </Selectable>
  );
}

/** Induced-draft cooling tower cell: louvred casing, fill, fan stack on top. */
function CoolingTower({ id, x, z }: { id: string; x: number; z: number }): ReactNode {
  const casing = std("#c9ced3", { roughness: 0.55, detail: { scale: 0.8, colorVar: 0.06, roughVar: 0.2, grime: 0.12, grimeHeight: 1.2 } });
  const louvre = std("#7c868f", { roughness: 0.7 });
  return (
    <Selectable id={id} type="cooling-tower" label={`Cooling tower ${id}`} position={[x, Y, z]}>
      <Block size={[CT_SIZE, 0.6, CT_SIZE]} material={std("#8f969d", { metalness: 0.4 })} />
      <Block size={[CT_SIZE - 0.2, CT_H, CT_SIZE - 0.2]} position={[0, 0.6, 0]} material={casing} bevel={0.06} />
      {/* Air-inlet louvres on two faces. */}
      {Array.from({ length: 6 }, (_, i) =>
        [-1, 1].map((s) => (
          <Box key={`${i}${s}`} size={[0.08, 0.18, CT_SIZE - 0.6]} position={[s * (CT_SIZE / 2 - 0.05), 1 + i * 0.4, 0]} rotation={[0, 0, s * 0.5]} material={louvre} />
        )),
      )}
      <Box size={[CT_SIZE - 0.2, 0.15, CT_SIZE - 0.2]} position={[0, 0.6 + CT_H + 0.07, 0]} material={std("#9aa2aa", { metalness: 0.3 })} />
      <Cyl radius={2.1} height={1.4} position={[0, 0.6 + CT_H + 0.85, 0]} material={casing} />
      {/* Handrail around the fan deck. */}
      <Box size={[CT_SIZE, 0.05, 0.05]} position={[0, 0.6 + CT_H + 1.1, CT_SIZE / 2 - 0.1]} material={std(PAL.safetyYellow)} />
      <Box size={[CT_SIZE, 0.05, 0.05]} position={[0, 0.6 + CT_H + 1.1, -CT_SIZE / 2 + 0.1]} material={std(PAL.safetyYellow)} />
    </Selectable>
  );
}

/** Rooftop plant over the building. Hidden in cutaway view along with the roof. */
export function Rooftop(): ReactNode {
  const fans = useMemo<FanSpec[]>(() => {
    const list: FanSpec[] = [];
    for (const d of DRY_COOLERS) {
      for (let i = 0; i < DC_FANS_PER_ROW * 2; i++) {
        list.push({
          position: [d.x - DC_L / 2 + 1.05 + (i % DC_FANS_PER_ROW) * 2.1, Y + DC_H + 0.33, d.z + (i < DC_FANS_PER_ROW ? -0.6 : 0.6)],
          radius: DC_FAN_R,
          speed: 9,
          blades: 5,
        });
      }
    }
    for (const t of COOLING_TOWERS) {
      list.push({ position: [t.x, Y + 0.6 + CT_H + 1.2, t.z], radius: 1.95, speed: 3.5, blades: 6 });
    }
    return list;
  }, []);

  const pipes = useMemo(() => {
    const py = Y + 0.45;
    const supply: V3[][] = [];
    const ret: V3[][] = [];
    const condenser: V3[][] = [];
    // Each hall's dry coolers share a supply and a return header that drops
    // through a roof riser: hall A's into the cooling plant, hall B's into its CDU gallery.
    for (const hall of ["A", "B"] as const) {
      const sign = hall === "A" ? -1 : 1;
      const riserX = sign * 40.5;
      for (const [k, list] of [[0, supply], [1, ret]] as const) {
        const off = k === 0 ? -1.7 : -2.2;
        const run: V3[] = [];
        for (const z of [-20, -12, -4]) run.push([sign * 8.5, py, z + off], [riserX, py, z + off]);
        list.push([[riserX, py, -20 + off], [riserX, py, -4 + off]]);
        list.push([[riserX, py, -20 + off], [riserX, 0.8, -20 + off]]);
        for (let i = 0; i < run.length; i += 2) list.push([run[i], run[i + 1]]);
      }
    }
    // Condenser water: each tower drops straight down into the plant below.
    for (const t of COOLING_TOWERS) {
      condenser.push([[t.x + 3.4, Y + 1.2, t.z - 1], [t.x + 4.2, Y + 1.2, t.z - 1], [t.x + 4.2, 1.5, t.z - 1]]);
      condenser.push([[t.x + 3.4, Y + 0.4, t.z + 1], [t.x + 4.6, Y + 0.4, t.z + 1], [t.x + 4.6, 1.5, t.z + 1]]);
    }
    return { supply, ret, condenser };
  }, []);

  return (
    <group>
      {DRY_COOLERS.map((d) => (
        <DryCooler key={d.id} {...d} />
      ))}
      {COOLING_TOWERS.map((t) => (
        <CoolingTower key={t.id} {...t} />
      ))}
      <SpinningFans fans={fans} />
      <Selectable id="roof-chw-pipes" type="chilled-water-pipe" label="Rooftop cooling water headers">
        <PipeRuns runs={pipes.supply} radius={0.16} material={std(PAL.chwSupply, { roughness: 0.4 })} />
        <PipeRuns runs={pipes.ret} radius={0.16} material={std(PAL.chwReturn, { roughness: 0.4 })} />
        <PipeRuns runs={pipes.condenser} radius={0.2} material={std(PAL.condenser, { roughness: 0.4 })} />
      </Selectable>
      {/* Makeup-air handling units over the office block. */}
      <Selectable id="ahu-1" type="crah" label="Rooftop makeup-air unit (AHU)">
        <Block size={[8, 2.2, 2.8]} position={[-10, Y, 16]} material={std(PAL.cabinetGrey, { metalness: 0.2 })} />
        <Block size={[2.2, 1.4, 2.8]} position={[-15, Y, 16]} material={std("#a9b0b7", { metalness: 0.2 })} />
      </Selectable>
    </group>
  );
}
