import { CORE_RACKS, HALL_A_RACKS, HALL_B_LAYOUT, MMR_RACKS, type RackPlacement } from "@/data/halls";
import { HALL_A_CRAHS } from "@/lib/sim/facility";
import { GPU_RACK } from "@/lib/rack/gpuRack";
import { BUILDING, FENCE, FUEL_TANKS, GATE, GENERATORS, GUARD_HOUSE, PAD_TRANSFORMERS, PARTITIONS, type Rect, WATER_TANK, roomById } from "@/data/site";
import { CARRIER_CAGES } from "@/data/halls";

/**
 * Walk-mode collision world: the player is a circle moving on the floor
 * plane, and every obstacle is an axis-aligned rectangle in X/Z (walls, rack
 * rows, equipment). Pure data and maths, so it can be tested on its own.
 */

export type Box2 = Rect;

const box = (cx: number, cz: number, w: number, d: number): Box2 => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

/** Footprint of a rack placement (rotations are multiples of 90°). */
function rackBox(p: RackPlacement, width: number, depth: number): Box2 {
  const sideways = Math.abs(Math.sin(p.rotationY)) > 0.5;
  return box(p.position[0], p.position[2], sideways ? depth : width, sideways ? width : depth);
}

/** Main entrance opening in the south facade (the glazed lobby front). */
export const ENTRANCE = { x0: -20.5, x1: -11.5 } as const;

function buildingWalls(): Box2[] {
  const F = BUILDING.footprint;
  const t = BUILDING.wallThickness;
  const walls: Box2[] = [
    { x0: F.x0, x1: F.x1, z0: F.z0, z1: F.z0 + t },
    { x0: F.x0, x1: F.x0 + t, z0: F.z0, z1: F.z1 },
    { x0: F.x1 - t, x1: F.x1, z0: F.z0, z1: F.z1 },
    { x0: F.x0, x1: ENTRANCE.x0, z0: F.z1 - t, z1: F.z1 },
    { x0: ENTRANCE.x1, x1: F.x1, z0: F.z1 - t, z1: F.z1 },
  ];
  for (const [x0, z0, x1, z1] of PARTITIONS) {
    walls.push({ x0: Math.min(x0, x1) - 0.1, x1: Math.max(x0, x1) + 0.1, z0: Math.min(z0, z1) - 0.1, z1: Math.max(z0, z1) + 0.1 });
  }
  return walls;
}

function hallEquipment(): Box2[] {
  const list: Box2[] = [];
  for (const r of HALL_A_RACKS) list.push(rackBox(r, 0.6, 1.2));
  for (const r of HALL_B_LAYOUT.racks) list.push(rackBox(r, GPU_RACK.width, GPU_RACK.depth));
  for (const c of HALL_B_LAYOUT.cdus) list.push(box(c.position[0], c.position[2], 1.2, 0.75));
  for (const r of [...CORE_RACKS, ...MMR_RACKS]) list.push(rackBox(r, 0.6, 1.2));
  for (const c of HALL_A_CRAHS) list.push(box(c.x, c.z, 3.1, 1.07));
  const hallB = roomById("hallB").rect;
  for (let i = 0; i < 7; i++) list.push(box(10.5 + i * 4.4, hallB.z0 + 0.81, 3.05, 1.52));
  return list;
}

/** Plant and furniture in the support rooms (positions mirror the zone components). */
function roomEquipment(): Box2[] {
  const list: Box2[] = [];
  // Cooling plant: chillers (with control panels), pumps, heat exchanger, buffer tank.
  for (const z of [11.2, 15.2, 19.2]) list.push({ x0: -38.3, x1: -32.7, z0: z - 1.1, z1: z + 1.7 });
  for (let i = 0; i < 8; i++) list.push(box(-27.2, 10.6 + i * 1.6, 1.6, 0.7));
  list.push(box(-24.4, 22.5, 0.9, 2.4), box(-39.8, 24, 1.8, 1.8));
  // Electrical rooms: switchboards, ATS, UPS, mechanical switchboard.
  for (const id of ["elecA", "elecB"] as const) {
    const r = roomById(id).rect;
    const cx = (r.x0 + r.x1) / 2;
    list.push(box(cx - 1.2, r.z0 + 4.2, 6.4, 1.0), box(r.x1 - 1.4, r.z0 + 4.2, 1.6, 1.0), box(cx, r.z1 - 1.2, 4.0, 1.0));
    for (let i = 0; i < 3; i++) list.push(box(r.x0 + 2.2 + i * 3.1, r.z0 + 9, 2.65, 0.91));
  }
  // Battery strings.
  const bat = roomById("battery").rect;
  for (const z of [bat.z0 + 3.4, bat.z0 + 6.8, bat.z1 - 5.6, bat.z1 - 2.2]) list.push({ x0: bat.x0 + 1.6, x1: bat.x0 + 10.0, z0: z - 0.55, z1: z + 0.55 });
  // NOC: video wall and the curved rows of desks.
  const noc = roomById("noc").rect;
  const ncx = (noc.x0 + noc.x1) / 2;
  const wallZ = noc.z0 + 0.25;
  list.push(box(ncx, wallZ + 0.1, 8.2, 0.6));
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.12;
      const rad = 6 + row * 2.4;
      list.push(box(ncx + Math.sin(a) * rad, wallZ + Math.cos(a) * rad, 1.6, 0.8));
    }
  }
  // Lobby: security desk, speed-gate posts, mantrap side glass.
  list.push(box(-19.4, 18.2, 4.2, 0.9));
  for (const x of [-17.8, -16.6, -15.4, -14.2]) list.push(box(x, 14, 0.22, 1.4));
  list.push({ x0: -17.45, x1: -17.35, z0: 8.4, z1: 10.2 }, { x0: -15.65, x1: -15.55, z0: 8.4, z1: 10.2 });
  // Meet-Me Room cages, cross-connect frames and entrance cabinets; fire room cylinder banks.
  for (const c of CARRIER_CAGES) list.push(box(c.x, c.z, 3.2, 2.8));
  list.push({ x0: -1.5, x1: 1.5, z0: -20.7, z1: -20.3 }, box(0, -25.2, 0.9, 0.5), box(-6.55, -20.5, 0.5, 0.9));
  list.push({ x0: -6.4, x1: -3.0, z0: -4.8, z1: -4.3 }, { x0: 0.6, x1: 4.0, z0: -4.8, z1: -4.3 });
  return list;
}

function siteObstacles(): Box2[] {
  const list: Box2[] = [];
  for (const g of GENERATORS) list.push(box(g.x, g.z, 12.2, 2.6));
  for (const t of FUEL_TANKS) list.push(box(t.x, t.z, 13, 5.2));
  for (const t of PAD_TRANSFORMERS) list.push(box(t.x, t.z, 3.2, 3.6));
  list.push(box(GUARD_HOUSE.x, GUARD_HOUSE.z, 5, 4));
  list.push(box(WATER_TANK.x, WATER_TANK.z, WATER_TANK.radius * 2 + 2, WATER_TANK.radius * 2 + 2));
  // Perimeter fence, with the gate gap on the south side.
  const t = 0.15;
  list.push(
    { x0: FENCE.x0, x1: FENCE.x1, z0: FENCE.z0 - t, z1: FENCE.z0 + t },
    { x0: FENCE.x0 - t, x1: FENCE.x0 + t, z0: FENCE.z0, z1: FENCE.z1 },
    { x0: FENCE.x1 - t, x1: FENCE.x1 + t, z0: FENCE.z0, z1: FENCE.z1 },
    { x0: FENCE.x0, x1: GATE.x0, z0: FENCE.z1 - t, z1: FENCE.z1 + t },
    { x0: GATE.x1, x1: FENCE.x1, z0: FENCE.z1 - t, z1: FENCE.z1 + t },
  );
  return list;
}

/** Every obstacle in the world. */
export function buildCollisionWorld(): Box2[] {
  return [...buildingWalls(), ...hallEquipment(), ...roomEquipment(), ...siteObstacles()];
}

const HALL_A = roomById("hallA").rect;

/** Floor height at a point: Data Hall A sits on a 600 mm raised floor. */
export function floorHeightAt(x: number, z: number): number {
  return x > HALL_A.x0 && x < HALL_A.x1 && z > HALL_A.z0 && z < HALL_A.z1 ? BUILDING.raisedFloor : 0;
}

/**
 * Move a circle of `radius` from `from` by `delta`, sliding along obstacles.
 * Each pass pushes the circle out of every overlapping box along the shortest
 * direction: from the box's closest point when the centre is outside, or out
 * through the nearest face when the centre is inside. The move is split into
 * sub-steps no longer than the radius so fast movement cannot tunnel through walls.
 */
export function resolveMove(
  from: { x: number; z: number },
  delta: { x: number; z: number },
  radius: number,
  boxes: readonly Box2[],
): { x: number; z: number } {
  const len = Math.hypot(delta.x, delta.z);
  const steps = Math.max(1, Math.ceil(len / (radius * 0.8)));
  let x = from.x;
  let z = from.z;
  for (let s = 0; s < steps; s++) {
    x += delta.x / steps;
    z += delta.z / steps;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const b of boxes) {
        if (x < b.x0 - radius || x > b.x1 + radius || z < b.z0 - radius || z > b.z1 + radius) continue;
        const cx = Math.min(b.x1, Math.max(b.x0, x));
        const cz = Math.min(b.z1, Math.max(b.z0, z));
        const dx = x - cx;
        const dz = z - cz;
        const d = Math.hypot(dx, dz);
        if (d >= radius) continue;
        moved = true;
        if (d > 1e-6) {
          x = cx + (dx / d) * radius;
          z = cz + (dz / d) * radius;
        } else {
          // Centre inside the box: leave through the closest face.
          const exits = [
            { v: x - b.x0 + radius, ax: "x", dir: -1 },
            { v: b.x1 - x + radius, ax: "x", dir: 1 },
            { v: z - b.z0 + radius, ax: "z", dir: -1 },
            { v: b.z1 - z + radius, ax: "z", dir: 1 },
          ].sort((p, q) => p.v - q.v)[0];
          if (exits.ax === "x") x += exits.dir * exits.v;
          else z += exits.dir * exits.v;
        }
      }
      if (!moved) break;
    }
  }
  return { x, z };
}
