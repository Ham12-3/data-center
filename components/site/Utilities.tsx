import { type ReactNode, useMemo } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, Cyl, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { type FanSpec, SpinningFans } from "@/components/common/SpinningFans";
import { FuelTank, GENSET_FAN_LOCAL, Generator } from "@/components/equipment/Generator";
import { PadTransformer, PowerTransformer } from "@/components/equipment/Transformer";
import {
  FIBER_ENTRIES,
  FUEL_TANKS,
  GENERATORS,
  PAD_TRANSFORMERS,
  POWER_LINE_TOWERS,
  SUBSTATION,
  WATER_TANK,
  rectCenter,
  rectSize,
} from "@/data/site";
import { PAL, std } from "@/lib/three/materialCache";
import { useScenarioEffect } from "@/components/simulation/useScenarioEffects";
import { live } from "@/lib/sim/live";

// ---------------------------------------------------------------------------
// Generator yard
// ---------------------------------------------------------------------------

/** Radiator fan speed follows engine speed. */
const generatorFanSpeed = () => live.effects.generatorRpm;

export function GeneratorYard(): ReactNode {
  const status = useScenarioEffect((fx) => (fx.generatorRpm >= 0.99 ? "running" : fx.generatorRpm > 0 ? "starting" : "standby"));
  const fans = useMemo<FanSpec[]>(
    () =>
      GENERATORS.flatMap((g) =>
        GENSET_FAN_LOCAL.map(([x, y, z]) => ({ position: [g.x + x, y, g.z + z] as const, radius: 0.58, speed: 14 })),
      ),
    [],
  );
  return (
    <group>
      <Block size={[42, 0.2, 72]} position={[67, 0, 1]} material={std("#a9a8a2", { roughness: 0.9, detail: { scale: 0.2, colorVar: 0.09, roughVar: 0.12, bump: 0.02, bumpScale: 12 } })} cast={false} />
      {GENERATORS.map((g) => (
        <Generator key={g.id} id={g.id} position={[g.x, 0.2, g.z]} status={status} />
      ))}
      <group position={[0, 0.2, 0]}>
        {/* Radiator fans only turn when the engines run (utility-failure scenario). */}
        <SpinningFans fans={fans} speedSource={generatorFanSpeed} />
      </group>
      {FUEL_TANKS.map((t) => (
        <FuelTank key={t.id} id={t.id} position={[t.x, 0.2, t.z]} />
      ))}
      {/* Covered cable trench from the yard to the electrical rooms. */}
      <Box size={[6, 0.12, 1.2]} position={[48, 0.06, 4]} material={std("#6d7075")} cast={false} />
      <Box size={[1.2, 0.12, 40]} position={[51.4, 0.06, -12]} material={std("#6d7075")} cast={false} />
    </group>
  );
}

export function PadTransformers(): ReactNode {
  return (
    <group>
      {PAD_TRANSFORMERS.map((t) => (
        <PadTransformer key={t.id} id={t.id} position={[t.x, 0, t.z]} feed={t.feed} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Substation and incoming high-voltage line
// ---------------------------------------------------------------------------

const TOWER_H = 34;
const ARM_Y = [24, 28.5, 33] as const;
const ARM_HALF = [6, 7.5, 6] as const;

/** Lattice tower members as straight segments (pairs of points), relative to the tower base. */
function towerMembers(): V3[][] {
  const runs: V3[][] = [];
  const b = 4.5; // half base width
  const t = 1.0; // half top width
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const;
  const at = (y: number): number => b + (t - b) * (y / TOWER_H);
  for (const [sx, sz] of corners) runs.push([[sx * b, 0, sz * b], [sx * t, TOWER_H, sz * t]]);
  // Horizontal rings and X-bracing on each face, every 4 m.
  for (let y = 0; y < TOWER_H; y += 4) {
    const y2 = Math.min(TOWER_H, y + 4);
    const w1 = at(y);
    const w2 = at(y2);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      runs.push([[ax * w1, y, az * w1], [bx * w1, y, bz * w1]]);
      runs.push([[ax * w1, y, az * w1], [bx * w2, y2, bz * w2]]);
      runs.push([[bx * w1, y, bz * w1], [ax * w2, y2, az * w2]]);
    }
  }
  // Cross arms carrying the conductors.
  ARM_Y.forEach((y, i) => {
    const w = at(y);
    runs.push([[-ARM_HALF[i], y, -w], [ARM_HALF[i], y, -w]]);
    runs.push([[-ARM_HALF[i], y, w], [ARM_HALF[i], y, w]]);
  });
  return runs;
}

/** Conductor attachment points (end of each arm, below the insulator string). */
function attachPoints(tx: number, tz: number): V3[] {
  const pts: V3[] = [];
  ARM_Y.forEach((y, i) => {
    for (const side of [-1, 1]) pts.push([tx, y - 2.2, tz + side * ARM_HALF[i] * 0.95]);
  });
  return pts;
}

/** Sampled catenary approximated by a parabola: sag is greatest mid-span. */
function sagCurve(a: V3, b: V3, sag: number, steps = 16): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

export function PowerLine(): ReactNode {
  const { members, conductors, insulators } = useMemo(() => {
    const members: V3[][] = [];
    const conductors: V3[][] = [];
    const insulators: V3[][] = [];
    const base = towerMembers();
    for (const [tx, tz] of POWER_LINE_TOWERS) {
      // Towers stand with arms spanning Z, conductors running along X.
      for (const run of base) members.push(run.map(([x, y, z]) => [tx + z, y, tz + x] as V3));
      for (const p of attachPoints(tx, tz)) insulators.push([[p[0], p[1], p[2]], [p[0], p[1] + 2.2, p[2]]]);
    }
    // Spans between towers, then the last span drops to the substation gantry.
    for (let i = 0; i < POWER_LINE_TOWERS.length - 1; i++) {
      const a = attachPoints(...POWER_LINE_TOWERS[i]);
      const b = attachPoints(...POWER_LINE_TOWERS[i + 1]);
      a.forEach((p, k) => conductors.push(sagCurve(p, b[k], 4)));
    }
    const last = attachPoints(...POWER_LINE_TOWERS[POWER_LINE_TOWERS.length - 1]);
    const gx = SUBSTATION.x1 - 4;
    last.forEach((p, k) => {
      const z = -64 + ((k % 2 === 0 ? -1 : 1) * (2 + Math.floor(k / 2) * 2.2));
      conductors.push(sagCurve(p, [gx, 13.5, z], 2.5, 10));
    });
    return { members, conductors, insulators };
  }, []);

  return (
    <Selectable id="hv-line" type="power-line" label="Incoming 132 kV overhead line">
      <PipeRuns runs={members} radius={0.14} material={std("#8e959c", { metalness: 0.6, roughness: 0.45 })} />
      <PipeRuns runs={conductors} radius={0.05} material={std("#5b6067", { metalness: 0.7, roughness: 0.4 })} />
      <PipeRuns runs={insulators} radius={0.12} material={std("#7a4b2e", { roughness: 0.35 })} />
    </Selectable>
  );
}

/** HV switchyard: gantry, breakers, disconnectors, two power transformers, control house. */
export function Substation(): ReactNode {
  const [cx, cz] = rectCenter(SUBSTATION);
  const [w, d] = rectSize(SUBSTATION);
  const steel = std("#9aa1a8", { metalness: 0.6, roughness: 0.4 });
  const porcelain = std("#7a4b2e", { roughness: 0.35 });
  const gx = SUBSTATION.x1 - 4;

  const gantry = useMemo<V3[][]>(() => {
    const runs: V3[][] = [];
    for (const z of [-71, -57]) {
      runs.push([[gx, 0, z], [gx, 15, z]]);
    }
    runs.push([[gx, 14.5, -71], [gx, 14.5, -57]]);
    runs.push([[gx, 12.5, -71], [gx, 12.5, -57]]);
    // Rigid busbars from gantry to the breakers and on to the transformers.
    for (const z of [-66.5, -64, -61.5]) {
      runs.push([[gx, 12.5, z], [gx - 6, 6, z], [cx + 4, 6, z], [cx - 2, 6, z]]);
    }
    return runs;
  }, [cx, gx]);

  return (
    <group>
      <Selectable id="substation" type="substation" label="Utility substation (132/33 kV)">
        <Block size={[w, 0.1, d]} position={[cx, 0, cz]} material={std("#8d877c", { roughness: 1, detail: { scale: 0.8, colorVar: 0.22, roughVar: 0.05, bump: 0.08, bumpScale: 18 } })} cast={false} />
        <PipeRuns runs={gantry} radius={0.12} material={steel} />
        {/* Circuit breakers (three poles each) and disconnect switches. */}
        {[0, 1].map((bay) =>
          [-66.5, -64, -61.5].map((z) => (
            <group key={`${bay}-${z}`} position={[gx - 9 - bay * 5, 0, z]}>
              <Block size={[0.6, 2.2, 0.6]} material={steel} />
              <Cyl radius={0.25} height={2.2} position={[0, 3.3, 0]} material={porcelain} />
              <Box size={[0.7, 0.5, 0.7]} position={[0, 4.6, 0]} material={std("#b9bfc5", { metalness: 0.5 })} />
            </group>
          )),
        )}
        {/* Control house with protection relays and SCADA. */}
        <Block size={[10, 3.5, 6]} position={[SUBSTATION.x0 + 7, 0, SUBSTATION.z1 - 5]} material={std(PAL.cladding)} />
        <Block size={[10.4, 0.3, 6.4]} position={[SUBSTATION.x0 + 7, 3.5, SUBSTATION.z1 - 5]} material={std(PAL.claddingDark)} />
      </Selectable>
      <PowerTransformer id="ST-1" position={[cx - 6, 0, -70]} />
      <PowerTransformer id="ST-2" position={[cx - 6, 0, -58]} />
      {/* Underground 33 kV feeders to the building, shown as a marked cable route. */}
      <Box size={[1.4, 0.03, 34]} position={[56, 0.04, -46]} material={std("#c9a227")} cast={false} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Fibre entries and water storage
// ---------------------------------------------------------------------------

export function FiberEntries(): ReactNode {
  const conduit = std("#f08a24", { roughness: 0.5 });
  return (
    <group>
      {FIBER_ENTRIES.map((f) => {
        const [vx, vz] = f.vault;
        const [wx, wz] = f.wall;
        const runs: V3[][] = [-0.25, 0, 0.25].map((o) =>
          vx === wx ? [[vx + o, 0.15, vz], [wx + o, 0.15, wz]] : [[vx, 0.15, vz + o], [wx, 0.15, wz + o]],
        );
        return (
          <Selectable key={f.id} id={`fiber-entry-${f.id}`} type="fiber-entry" label={`Fibre entry ${f.id} (diverse path)`}>
            {/* Trench strip, conduits and the carrier handhole/vault. */}
            <Box
              size={vx === wx ? [1.4, 0.02, Math.abs(wz - vz)] : [Math.abs(wx - vx), 0.02, 1.4]}
              position={[(vx + wx) / 2, 0.02, (vz + wz) / 2]}
              material={std("#5a4a3b", { roughness: 1 })}
              cast={false}
            />
            <PipeRuns runs={runs} radius={0.07} material={conduit} />
            <Block size={[2.2, 0.35, 2.2]} position={[vx, 0, vz]} material={std(PAL.concrete)} />
            <Box size={[1.6, 0.04, 1.6]} position={[vx, 0.37, vz]} material={std("#454a50", { metalness: 0.6 })} />
          </Selectable>
        );
      })}
    </group>
  );
}

export function WaterTank(): ReactNode {
  const { x, z, radius, height } = WATER_TANK;
  return (
    <Selectable id="water-tank" type="water-tank" label="Water storage tank">
      <Block size={[radius * 2 + 2, 0.3, radius * 2 + 2]} position={[x, 0, z]} material={std(PAL.concrete)} />
      <Cyl radius={radius} height={height} position={[x, 0.3 + height / 2, z]} material={std("#c7cdd3", { metalness: 0.6, roughness: 0.35 })} />
      <Cyl radius={radius * 1.02} height={0.4} position={[x, 0.3 + height + 0.2, z]} material={std("#aeb5bc", { metalness: 0.6 })} />
      <Box size={[0.5, height, 0.12]} position={[x + radius + 0.1, 0.3 + height / 2, z]} material={std(PAL.steel)} />
    </Selectable>
  );
}
