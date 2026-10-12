/**
 * Campus layout, in metres. World frame: +X east, +Z south, Y up.
 * The main building is centred on the origin.
 *
 *   North (-Z)
 *   ┌───────────────┬────────┬────────────────┐
 *   │               │  MMR   │                │
 *   │  Data Hall A  ├────────┤  Data Hall B   │
 *   │  (air-cooled, │ Network│  (AI / liquid- │
 *   │  raised floor)│  core  │  cooled GPU)   │
 *   │               ├────────┤                │
 *   │               │  Fire  │                │
 *   ├───────────────┴────────┴────────────────┤  ← main corridor
 *   │ Cooling │Lobby │ NOC │Battery│ Elec A │Elec B│
 *   │  plant  │      │     │ room  │        │      │
 *   └─────────┴──────┴─────┴───────┴────────┴──────┘
 *   South (+Z): entrance, parking and gate
 */

export type Rect = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };

export const rectCenter = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
export const rectSize = (r: Rect): [number, number] => [r.x1 - r.x0, r.z1 - r.z0];

export const BUILDING = {
  /** Outer footprint. */
  footprint: { x0: -42, x1: 42, z0: -26, z1: 26 } as Rect,
  wallThickness: 0.3,
  /** Exterior wall height to the top of the parapet / roof screen (single-storey DCs: ~12-15 m). */
  height: 12.5,
  /** Top of the roof slab, where rooftop plant stands. */
  roofY: 11,
  /** Height of interior partition walls (~7 m clear height in the halls). */
  partitionHeight: 7,
  /** Raised-floor height in Data Hall A (600 mm is typical). */
  raisedFloor: 0.6,
} as const;

const I = { x0: -41.7, x1: 41.7, z0: -25.7, z1: 25.7 };

export type RoomId =
  | "hallA"
  | "hallB"
  | "mmr"
  | "core"
  | "fire"
  | "corridor"
  | "cooling"
  | "lobby"
  | "noc"
  | "battery"
  | "elecA"
  | "elecB";

export type FloorFinish = "raised" | "epoxy" | "carpet" | "polished" | "concrete";

export interface Room {
  readonly id: RoomId;
  readonly name: string;
  readonly rect: Rect;
  readonly floor: FloorFinish;
  /** Tone of the room's lighting: cool white for technical space, warm for offices. */
  readonly light: "cool" | "warm";
}

export const ROOMS: readonly Room[] = [
  { id: "hallA", name: "Data Hall A · Air-cooled", rect: { x0: I.x0, x1: -7, z0: I.z0, z1: 4 }, floor: "raised", light: "cool" },
  { id: "hallB", name: "Data Hall B · AI / Liquid-cooled", rect: { x0: 7, x1: I.x1, z0: I.z0, z1: 4 }, floor: "epoxy", light: "cool" },
  { id: "mmr", name: "Meet-Me Room", rect: { x0: -7, x1: 7, z0: I.z0, z1: -15 }, floor: "epoxy", light: "cool" },
  { id: "core", name: "Network Core (MDA)", rect: { x0: -7, x1: 7, z0: -15, z1: -5 }, floor: "epoxy", light: "cool" },
  { id: "fire", name: "Fire Suppression", rect: { x0: -7, x1: 7, z0: -5, z1: 4 }, floor: "concrete", light: "cool" },
  { id: "corridor", name: "Main Corridor", rect: { x0: I.x0, x1: I.x1, z0: 4, z1: 8 }, floor: "polished", light: "cool" },
  { id: "cooling", name: "Cooling Plant", rect: { x0: I.x0, x1: -22, z0: 8, z1: I.z1 }, floor: "concrete", light: "cool" },
  { id: "lobby", name: "Lobby & Security", rect: { x0: -22, x1: -10, z0: 8, z1: I.z1 }, floor: "polished", light: "warm" },
  { id: "noc", name: "Network Operations Center", rect: { x0: -10, x1: 3, z0: 8, z1: I.z1 }, floor: "carpet", light: "warm" },
  { id: "battery", name: "Battery Room", rect: { x0: 3, x1: 15, z0: 8, z1: I.z1 }, floor: "epoxy", light: "cool" },
  { id: "elecA", name: "Electrical Room A", rect: { x0: 15, x1: 28.5, z0: 8, z1: I.z1 }, floor: "epoxy", light: "cool" },
  { id: "elecB", name: "Electrical Room B", rect: { x0: 28.5, x1: I.x1, z0: 8, z1: I.z1 }, floor: "epoxy", light: "cool" },
];

export const roomById = (id: RoomId): Room => {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room ${id}`);
  return room;
};

/**
 * Interior partition walls as [x0, z0, x1, z1] segments. Gaps between
 * segments are doorways (1.8 m single, 3 m double for equipment).
 */
export const PARTITIONS: readonly [number, number, number, number][] = [
  // Corridor north wall (halls and central rooms), with doorways.
  [-41.7, 4, -26, 4], [-23, 4, -10, 4], [-8.5, 4, -1, 4], [1, 4, 10, 4], [13, 4, 26, 4], [29, 4, 41.7, 4],
  // Corridor south wall.
  [-41.7, 8, -33, 8], [-30, 8, -18, 8], [-15, 8, -6, 8], [-4, 8, 7, 8], [10, 8, 20, 8], [23, 8, 33, 8], [36, 8, 41.7, 8],
  // Central block walls (between halls and MMR/core/fire).
  [-7, -25.7, -7, 4], [7, -25.7, 7, 4],
  [-7, -15, -1, -15], [1, -15, 7, -15],
  [-7, -5, -1, -5], [1, -5, 7, -5],
  // South band room dividers.
  [-22, 8, -22, 25.7], [-10, 8, -10, 25.7], [3, 8, 3, 25.7], [15, 8, 15, 25.7], [28.5, 8, 28.5, 25.7],
];

// ---------------------------------------------------------------------------
// Outdoor site
// ---------------------------------------------------------------------------

/** Secure perimeter fence. The gate is a gap in the south side. */
export const FENCE: Rect = { x0: -120, x1: 115, z0: -85, z1: 85 };
export const GATE = { x0: -24, x1: -12, z: FENCE.z1 } as const;
export const GUARD_HOUSE = { x: -30, z: 79 } as const;

export const PARKING: Rect = { x0: -50, x1: 10, z0: 38, z1: 64 };

/** Containerised diesel generators (east yard), N+1 for the facility load. */
export const GENERATORS: readonly { id: string; x: number; z: number }[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
  id: `GEN-${String(i + 1).padStart(2, "0")}`,
  x: i < 4 ? 58 : 76,
  z: -30 + (i % 4) * 13,
}));

/** Bulk diesel storage tanks feeding the generator belly tanks. */
export const FUEL_TANKS: readonly { id: string; x: number; z: number }[] = [
  { id: "FUEL-1", x: 62, z: 30 },
  { id: "FUEL-2", x: 74, z: 30 },
];

/** Outdoor MV/LV transformers along the east wall, two per electrical room. */
export const PAD_TRANSFORMERS: readonly { id: string; x: number; z: number; feed: "A" | "B" }[] = [
  { id: "TX-A1", x: 46.5, z: 11, feed: "A" },
  { id: "TX-A2", x: 46.5, z: 16, feed: "A" },
  { id: "TX-B1", x: 46.5, z: 21, feed: "B" },
  { id: "TX-B2", x: 46.5, z: 26.5, feed: "B" },
];

/** Utility substation in the north-east corner. */
export const SUBSTATION: Rect = { x0: 62, x1: 108, z0: -80, z1: -48 };

/** Incoming high-voltage line: towers from the map edge to the substation. */
export const POWER_LINE_TOWERS: readonly [number, number][] = [
  [330, -64],
  [250, -64],
  [170, -64],
  [118, -64],
];

/** Two diverse fibre entry vaults, on different sides of the building. */
export const FIBER_ENTRIES: readonly { id: "A" | "B"; vault: [number, number]; wall: [number, number] }[] = [
  { id: "A", vault: [-2, -48], wall: [-2, -26] },
  { id: "B", vault: [-62, -18], wall: [-42, -18] },
];

export const WATER_TANK = { x: 90, z: 55, radius: 7, height: 12 } as const;
