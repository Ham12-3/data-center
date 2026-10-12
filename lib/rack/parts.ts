import type { RackFace } from "@/types/equipment";
import { FRONT_RAIL_Z, REAR_RAIL_Z } from "@/lib/units";

/**
 * Rack contents are described as flat lists of axis-aligned boxes and LEDs
 * ("parts") in rack-local coordinates. The renderer draws each material bucket
 * with a single InstancedMesh, so a fully populated rack costs a handful of draw
 * calls instead of hundreds. In Phase 2 the same part lists are reused across
 * every rack in the hall by offsetting them with each rack's world transform.
 */

export type Vec3 = readonly [number, number, number];

/** Shared material buckets; per-instance colour tints the shared material. */
export type PartMaterialKey = "metal" | "plastic" | "port";

export interface BoxPart {
  readonly mat: PartMaterialKey;
  /** Centre of the box, rack-local. */
  readonly pos: Vec3;
  readonly size: Vec3;
  readonly color: string;
  /** Index of the owning RackItem, used to map a clicked instance to a device. */
  readonly owner: number;
}

export type BlinkMode = "off" | "solid" | "blink" | "activity";

export interface LedPart {
  readonly pos: Vec3;
  readonly size: Vec3;
  readonly color: string;
  readonly mode: BlinkMode;
  /** Blinks (or activity slots) per second. */
  readonly rate: number;
  /** Phase offset in [0, 1) so LEDs don't blink in lock-step. */
  readonly phase: number;
  readonly owner: number;
}

/** Accumulator the equipment recipes write into. */
export class PartSink {
  readonly boxes: BoxPart[] = [];
  readonly leds: LedPart[] = [];

  box(mat: PartMaterialKey, pos: Vec3, size: Vec3, color: string, owner: number): void {
    this.boxes.push({ mat, pos, size, color, owner });
  }

  led(
    pos: Vec3,
    size: number,
    color: string,
    mode: BlinkMode,
    owner: number,
    rate = 0,
    phase = 0,
  ): void {
    this.leds.push({ pos, size: [size, size, size * 0.5], color, mode, rate, phase, owner });
  }
}

/**
 * Describes a mounting face. Recipes are written in "face-local" terms: x runs
 * left-to-right as seen by a person looking at that face, and `out` is the
 * distance in front of the rail plane (negative = inside the device).
 * Looking at the rear of the rack mirrors X, which `facePoint` handles.
 */
export interface FaceFrame {
  readonly faceZ: number;
  /** +1 for the front face (outward = +Z), -1 for the rear face (outward = -Z). */
  readonly dir: 1 | -1;
}

export function faceFrame(face: RackFace): FaceFrame {
  return face === "front" ? { faceZ: FRONT_RAIL_Z, dir: 1 } : { faceZ: REAR_RAIL_Z, dir: -1 };
}

export function facePoint(frame: FaceFrame, xLocal: number, y: number, out: number): Vec3 {
  return [xLocal * frame.dir, y, frame.faceZ + out * frame.dir];
}
