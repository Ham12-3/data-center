import type { RackItem } from "@/lib/rack/layout";
import { MOUNT_SPECS } from "@/lib/rack/mountSpecs";
import { HARDWARE_COLORS as C, LED_COLORS } from "@/lib/rack/palette";
import { type PartSink, faceFrame, facePoint } from "@/lib/rack/parts";
import { hash01 } from "@/lib/random";
import { DEVICE_BODY_WIDTH, DEVICE_FLANGE_WIDTH, mm } from "@/lib/units";

/** Shared chassis: body, faceplate, ears and a status LED. */
function chassis(item: RackItem, owner: number, sink: PartSink, body: string, face: string): void {
  const f = faceFrame(item.face);
  const depth = MOUNT_SPECS[item.kind].depth;
  const y = item.yCenter;
  const h = item.height;
  sink.box("metal", facePoint(f, 0, y, -depth / 2), [DEVICE_BODY_WIDTH, h, depth], body, owner);
  sink.box("plastic", facePoint(f, 0, y, mm(1.5)), [DEVICE_BODY_WIDTH, h, mm(3)], face, owner);
  const earX = DEVICE_FLANGE_WIDTH / 2 - mm(12);
  for (const side of [-1, 1]) sink.box("metal", facePoint(f, side * earX, y, mm(1.5)), [mm(24), h, mm(3)], C.ear, owner);
  sink.led(facePoint(f, -earX, y + h / 2 - mm(10), mm(3.5)), mm(3.5), LED_COLORS.green, "solid", owner);
}

/**
 * 2U spine switch, e.g. 64 x 800G OSFP (51.2 Tb/s), in two rows of 32 cages.
 * Every leaf in the facility has an uplink to every spine.
 */
export function buildSpineSwitch(item: RackItem, owner: number, sink: PartSink): void {
  chassis(item, owner, sink, C.switchBody, C.switchFace);
  const f = faceFrame(item.face);
  const cols = 32;
  const pitch = mm(12.4);
  const x0 = -((cols - 1) * pitch) / 2;
  for (let i = 0; i < cols * 2; i++) {
    const col = Math.floor(i / 2);
    const dy = i % 2 === 0 ? mm(11) : mm(-11);
    const x = x0 + col * pitch;
    sink.box("port", facePoint(f, x, item.yCenter + dy, mm(3)), [mm(11), mm(14), mm(5)], "#9aa3ad", owner);
    sink.led(
      facePoint(f, x, item.yCenter + dy + Math.sign(dy) * mm(10.5), mm(3.5)),
      mm(2.4),
      LED_COLORS.green,
      "activity",
      owner,
      10 + hash01(item.id, i) * 14,
      hash01(item.id, i + 300),
    );
  }
}

/**
 * 4U modular border router: four horizontal line cards of 12 x 400G QSFP-DD.
 * It peers with carriers over the cross-connects from the Meet-Me Room.
 */
export function buildBorderRouter(item: RackItem, owner: number, sink: PartSink): void {
  chassis(item, owner, sink, "#262a30", "#1b1e22");
  const f = faceFrame(item.face);
  const cardH = item.height / 4;
  for (let c = 0; c < 4; c++) {
    const cy = item.yBottom + cardH * (c + 0.5);
    sink.box("plastic", facePoint(f, 0, cy, mm(4)), [mm(400), cardH - mm(3), mm(3)], "#30353c", owner);
    for (let i = 0; i < 12; i++) {
      const x = mm(-150) + i * mm(25);
      sink.box("port", facePoint(f, x, cy, mm(6)), [mm(19), mm(10), mm(5)], "#9aa3ad", owner);
      const lit = hash01(item.id, c * 12 + i) > 0.3;
      sink.led(facePoint(f, x + mm(11.5), cy, mm(6)), mm(2.4), LED_COLORS.green, lit ? "activity" : "off", owner, 6 + hash01(item.id, 99 + i) * 10, hash01(item.id, 140 + i));
    }
    sink.led(facePoint(f, mm(185), cy, mm(6)), mm(3), LED_COLORS.green, "solid", owner);
  }
}
