import type { RackSlotConfig } from "@/types/equipment";
import { hash01 } from "@/lib/random";
import { GPU_RACK } from "@/lib/rack/gpuRack";
import { RACK_DEPTH } from "@/lib/units";
import { BUILDING } from "./site";
import { DEMO_RACK_SLOTS } from "./layout";

export type RackKind = "compute" | "storage" | "network" | "gpu";

export interface RackPlacement {
  readonly id: string;
  readonly kind: RackKind;
  /** Floor point under the rack centre. */
  readonly position: readonly [number, number, number];
  /** Rotation about Y. Rack-local +Z (front) maps to (sin r, 0, cos r). */
  readonly rotationY: number;
  readonly label: string;
  /** Slot configuration for 42U racks (GPU racks have a fixed layout). */
  readonly slots?: readonly RackSlotConfig[];
}

// ---------------------------------------------------------------------------
// Rack variants
// ---------------------------------------------------------------------------

/** Storage rack: 2U storage nodes stacked to U36, leaves and patch panel on top. */
const STORAGE_SLOTS: readonly RackSlotConfig[] = [
  ...Array.from({ length: 16 }, (_, i): RackSlotConfig => ({ kind: "server-2u", u: 1 + i * 2, label: "Storage node" })),
  { kind: "tor-switch", u: 40, label: "Leaf switch B" },
  { kind: "tor-switch", u: 41, label: "Leaf switch A" },
  { kind: "patch-panel", u: 42, label: "Fibre patch panel" },
];

/** Healthy compute rack: the demo layout with every server reporting OK. */
const COMPUTE_SLOTS: readonly RackSlotConfig[] = DEMO_RACK_SLOTS.map((s) => (s.status ? { ...s, status: "ok" } : s));

/** Compute rack with one degraded server (amber health LED): the demo layout. */
const COMPUTE_WARN_SLOTS: readonly RackSlotConfig[] = DEMO_RACK_SLOTS;

/** Compute rack with one failed server (red health LED). */
const COMPUTE_FAULT_SLOTS: readonly RackSlotConfig[] = COMPUTE_SLOTS.map((s) => (s.u === 22 ? { ...s, status: "fault" } : s));

/** Half-populated compute rack: room to grow, the rest blanked off. */
const COMPUTE_PARTIAL_SLOTS: readonly RackSlotConfig[] = COMPUTE_SLOTS.filter((s) => s.kind !== "server-1u" || s.u < 20);

/** Spine row: patch panels front, two 2U spines, more patching. */
export const SPINE_SLOTS: readonly RackSlotConfig[] = [
  ...Array.from({ length: 6 }, (_, i): RackSlotConfig => ({ kind: "patch-panel", u: 36 + i, face: "front", label: "Fibre patch panel" })),
  { kind: "spine-switch", u: 30, label: "Spine switch" },
  { kind: "spine-switch", u: 26, label: "Spine switch" },
  { kind: "spine-switch", u: 22, label: "Spine switch" },
  { kind: "spine-switch", u: 18, label: "Spine switch" },
  ...Array.from({ length: 4 }, (_, i): RackSlotConfig => ({ kind: "patch-panel", u: 10 + i, face: "front", label: "Fibre patch panel" })),
];

export const ROUTER_SLOTS: readonly RackSlotConfig[] = [
  ...Array.from({ length: 4 }, (_, i): RackSlotConfig => ({ kind: "patch-panel", u: 38 + i, face: "front", label: "Fibre patch panel" })),
  { kind: "border-router", u: 28, label: "Border router" },
  { kind: "border-router", u: 20, label: "Border router" },
  { kind: "spine-switch", u: 12, label: "Super-spine / DCI switch" },
];

// ---------------------------------------------------------------------------
// Data Hall A: air-cooled, raised floor, cold-aisle containment
// ---------------------------------------------------------------------------

export const HALL_A = {
  floorY: BUILDING.raisedFloor,
  pods: 5,
  podPitch: 4.8,
  x0: -36.3,
  racksPerRow: 20,
  rowCenterZ: -11,
  rackPitch: 0.6,
  aisle: 1.2,
} as const;

/** X of the west edge of pod p (start of its first row). */
export const hallAPodX = (p: number): number => HALL_A.x0 + p * HALL_A.podPitch;
export const hallARowZ0 = HALL_A.rowCenterZ - (HALL_A.racksPerRow * HALL_A.rackPitch) / 2;
export const hallARowZ1 = HALL_A.rowCenterZ + (HALL_A.racksPerRow * HALL_A.rackPitch) / 2;

function hallAVariant(row: number, i: number): { kind: RackKind; slots: readonly RackSlotConfig[] } {
  const h = hash01("hallA", row * 100 + i);
  if (row % 4 === 3) return { kind: "storage", slots: STORAGE_SLOTS };
  if (h < 0.02) return { kind: "compute", slots: COMPUTE_FAULT_SLOTS };
  if (h < 0.06) return { kind: "compute", slots: COMPUTE_WARN_SLOTS };
  if (h < 0.25) return { kind: "compute", slots: COMPUTE_PARTIAL_SLOTS };
  return { kind: "compute", slots: COMPUTE_SLOTS };
}

/**
 * Rows run north-south. In each pod two rows face each other across a cold
 * aisle (front to front); backs face the hot aisles between pods.
 */
export const HALL_A_RACKS: readonly RackPlacement[] = (() => {
  const list: RackPlacement[] = [];
  for (let p = 0; p < HALL_A.pods; p++) {
    const base = hallAPodX(p);
    const rows = [
      { x: base + RACK_DEPTH / 2, rot: Math.PI / 2 }, // west row, fronts face +X
      { x: base + RACK_DEPTH + HALL_A.aisle + RACK_DEPTH / 2, rot: -Math.PI / 2 }, // east row, fronts face -X
    ];
    rows.forEach((r, k) => {
      const rowNo = p * 2 + k + 1;
      const rowId = `A${String(rowNo).padStart(2, "0")}`;
      for (let i = 0; i < HALL_A.racksPerRow; i++) {
        const z = hallARowZ0 + HALL_A.rackPitch * (i + 0.5);
        const v = hallAVariant(rowNo, i);
        const id = `${rowId}-${String(i + 1).padStart(2, "0")}`;
        list.push({ id, kind: v.kind, position: [r.x, HALL_A.floorY, z], rotationY: r.rot, label: `Rack ${id}`, slots: v.slots });
      }
    });
  }
  return list;
})();

// ---------------------------------------------------------------------------
// Data Hall B: AI / liquid-cooled, slab floor, hot-aisle containment
// ---------------------------------------------------------------------------

export const HALL_B = {
  pods: 3,
  x0: 15,
  rowDepth: 1.2,
  hotAisle: 1.5,
  coldAisle: 1.8,
  racksPerRow: 10,
  cduWidth: 0.75,
  rowCenterZ: -10,
} as const;

export const hallBPodX = (p: number): number => HALL_B.x0 + p * (2 * HALL_B.rowDepth + HALL_B.hotAisle + HALL_B.coldAisle);
export const hallBRowLength = HALL_B.racksPerRow * GPU_RACK.width + 2 * HALL_B.cduWidth;
export const hallBRowZ0 = HALL_B.rowCenterZ - hallBRowLength / 2;
export const hallBRowZ1 = HALL_B.rowCenterZ + hallBRowLength / 2;

export interface CduPlacement {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

/**
 * Each pod is two rows back to back around a contained hot aisle; fronts face
 * out into open cold aisles fed by the fan walls. Each row is 10 NVL72 racks
 * with an in-row CDU at each end (N+1).
 */
export const HALL_B_LAYOUT: { racks: RackPlacement[]; cdus: CduPlacement[] } = (() => {
  const racks: RackPlacement[] = [];
  const cdus: CduPlacement[] = [];
  for (let p = 0; p < HALL_B.pods; p++) {
    const base = hallBPodX(p);
    const rows = [
      // West row: rear on the hot aisle, front faces -X.
      { rackX: base + HALL_B.rowDepth - GPU_RACK.depth / 2, cduX: base + HALL_B.rowDepth / 2, rot: -Math.PI / 2 },
      // East row: front faces +X.
      {
        rackX: base + HALL_B.rowDepth + HALL_B.hotAisle + GPU_RACK.depth / 2,
        cduX: base + HALL_B.rowDepth + HALL_B.hotAisle + HALL_B.rowDepth / 2,
        rot: Math.PI / 2,
      },
    ];
    rows.forEach((r, k) => {
      const rowNo = p * 2 + k + 1;
      const rowId = `B${String(rowNo).padStart(2, "0")}`;
      cdus.push({ id: `CDU-${rowId}-1`, position: [r.cduX, 0, hallBRowZ0 + HALL_B.cduWidth / 2], rotationY: r.rot });
      for (let i = 0; i < HALL_B.racksPerRow; i++) {
        const z = hallBRowZ0 + HALL_B.cduWidth + GPU_RACK.width * (i + 0.5);
        const id = `${rowId}-${String(i + 1).padStart(2, "0")}`;
        racks.push({ id, kind: "gpu", position: [r.rackX, 0, z], rotationY: r.rot, label: `GPU rack ${id} (NVL72)` });
      }
      cdus.push({ id: `CDU-${rowId}-2`, position: [r.cduX, 0, hallBRowZ1 - HALL_B.cduWidth / 2], rotationY: r.rot });
    });
  }
  return { racks, cdus };
})();

// ---------------------------------------------------------------------------
// Network core and Meet-Me Room
// ---------------------------------------------------------------------------

/**
 * Network core (MDA): two facing rows of network racks. Row N holds the
 * border routers and the Hall A spines; row S the Hall B (GPU fabric) spines.
 */
export const CORE_RACKS: readonly RackPlacement[] = [0, 1].flatMap((row) =>
  Array.from({ length: 8 }, (_, i): RackPlacement => {
    const router = row === 0 && i < 2;
    const id = `NC${row + 1}-${String(i + 1).padStart(2, "0")}`;
    return {
      id,
      kind: "network",
      position: [-2.1 + i * 0.6, 0, row === 0 ? -12 : -9.6],
      rotationY: row === 0 ? 0 : Math.PI,
      label: router ? `Border router rack ${id}` : `Spine switch rack ${id}`,
      slots: router ? ROUTER_SLOTS : SPINE_SLOTS,
    };
  }),
);

/** Carrier cages in the Meet-Me Room: [centre x, centre z, carrier name, accent colour]. */
export const CARRIER_CAGES: readonly { id: string; x: number; z: number; carrier: string; color: string }[] = [
  { id: "CAGE-1", x: -5.2, z: -23.9, carrier: "Carrier 1 (long-haul)", color: "#ef4444" },
  { id: "CAGE-2", x: 5.2, z: -23.9, carrier: "Carrier 2 (metro)", color: "#3b82f6" },
  { id: "CAGE-3", x: -5.2, z: -17.2, carrier: "Carrier 3 (subsea backhaul)", color: "#10b981" },
  { id: "CAGE-4", x: 5.2, z: -17.2, carrier: "Cloud on-ramp / IX", color: "#a855f7" },
];

export const MMR_RACKS: readonly RackPlacement[] = CARRIER_CAGES.flatMap((c) =>
  [-0.3, 0.3].map((dz, k): RackPlacement => {
    const west = c.x < 0;
    const id = `${c.id}-R${k + 1}`;
    return {
      id,
      kind: "network",
      position: [c.x + (west ? -0.8 : 0.8), 0, c.z + dz * 2],
      rotationY: west ? Math.PI / 2 : -Math.PI / 2,
      label: `${c.carrier} rack ${k + 1}`,
      slots: ROUTER_SLOTS,
    };
  }),
);
