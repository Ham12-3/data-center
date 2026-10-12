import type { PowerFeed } from "@/types/equipment";
import type { Vec3 } from "@/lib/rack/parts";
import { RACK_UNITS, mm, uCenter } from "@/lib/units";

/**
 * Zero-U vertical rack PDUs, mounted in the rear corners. Feed A on the left
 * (-X), feed B on the right (+X). Outlets face inwards, one per rack unit, so a
 * server's cords take the shortest path to the outlet at its own height.
 */

export const PDU_WIDTH = mm(52);
export const PDU_DEPTH = mm(56);
export const PDU_CENTER_Z = mm(-500);
export const PDU_BOTTOM = mm(150);
export const PDU_TOP = mm(1945);
export const PDU_HEIGHT = PDU_TOP - PDU_BOTTOM;

/** Signed X of the PDU centre line for each feed. */
export const PDU_X: Record<PowerFeed, number> = { A: mm(-262), B: mm(262) };

/** Outlets cover U2..U41. Every 7th position is a larger C19 outlet. */
export const PDU_FIRST_OUTLET_U = 2;
export const PDU_LAST_OUTLET_U = RACK_UNITS - 1;

export interface PduOutlet {
  readonly u: number;
  readonly type: "C13" | "C19";
  /** Centre of the outlet face, rack-local. */
  readonly pos: Vec3;
}

/** X of the inward-facing outlet surface for a feed. */
export function pduOutletFaceX(feed: PowerFeed): number {
  const inward = feed === "A" ? 1 : -1;
  return PDU_X[feed] + inward * (PDU_WIDTH / 2 + mm(6));
}

export function pduOutlets(feed: PowerFeed): PduOutlet[] {
  const outlets: PduOutlet[] = [];
  for (let u = PDU_FIRST_OUTLET_U; u <= PDU_LAST_OUTLET_U; u++) {
    outlets.push({
      u,
      type: (u - PDU_FIRST_OUTLET_U) % 7 === 6 ? "C19" : "C13",
      pos: [pduOutletFaceX(feed), uCenter(u, 1), PDU_CENTER_Z],
    });
  }
  return outlets;
}

/** The outlet a device starting at `u` plugs into (clamped to the outlet range). */
export function pduOutletForU(feed: PowerFeed, u: number): Vec3 {
  const clamped = Math.min(PDU_LAST_OUTLET_U, Math.max(PDU_FIRST_OUTLET_U, u));
  return [pduOutletFaceX(feed), uCenter(clamped, 1), PDU_CENTER_Z];
}
