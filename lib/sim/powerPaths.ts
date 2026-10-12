import type { Vec3 } from "@/lib/rack/parts";
import { GENERATORS, roomById } from "@/data/site";

/**
 * Physical routes of the two independent power paths (2N), from the utility
 * substation to the data halls, plus the generator paths into each ATS.
 * Each node marks a stage where the UI shows the power flowing through it.
 */

export type PowerNodeKind = "grid" | "transformer" | "ats" | "switchboard" | "ups" | "battery" | "hallA" | "hallB";

export interface PowerNode {
  readonly kind: PowerNodeKind;
  readonly label: string;
  readonly position: Vec3;
}

export interface PowerPath {
  readonly feed: "A" | "B";
  readonly points: readonly Vec3[];
  /** Utility side: substation to the ATS (dark during a grid outage). */
  readonly upstream: readonly Vec3[];
  /** ATS to the halls (fed by utility or generators, always live thanks to the UPS). */
  readonly downstream: readonly Vec3[];
  readonly nodes: readonly PowerNode[];
  /** Branch from the UPS to the batteries (DC link). */
  readonly battery: readonly Vec3[];
  /** Branch from the UPS output busway to Hall B. */
  readonly hallB: readonly Vec3[];
}

const elec = (feed: "A" | "B") => roomById(feed === "A" ? "elecA" : "elecB").rect;
const Y = 0.35; // underground / trench level, drawn just above the surface

function feedPath(feed: "A" | "B"): PowerPath {
  const r = elec(feed);
  const cx = (r.x0 + r.x1) / 2;
  const tx: Vec3 = feed === "A" ? [46.5, 2.2, 11] : [46.5, 2.2, 21];
  const subX = feed === "A" ? 79 : 79;
  const subZ = feed === "A" ? -70 : -58;
  const ats: Vec3 = [r.x1 - 1.4, 2.4, r.z0 + 4.2];
  const msb: Vec3 = [cx - 1.2, 2.4, r.z0 + 4.2];
  const ups: Vec3 = [r.x0 + 5.3, 2.2, r.z0 + 9];
  const busway: Vec3 = [cx, 3.4, r.z0 - 2.2];
  const hallAPdu: Vec3 = [-8.6, 2.4, feed === "A" ? -1.5 : 0.2];
  const points: Vec3[] = [
    [subX, 5.5, subZ],
    [subX - 4, Y, subZ],
    [56 + (feed === "A" ? 0 : 0.8), Y, subZ],
    [56 + (feed === "A" ? 0 : 0.8), Y, tx[2]],
    [tx[0] + 1.6, Y, tx[2]],
    tx,
    [41.7, Y + 0.6, tx[2]],
    [ats[0], Y + 0.6, tx[2]],
    ats,
    msb,
    [msb[0], 2.4, ups[2]],
    ups,
    [ups[0], 3.4, ups[2]],
    [ups[0], 3.4, busway[2]],
    busway,
    [busway[0], 3.4, 6 + (feed === "A" ? 0 : 0.6)],
    [hallAPdu[0], 3.4, 6 + (feed === "A" ? 0 : 0.6)],
    [hallAPdu[0], 3.4, hallAPdu[2]],
    hallAPdu,
  ];
  const battery: Vec3 = [9, 1.4, feed === "A" ? r.z0 + 3.4 : r.z1 - 5.6];
  // Index of the ATS in `points`: everything before it is utility-side.
  const atsIndex = points.indexOf(ats);
  return {
    feed,
    points,
    upstream: points.slice(0, atsIndex + 1),
    downstream: points.slice(atsIndex),
    nodes: [
      { kind: "grid", label: `Utility feed ${feed}`, position: [subX, 7, subZ] },
      { kind: "transformer", label: `Transformer ${feed}`, position: [tx[0], 3.6, tx[2]] },
      { kind: "ats", label: `ATS-${feed}`, position: [ats[0], 3.2, ats[2]] },
      { kind: "ups", label: `UPS-${feed}`, position: [ups[0], 3.0, ups[2]] },
      { kind: "hallA", label: `Hall A feed ${feed}`, position: [hallAPdu[0], 3.0, hallAPdu[2]] },
    ],
    battery: [[ups[0], 1.0, ups[2]], [ups[0], 1.0, battery[2] + 0.8], [battery[0], 1.0, battery[2] + 0.8], battery],
    hallB: [
      [busway[0], 3.4, 6 + (feed === "A" ? 0 : 0.6)],
      [12 + (feed === "A" ? 0 : 0.5), 3.4, 6 + (feed === "A" ? 0 : 0.6)],
      [12 + (feed === "A" ? 0 : 0.5), 3.4, -5],
      [16, 2.9, -5],
    ],
  };
}

export const POWER_PATHS: readonly PowerPath[] = [feedPath("A"), feedPath("B")];

/** Generator outputs run through the cable trench to the ATS of each path. */
export const GENERATOR_PATHS: readonly (readonly Vec3[])[] = (["A", "B"] as const).map((feed) => {
  const r = elec(feed);
  const gens = GENERATORS.filter((_, i) => (feed === "A" ? i < 4 : i >= 4));
  const gx = gens[0].x - 6;
  return [
    [gx, Y, gens[0].z],
    [gx, Y, 4],
    [51.4 + (feed === "A" ? 0 : 0.6), Y, 4],
    [41.7, Y + 0.6, 4 + (feed === "A" ? 0 : 0.6)],
    [r.x1 - 1.4, Y + 0.6, 4 + (feed === "A" ? 0 : 0.6)],
    [r.x1 - 1.4, 2.4, r.z0 + 4.2],
  ];
});
