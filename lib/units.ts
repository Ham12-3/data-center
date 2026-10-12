/**
 * World units: 1 unit = 1 metre, Y is up.
 *
 * Rack-local frame (used by everything under lib/rack):
 *   origin = centre of the rack footprint at floor level
 *   +Z     = front of the rack (cold aisle side)
 *   -Z     = rear of the rack (hot aisle side)
 *   +X     = right-hand side when standing in front of the rack
 */

/** Convert millimetres to metres. */
export const mm = (value: number): number => value / 1000;

/** One rack unit (EIA-310): 1.75 in = 44.45 mm. */
export const RU = mm(44.45);

/** Number of usable rack units in a standard full-height rack. */
export const RACK_UNITS = 42;

/** External rack dimensions (a common 600 x 1200 x 2000 mm enclosure). */
export const RACK_WIDTH = mm(600);
export const RACK_DEPTH = mm(1200);
export const RACK_HEIGHT = mm(2000);

/** Height of the plinth/castor base below U1. */
export const RACK_BASE_HEIGHT = mm(70);

/** Bottom edge of U1. U numbering counts upwards from the bottom (EIA convention). */
export const RACK_U0 = RACK_BASE_HEIGHT + mm(10);

/** Mounting rail planes. Equipment ears bolt to these. */
export const FRONT_RAIL_Z = mm(480);
export const REAR_RAIL_Z = mm(-260);

/** Rail centre offset from the rack centre line (19 in flange = 482.6 mm overall). */
export const RAIL_X = mm(233.5);

/** Width of a 19-inch device body (17.1 in) and its mounting flange. */
export const DEVICE_BODY_WIDTH = mm(434);
export const DEVICE_FLANGE_WIDTH = mm(482.6);

/** Bottom edge (Y) of a given rack unit, 1-based. */
export const uBottom = (u: number): number => RACK_U0 + (u - 1) * RU;

/** Vertical centre (Y) of a device starting at `uStart` and spanning `heightU`. */
export const uCenter = (uStart: number, heightU: number): number =>
  uBottom(uStart) + (heightU * RU) / 2;

/**
 * Physical height of a device spanning `heightU`. Real kit is slightly shorter
 * than its nominal U so adjacent devices don't bind: 1U ≈ 43.2 mm.
 */
export const deviceHeight = (heightU: number): number => heightU * RU - mm(1.2);
