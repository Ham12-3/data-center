import { CORE_RACKS, HALL_A, HALL_A_RACKS, HALL_B, HALL_B_LAYOUT, MMR_RACKS, type RackPlacement, hallAPodX } from "@/data/halls";
import { roomById } from "@/data/site";
import { type CrahFailureInput, type FacilityMetrics, type SimRack, computeFacility } from "./model";

/** Position of a rack along its row, 0..1, from the trailing "-NN" in its id. */
function rowPosition(p: RackPlacement, perRow: number): number {
  const n = Number(p.id.split("-").pop());
  return Number.isFinite(n) && perRow > 1 ? (n - 1) / (perRow - 1) : 0.5;
}

/** Every rack in the facility, in the shape the simulation model needs. */
export const SIM_RACKS: readonly SimRack[] = [
  ...HALL_A_RACKS.map(
    (p): SimRack => ({ id: p.id, hall: "A", kind: p.kind, slots: p.slots, rowPosition: rowPosition(p, HALL_A.racksPerRow), x: p.position[0], z: p.position[2] }),
  ),
  ...HALL_B_LAYOUT.racks.map((p): SimRack => ({ id: p.id, hall: "B", kind: "gpu", rowPosition: rowPosition(p, HALL_B.racksPerRow) })),
  ...[...CORE_RACKS, ...MMR_RACKS].map((p): SimRack => ({ id: p.id, hall: "core", kind: "network", slots: p.slots, rowPosition: 0.5 })),
];

/**
 * Hall A CRAH positions, indexed as the zone builds them: 0-5 along the north
 * wall and 6-11 along the south wall, each at the end of a hot aisle.
 */
export const HALL_A_CRAHS: readonly { id: string; x: number; z: number }[] = (() => {
  const room = roomById("hallA").rect;
  const xs = Array.from({ length: HALL_A.pods + 1 }, (_, p) => hallAPodX(p) - HALL_A.aisle / 2);
  return [
    ...xs.map((x, i) => ({ id: `CRAH-A${i + 1}`, x, z: room.z0 + 0.65 })),
    ...xs.map((x, i) => ({ id: `CRAH-A${i + 7}`, x, z: room.z1 - 0.65 })),
  ];
})();

export interface FacilityConditions {
  readonly crahFailure?: { readonly index: number; readonly severity: number; readonly recovery: number } | null;
  readonly mechanicalDown?: boolean;
}

export function facilityAt(load: number, outsideC: number, time: number, conditions: FacilityConditions = {}): FacilityMetrics {
  const f = conditions.crahFailure;
  const crah = f ? HALL_A_CRAHS[f.index] : undefined;
  const crahFailure: CrahFailureInput | null = f && crah ? { x: crah.x, z: crah.z, severity: f.severity, recovery: f.recovery } : null;
  return computeFacility(SIM_RACKS, { load, outsideC, time, crahFailure, mechanicalDown: conditions.mechanicalDown });
}
