import type { PowerFeed } from "@/types/equipment";
import type { RackItem } from "@/lib/rack/layout";
import { MOUNT_SPECS } from "@/lib/rack/mountSpecs";
import { HARDWARE_COLORS as C, LED_COLORS } from "@/lib/rack/palette";
import { type PartSink, type Vec3, faceFrame, facePoint } from "@/lib/rack/parts";
import { hash01 } from "@/lib/random";
import { DEVICE_BODY_WIDTH, DEVICE_FLANGE_WIDTH, RU, mm } from "@/lib/units";

/** Face-local X of the two power supplies. PSU A sits on the A-feed (left) side. */
const PSU_X: Record<PowerFeed, number> = { A: mm(-170), B: mm(170) };
const PSU_WIDTH = mm(68);
const PSU_PROTRUDE = mm(6);
const NIC_X = [mm(-72), mm(-52)] as const;

const STATUS_LED: Record<RackItem["status"], { color: string; mode: "solid" | "blink"; rate: number }> = {
  ok: { color: LED_COLORS.green, mode: "solid", rate: 0 },
  warning: { color: LED_COLORS.amber, mode: "blink", rate: 1 },
  fault: { color: LED_COLORS.red, mode: "blink", rate: 3 },
};

/** Y of the rear I/O row (PSUs, NICs): the bottom U of the chassis. */
const rearIoY = (item: RackItem): number => item.yBottom + RU / 2;

/** Z of the rear face of the server chassis. */
const rearZ = (item: RackItem): number => {
  const f = faceFrame(item.face);
  return f.faceZ - f.dir * MOUNT_SPECS[item.kind].depth;
};

/** Where a power cord plugs into the server's C14 inlet (rack-local). */
export function serverPsuInlet(item: RackItem, feed: PowerFeed): Vec3 {
  const f = faceFrame(item.face);
  return [PSU_X[feed] * f.dir, rearIoY(item), rearZ(item) - f.dir * PSU_PROTRUDE];
}

/** Where a network cable plugs into one of the server's two NIC ports. */
export function serverNicPort(item: RackItem, index: 0 | 1): Vec3 {
  const f = faceFrame(item.face);
  return [NIC_X[index] * f.dir, rearIoY(item), rearZ(item) - f.dir * mm(5)];
}

/**
 * 1U and 2U general-purpose servers.
 * Front: bezel, drive caddies with activity LEDs, power + health LEDs on the ears.
 * Rear: two hot-swap PSUs (one per power feed), two NIC ports, a BMC port.
 */
export function buildServer(item: RackItem, owner: number, sink: PartSink): void {
  const f = faceFrame(item.face);
  const depth = MOUNT_SPECS[item.kind].depth;
  const h = item.height;
  const y = item.yCenter;
  const key = item.id;

  // Chassis body, starting just behind the front rail.
  sink.box("metal", facePoint(f, 0, y, -depth / 2), [DEVICE_BODY_WIDTH, h, depth], C.chassisLid, owner);

  // Front bezel and rack ears.
  sink.box("plastic", facePoint(f, 0, y, mm(1.5)), [DEVICE_BODY_WIDTH, h, mm(3)], C.bezel, owner);
  const earX = DEVICE_FLANGE_WIDTH / 2 - mm(12);
  for (const side of [-1, 1]) {
    sink.box("metal", facePoint(f, side * earX, y, mm(1.5)), [mm(24), h, mm(3)], C.ear, owner);
  }

  // Power LED (left ear) and system health LED (right ear).
  const ledY = y + h * 0.22;
  sink.led(facePoint(f, -earX, ledY, mm(3.5)), mm(4), LED_COLORS.green, "solid", owner);
  const status = STATUS_LED[item.status];
  sink.led(facePoint(f, earX, ledY, mm(3.5)), mm(4), status.color, status.mode, owner, status.rate, hash01(key, 99));

  // Drive caddies: 1U = 10 x 2.5" in a row, 2U = 12 x 3.5" in a 4 x 3 grid.
  const grid = item.heightU === 1 ? { cols: 10, rows: 1, w: mm(31) } : { cols: 4, rows: 3, w: mm(98) };
  const gap = mm(4);
  const rowH = (h - mm(8)) / grid.rows - mm(2);
  const span = grid.cols * grid.w + (grid.cols - 1) * gap;
  let n = 0;
  for (let r = 0; r < grid.rows; r++) {
    const cy = y - h / 2 + mm(4) + rowH / 2 + r * (rowH + mm(2)) + mm(1);
    for (let c = 0; c < grid.cols; c++) {
      const cx = -span / 2 + grid.w / 2 + c * (grid.w + gap);
      const color = n % 2 === 0 ? C.driveCaddy : C.driveCaddyLight;
      sink.box("plastic", facePoint(f, cx, cy, mm(4)), [grid.w, rowH, mm(5)], color, owner);
      // Drive activity LED flickers at a per-drive rate so the front looks alive.
      const ledPos =
        grid.rows === 1
          ? facePoint(f, cx, cy + rowH / 2 - mm(3), mm(6.8))
          : facePoint(f, cx + grid.w / 2 - mm(5), cy, mm(6.8));
      sink.led(ledPos, mm(2.6), LED_COLORS.green, "activity", owner, 5 + hash01(key, n) * 10, hash01(key, n + 50));
      n++;
    }
  }

  // Rear plate.
  const back = -depth;
  sink.box("port", facePoint(f, 0, y, back - mm(1)), [DEVICE_BODY_WIDTH, h, mm(2)], C.rearPlate, owner);

  // Rear I/O row (bottom U of the chassis).
  const ioY = rearIoY(item);
  const psuH = Math.min(RU - mm(5), mm(40));
  for (const feed of ["A", "B"] as const) {
    const px = PSU_X[feed];
    sink.box("metal", facePoint(f, px, ioY, back - PSU_PROTRUDE / 2), [PSU_WIDTH, psuH, PSU_PROTRUDE], C.psu, owner);
    // C14 inlet and PSU OK LED.
    sink.box("port", facePoint(f, px, ioY, back - PSU_PROTRUDE - mm(1)), [mm(24), mm(16), mm(2)], C.inlet, owner);
    sink.led(facePoint(f, px + (feed === "A" ? 1 : -1) * mm(24), ioY + mm(10), back - PSU_PROTRUDE - mm(1)), mm(3), LED_COLORS.green, "solid", owner);
  }

  // Two SFP28 NIC ports with link/activity LEDs, plus the BMC management port.
  NIC_X.forEach((nx, i) => {
    sink.box("port", facePoint(f, nx, ioY, back - mm(3)), [mm(14), mm(10), mm(4)], C.portCage, owner);
    sink.led(facePoint(f, nx, ioY + mm(9), back - mm(2.5)), mm(2.5), LED_COLORS.green, "activity", owner, 8 + hash01(key, 200 + i) * 12, hash01(key, 210 + i));
  });
  sink.box("port", facePoint(f, mm(50), ioY, back - mm(3)), [mm(16), mm(13), mm(4)], C.portCage, owner);
  sink.led(facePoint(f, mm(50) + mm(10), ioY + mm(5), back - mm(2.5)), mm(2.2), LED_COLORS.amber, "solid", owner);
}
