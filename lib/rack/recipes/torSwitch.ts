import type { RackItem } from "@/lib/rack/layout";
import { MOUNT_SPECS } from "@/lib/rack/mountSpecs";
import { HARDWARE_COLORS as C, LED_COLORS } from "@/lib/rack/palette";
import { type PartSink, type Vec3, faceFrame, facePoint } from "@/lib/rack/parts";
import { hash01 } from "@/lib/random";
import { DEVICE_BODY_WIDTH, DEVICE_FLANGE_WIDTH, mm } from "@/lib/units";

/** 48 x 25G SFP28 access ports + 8 x 100G QSFP28 uplinks: a typical leaf switch. */
export const ACCESS_PORTS = 48;
export const UPLINK_PORTS = 8;

const ACCESS_PITCH = mm(11.8);
const ACCESS_X0 = mm(-200);
const UPLINK_PITCH = mm(21);
const UPLINK_X0 = mm(105);
const ROW_OFFSET = mm(6.5);
const PORT_OUT = mm(4);

/** Face-local position of a port. Even indices are the top row, odd the bottom row. */
function portLocal(index: number, x0: number, pitch: number): { x: number; dy: number } {
  const col = Math.floor(index / 2);
  return { x: x0 + col * pitch, dy: index % 2 === 0 ? ROW_OFFSET : -ROW_OFFSET };
}

/** Plug-in point of access port `index` (0..47), rack-local. */
export function switchAccessPort(item: RackItem, index: number): Vec3 {
  const { x, dy } = portLocal(index, ACCESS_X0, ACCESS_PITCH);
  return facePoint(faceFrame(item.face), x, item.yCenter + dy, PORT_OUT);
}

/** Plug-in point of uplink port `index` (0..7), rack-local. */
export function switchUplinkPort(item: RackItem, index: number): Vec3 {
  const { x, dy } = portLocal(index, UPLINK_X0, UPLINK_PITCH);
  return facePoint(faceFrame(item.face), x, item.yCenter + dy, PORT_OUT);
}

export interface SwitchContext {
  /** Number of access ports with a server cabled in (ports 0..n-1). */
  readonly connectedAccess: number;
  /** Number of uplinks cabled to the patch panel (ports 0..n-1). */
  readonly connectedUplinks: number;
}

/**
 * Top-of-rack (leaf) switch. Port side faces the rear rails; the opposite end
 * carries hot-swap fans and PSUs.
 */
export function buildTorSwitch(item: RackItem, owner: number, sink: PartSink, ctx: SwitchContext): void {
  const f = faceFrame(item.face);
  const depth = MOUNT_SPECS[item.kind].depth;
  const h = item.height;
  const y = item.yCenter;
  const key = item.id;

  sink.box("metal", facePoint(f, 0, y, -depth / 2), [DEVICE_BODY_WIDTH, h, depth], C.switchBody, owner);
  sink.box("plastic", facePoint(f, 0, y, mm(1.5)), [DEVICE_BODY_WIDTH, h, mm(3)], C.switchFace, owner);
  const earX = DEVICE_FLANGE_WIDTH / 2 - mm(12);
  for (const side of [-1, 1]) {
    sink.box("metal", facePoint(f, side * earX, y, mm(1.5)), [mm(24), h, mm(3)], C.ear, owner);
  }
  // System status LED.
  sink.led(facePoint(f, -earX, y + mm(8), mm(3.5)), mm(3.5), LED_COLORS.green, "solid", owner);

  const portLed = (pos: Vec3, connected: boolean, i: number): void => {
    if (connected) {
      sink.led(pos, mm(2.4), LED_COLORS.green, "activity", owner, 8 + hash01(key, i) * 16, hash01(key, i + 500));
    } else {
      sink.led(pos, mm(2.4), LED_COLORS.green, "off", owner);
    }
  };

  for (let i = 0; i < ACCESS_PORTS; i++) {
    const { x, dy } = portLocal(i, ACCESS_X0, ACCESS_PITCH);
    sink.box("port", facePoint(f, x, y + dy, mm(2)), [mm(10.5), mm(9.5), mm(4)], C.portCage, owner);
    portLed(facePoint(f, x, y + dy + Math.sign(dy) * mm(11), mm(3.5)), i < ctx.connectedAccess, i);
  }
  for (let i = 0; i < UPLINK_PORTS; i++) {
    const { x, dy } = portLocal(i, UPLINK_X0, UPLINK_PITCH);
    sink.box("port", facePoint(f, x, y + dy, mm(2)), [mm(18), mm(9.5), mm(4)], C.portCage, owner);
    portLed(facePoint(f, x + mm(11), y + dy, mm(3.5)), i < ctx.connectedUplinks, 100 + i);
  }

  // Fan/PSU end: 2 PSUs at the edges and 4 fan modules between them.
  const back = -depth;
  for (const side of [-1, 1]) {
    sink.box("metal", facePoint(f, side * mm(165), y, back - mm(2)), [mm(70), h - mm(4), mm(4)], C.psu, owner);
    sink.led(facePoint(f, side * mm(140), y + mm(10), back - mm(4.5)), mm(2.6), LED_COLORS.green, "solid", owner);
  }
  for (let i = 0; i < 4; i++) {
    const fx = mm(-90) + i * mm(60);
    sink.box("metal", facePoint(f, fx, y, back - mm(2)), [mm(50), h - mm(4), mm(4)], C.fanModule, owner);
    sink.led(facePoint(f, fx + mm(18), y + mm(12), back - mm(4.5)), mm(2.2), LED_COLORS.green, "solid", owner);
  }
}
