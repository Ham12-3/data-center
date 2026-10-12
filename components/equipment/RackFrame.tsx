import type { ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rackMaterials } from "@/lib/three/materials";
import {
  FRONT_RAIL_Z,
  RACK_BASE_HEIGHT,
  RACK_DEPTH,
  RACK_HEIGHT,
  RACK_U0,
  RACK_UNITS,
  RACK_WIDTH,
  RAIL_X,
  REAR_RAIL_Z,
  RU,
  mm,
} from "@/lib/units";

type V3 = [number, number, number];
interface BoxSpec {
  readonly pos: V3;
  readonly size: V3;
}

const ROOF_H = mm(30);
const POST = mm(30);
const PANEL_T = mm(8);
const BODY_H = RACK_HEIGHT - RACK_BASE_HEIGHT - ROOF_H;
const BODY_Y = RACK_BASE_HEIGHT + BODY_H / 2;
const RAIL_H = RACK_UNITS * RU + mm(10);
const RAIL_Y = RACK_U0 + (RACK_UNITS * RU) / 2;
const RAIL_SPAN = FRONT_RAIL_Z - REAR_RAIL_Z;
const W = RACK_WIDTH;
const D = RACK_DEPTH;

/** Plinth, roof and corner posts (powder-coated frame). */
const FRAME: BoxSpec[] = [
  { pos: [0, RACK_BASE_HEIGHT / 2, 0], size: [W, RACK_BASE_HEIGHT, D] },
  { pos: [0, RACK_HEIGHT - ROOF_H / 2, 0], size: [W, ROOF_H, D] },
  ...[-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): BoxSpec => ({ pos: [sx * (W / 2 - POST / 2), BODY_Y, sz * (D / 2 - POST / 2)], size: [POST, BODY_H, POST] })),
  ),
];

const SIDES: BoxSpec[] = [-1, 1].map((sx) => ({ pos: [sx * (W / 2 - PANEL_T / 2), BODY_Y, 0], size: [PANEL_T, BODY_H, D - 2 * POST] }));

/** 19" mounting rails (device ears sit in front of the rail plane) and the side braces joining them. */
const RAILS: BoxSpec[] = [
  ...[-1, 1].flatMap((sx): BoxSpec[] => [
    { pos: [sx * RAIL_X, RAIL_Y, FRONT_RAIL_Z - mm(15)], size: [mm(16), RAIL_H, mm(30)] },
    { pos: [sx * RAIL_X, RAIL_Y, REAR_RAIL_Z + mm(15)], size: [mm(16), RAIL_H, mm(30)] },
  ]),
  ...[-1, 1].flatMap((sx) =>
    [RACK_U0 - mm(15), RACK_U0 + RACK_UNITS * RU + mm(15)].map(
      (y): BoxSpec => ({ pos: [sx * (RAIL_X + mm(20)), y, (FRONT_RAIL_Z + REAR_RAIL_Z) / 2], size: [mm(16), mm(30), RAIL_SPAN] }),
    ),
  ),
];

/** Bake a list of boxes into one geometry. */
function mergeBoxes(specs: readonly BoxSpec[]): THREE.BufferGeometry {
  const parts = specs.map((b) => new THREE.BoxGeometry(...b.size).translate(...b.pos));
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("Rack frame merge failed");
  return merged;
}

/** Built once, shared by every detailed rack. */
const GEOMETRY = {
  frame: mergeBoxes(FRAME),
  sides: mergeBoxes(SIDES),
  rails: mergeBoxes(RAILS),
};

/**
 * Static rack enclosure: plinth, roof, corner posts, side panels and 19" rails.
 * Pre-merged into three meshes (one per material) instead of ~20 separate boxes.
 */
export function RackFrame(): ReactNode {
  return (
    <group>
      <mesh geometry={GEOMETRY.frame} material={rackMaterials.frame} castShadow receiveShadow />
      <mesh geometry={GEOMETRY.sides} material={rackMaterials.sidePanel} castShadow receiveShadow />
      <mesh geometry={GEOMETRY.rails} material={rackMaterials.rail} receiveShadow />
    </group>
  );
}
