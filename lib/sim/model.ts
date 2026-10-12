import type { RackSlotConfig } from "@/types/equipment";
import { hash01 } from "@/lib/random";

/**
 * Facility simulation model: pure functions, no rendering.
 *
 * Given the overall load (0..1), the outdoor temperature and the simulation
 * time, it computes per-rack IT power and temperatures, then the facility
 * power breakdown (IT, UPS and distribution losses, cooling, lighting) and
 * PUE. The numbers are simplified engineering estimates, tuned so that a
 * typical operating point lands where real facilities do: ~8 kW per
 * air-cooled rack, ~90-130 kW per NVL72 rack, PUE around 1.15-1.35.
 */

export type SimRackKind = "compute" | "storage" | "network" | "gpu";

export interface SimRack {
  readonly id: string;
  readonly hall: "A" | "B" | "core";
  readonly kind: SimRackKind;
  readonly slots?: readonly RackSlotConfig[];
  /** Normalised position along its row (0 = first rack, 1 = last); end racks run warmer. */
  readonly rowPosition: number;
  /** Floor position (world X / Z), used for local effects such as a failed CRAH. */
  readonly x?: number;
  readonly z?: number;
}

/** A failed CRAH: where it is, how far its local heating has developed, and how far the others have compensated. */
export interface CrahFailureInput {
  readonly x: number;
  readonly z: number;
  /** 0..1, grows with thermal inertia after the failure. */
  readonly severity: number;
  /** 0..1, how far the neighbouring units have ramped up to compensate. */
  readonly recovery: number;
}

export interface SimInputs {
  /** Overall load, 0..1. */
  readonly load: number;
  /** Outdoor dry-bulb temperature, °C. */
  readonly outsideC: number;
  /** Simulation time, seconds (drives slow load fluctuations). */
  readonly time: number;
  readonly crahFailure?: CrahFailureInput | null;
  /** Mechanical (non-UPS) loads are without power, e.g. the seconds before generators pick up. */
  readonly mechanicalDown?: boolean;
}

export interface RackState {
  readonly id: string;
  /** Utilisation of this rack, 0..1 (overall load ± per-rack variation). */
  readonly util: number;
  readonly powerKw: number;
  readonly inletC: number;
  readonly exhaustC: number;
}

export interface FacilityMetrics {
  readonly itKw: { readonly hallA: number; readonly hallB: number; readonly network: number; readonly total: number };
  readonly upsLossKw: number;
  readonly distributionLossKw: number;
  readonly coolingKw: {
    readonly chillers: number;
    readonly pumps: number;
    readonly crahFans: number;
    readonly fanWalls: number;
    readonly heatRejection: number;
    readonly cduPumps: number;
    readonly total: number;
  };
  readonly otherKw: number;
  readonly totalKw: number;
  readonly pue: number;
  /** Fraction of chilled-water cooling provided by free cooling (no compressors). */
  readonly freeCoolingFraction: number;
  /** CRAH / fan-wall fan speed, 0..1. */
  readonly fanSpeed: number;
  readonly avgInletC: number;
  readonly maxInletC: number;
  /** East-west traffic inside the fabric, Tb/s. */
  readonly fabricTbps: number;
  /** North-south internet traffic, Gb/s. */
  readonly internetGbps: number;
  /** Power on each of the two 2N feeds (they share the load equally). */
  readonly feedKw: { readonly A: number; readonly B: number };
  readonly racks: ReadonlyMap<string, RackState>;
}

// ---------------------------------------------------------------------------
// Constants (sources and ranges: docs/research.md)
// ---------------------------------------------------------------------------

/** Server power at idle and at full load, kW. */
const SERVER_KW = {
  "server-1u": { idle: 0.12, max: 0.42 },
  "server-2u": { idle: 0.18, max: 0.55 },
} as const;
const SWITCH_KW = { "tor-switch": 0.25, "spine-switch": 1.4, "border-router": 2.2 } as const;
/** NVL72-class rack: idle and peak power, kW. */
const GPU_RACK_KW = { idle: 28, max: 132 };
/** Share of GPU rack heat removed by liquid (the rest goes to air). */
export const GPU_LIQUID_FRACTION = 0.85;

const UPS_EFFICIENCY = 0.965;
const DISTRIBUTION_LOSS = 0.015;
const CHILLER_COP = 6.5;
const CRAH_COUNT = 12;
const CRAH_FAN_KW = 7.5;
const FAN_WALL_COUNT = 7;
const FAN_WALL_FAN_KW = 11;
/** Air-cooled hall supply temperature (CRAH set point), °C. */
export const HALL_A_SUPPLY_C = 20;
/** Fan-wall supply in the AI hall runs warmer, °C. */
export const HALL_B_SUPPLY_C = 23;
/** Peak inlet rise right next to a failed CRAH before the others compensate, °C. */
const CRAH_FAILURE_RISE_C = 9;
/** Radius of influence of one CRAH, m. */
const CRAH_REACH_M = 9;
/** ASHRAE recommended inlet upper limit, °C. */
export const ASHRAE_MAX_INLET_C = 27;
const OTHER_FIXED_KW = 60; // lighting, offices, security, BMS
/** No-load losses that don't shrink with IT load: why PUE worsens when a facility is lightly used. */
const UPS_NO_LOAD_KW = 55;
const TRANSFORMER_NO_LOAD_KW = 30;
const PUMPS_MIN_KW = 45;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Per-rack utilisation: overall load scaled by a stable per-rack factor
 * (some racks are busier than others) plus a slow sinusoidal drift over time.
 */
export function rackUtil(id: string, load: number, time: number): number {
  const bias = 0.7 + 0.6 * hash01(id, 1);
  const drift = 0.06 * Math.sin(time * 0.05 + hash01(id, 2) * 6.283);
  return clamp01(load * bias + drift * load);
}

/** IT power of one rack at a given utilisation, kW. */
export function rackPowerKw(rack: SimRack, util: number): number {
  if (rack.kind === "gpu") return GPU_RACK_KW.idle + (GPU_RACK_KW.max - GPU_RACK_KW.idle) * util;
  let kw = 0;
  for (const s of rack.slots ?? []) {
    if (s.kind === "server-1u" || s.kind === "server-2u") {
      const spec = SERVER_KW[s.kind];
      // A failed server draws nothing; one in warning still runs.
      if (s.status !== "fault") kw += spec.idle + (spec.max - spec.idle) * util;
    } else if (s.kind === "tor-switch" || s.kind === "spine-switch" || s.kind === "border-router") {
      kw += SWITCH_KW[s.kind] * (0.6 + 0.4 * util);
    }
  }
  return kw;
}

/**
 * Inlet and exhaust temperatures. Inlet = supply + small recirculation
 * (larger at row ends, where containment leaks most) + a penalty for each
 * failed CRAH. Exhaust = inlet + ΔT, and ΔT rises with utilisation as
 * server fans can only partly keep up.
 */
export function rackTemps(
  rack: SimRack,
  util: number,
  crahFailure: CrahFailureInput | null = null,
  mechanicalDown = false,
): { inletC: number; exhaustC: number } {
  const supply = rack.hall === "B" ? HALL_B_SUPPLY_C : HALL_A_SUPPLY_C;
  const endEffect = Math.abs(rack.rowPosition - 0.5) * 2; // 0 mid-row, 1 at the ends
  const recirc = 0.4 + 1.2 * hash01(rack.id, 3) + 1.3 * endEffect * endEffect;
  // A failed CRAH starves the floor near it of cold air: a Gaussian bump in
  // inlet temperature around the unit, reduced as the neighbours ramp up.
  let failurePenalty = 0;
  if (crahFailure && rack.hall === "A" && rack.x !== undefined && rack.z !== undefined) {
    const d2 = (rack.x - crahFailure.x) ** 2 + (rack.z - crahFailure.z) ** 2;
    const proximity = Math.exp(-d2 / (2 * CRAH_REACH_M * CRAH_REACH_M));
    failurePenalty = CRAH_FAILURE_RISE_C * proximity * crahFailure.severity * (1 - 0.6 * crahFailure.recovery);
  }
  const inletC = supply + recirc + failurePenalty + util * 0.8 + (mechanicalDown ? 1.2 : 0);
  const deltaT = rack.kind === "gpu" ? 9 + 6 * util : 6 + 10 * util;
  return { inletC, exhaustC: inletC + deltaT };
}

/** Free-cooling share: full below 10 °C outside, none above 22 °C (with ~18 °C chilled water). */
export function freeCoolingFraction(outsideC: number): number {
  return clamp01((22 - outsideC) / 12);
}

/** Compute the whole facility's state for one moment. */
export function computeFacility(racks: readonly SimRack[], inputs: SimInputs): FacilityMetrics {
  const load = clamp01(inputs.load);
  const failure = inputs.crahFailure ?? null;
  const failed = failure ? 1 : 0;
  const states = new Map<string, RackState>();
  let hallA = 0;
  let hallB = 0;
  let network = 0;
  let inletSum = 0;
  let inletN = 0;
  let maxInlet = 0;
  let hallAServers = 0;
  let gpuRacks = 0;

  for (const r of racks) {
    const util = r.kind === "network" ? 0.4 + 0.6 * load : rackUtil(r.id, load, inputs.time);
    const powerKw = rackPowerKw(r, util);
    const { inletC, exhaustC } = rackTemps(r, util, failure, inputs.mechanicalDown);
    states.set(r.id, { id: r.id, util, powerKw, inletC, exhaustC });
    if (r.hall === "A") {
      hallA += powerKw;
      hallAServers += (r.slots ?? []).filter((s) => s.kind === "server-1u" || s.kind === "server-2u").length;
    } else if (r.hall === "B") {
      hallB += powerKw;
      gpuRacks++;
    } else network += powerKw;
    if (r.hall !== "core") {
      inletSum += inletC;
      inletN++;
      maxInlet = Math.max(maxInlet, inletC);
    }
  }

  const it = hallA + hallB + network;
  const upsLoss = UPS_NO_LOAD_KW + it * (1 / UPS_EFFICIENCY - 1);
  const distLoss = TRANSFORMER_NO_LOAD_KW + (it + upsLoss) * DISTRIBUTION_LOSS;

  // Cooling.
  const free = freeCoolingFraction(inputs.outsideC);
  const hot = Math.max(0, inputs.outsideC - 20) / 15; // heat rejection works harder on hot days
  const airHeatB = hallB * (1 - GPU_LIQUID_FRACTION);
  const liquidHeatB = hallB * GPU_LIQUID_FRACTION;
  const chilledWaterHeat = hallA + network + airHeatB;
  const fanSpeed = 0.35 + 0.65 * load;
  // Fan affinity law: power scales with the cube of speed. More units running
  // harder compensate when a CRAH fails.
  const ramp = failure ? 1 + 0.15 * failure.recovery : 1;
  const crahFans = (CRAH_COUNT - failed) * CRAH_FAN_KW * Math.min(1, fanSpeed * ramp) ** 3;
  const fanWalls = FAN_WALL_COUNT * FAN_WALL_FAN_KW * fanSpeed ** 3;
  const chillers = (chilledWaterHeat * (1 - free)) / CHILLER_COP;
  const pumps = PUMPS_MIN_KW + chilledWaterHeat * 0.02;
  const cduPumps = liquidHeatB * 0.012;
  const heatRejection = (chilledWaterHeat + liquidHeatB) * 0.018 * (1 + hot);
  // Mechanical plant is not on UPS: during a utility outage it stops until the generators pick up.
  const mech = inputs.mechanicalDown ? 0 : 1;
  const coolingTotal = (chillers + pumps + crahFans + fanWalls + heatRejection) * mech + cduPumps;

  const other = OTHER_FIXED_KW + upsLoss * 0.3; // electrical-room cooling
  const total = it + upsLoss + distLoss + coolingTotal + other;

  const fabricTbps = (hallAServers * 2 * 25 * load * 0.3) / 1000 + (gpuRacks * 72 * 400 * load * 0.45) / 1000;
  const internetGbps = 40 + 260 * load;

  return {
    itKw: { hallA, hallB, network, total: it },
    upsLossKw: upsLoss,
    distributionLossKw: distLoss,
    coolingKw: {
      chillers: chillers * mech,
      pumps: pumps * mech,
      crahFans: crahFans * mech,
      fanWalls: fanWalls * mech,
      heatRejection: heatRejection * mech,
      cduPumps,
      total: coolingTotal,
    },
    otherKw: other,
    totalKw: total,
    pue: it > 0 ? total / it : 0,
    freeCoolingFraction: free,
    fanSpeed,
    avgInletC: inletN ? inletSum / inletN : 0,
    maxInletC: maxInlet,
    fabricTbps,
    internetGbps,
    feedKw: { A: (it + upsLoss + distLoss) / 2, B: (it + upsLoss + distLoss) / 2 },
    racks: states,
  };
}

/** Map a temperature to a heat-map colour (blue → cyan → green → yellow → red). */
export function heatColor(tempC: number, minC = 18, maxC = 32): [number, number, number] {
  const t = clamp01((tempC - minC) / (maxC - minC));
  const stops: [number, [number, number, number]][] = [
    [0, [0.15, 0.35, 1.0]],
    [0.3, [0.1, 0.85, 0.95]],
    [0.5, [0.25, 0.9, 0.35]],
    [0.75, [1.0, 0.85, 0.15]],
    [1, [1.0, 0.2, 0.12]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}
