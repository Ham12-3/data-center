import type { EquipmentTypeId } from "@/types/equipment";
import { LED_COLORS } from "./palette";
import { PartSink, type Vec3 } from "./parts";
import { hash01 } from "@/lib/random";
import { RU, mm } from "@/lib/units";

/**
 * NVIDIA GB200 NVL72-class rack (MGX, 48U): 600 W x 1068 D x 2236 H mm,
 * ~120-132 kW, ~85% of the heat removed by liquid.
 * Sources: NVIDIA DGX GB200 docs, Supermicro / GIGABYTE / HPE datasheets (see docs/research.md).
 */
export const GPU_RACK = {
  width: mm(600),
  depth: mm(1068),
  height: mm(2236),
  units: 48,
  u0: mm(70),
  frontZ: mm(470),
  trayDepth: mm(780),
} as const;

export interface GpuRackItem {
  readonly index: number;
  readonly type: EquipmentTypeId;
  readonly label: string;
  readonly uStart: number;
  readonly heightU: number;
  readonly yCenter: number;
}

const uY = (u: number): number => GPU_RACK.u0 + (u - 1) * RU;

/**
 * Tray stack, bottom to top. 18 compute trays (2 Grace CPUs + 4 Blackwell
 * GPUs each = 72 GPUs) are split 8 / 10 around 9 NVLink switch trays, so every
 * GPU sits close to the switches. Power shelves sit at both ends of the stack.
 * Exact order varies by vendor; this follows GIGABYTE's spec list.
 */
export function gpuRackItems(): GpuRackItem[] {
  const items: GpuRackItem[] = [];
  const push = (type: EquipmentTypeId, label: string, uStart: number) =>
    items.push({ index: items.length, type, label, uStart, heightU: 1, yCenter: uY(uStart) + RU / 2 });
  let u = 2;
  for (let i = 0; i < 4; i++) push("power-shelf", `Power shelf ${i + 1} (33 kW)`, u++);
  for (let i = 0; i < 8; i++) push("gpu-compute-tray", `Compute tray ${i + 1}`, u++);
  for (let i = 0; i < 9; i++) push("nvlink-switch-tray", `NVLink switch tray ${i + 1}`, u++);
  for (let i = 0; i < 10; i++) push("gpu-compute-tray", `Compute tray ${i + 9}`, u++);
  push("tor-switch", "Management switch (1 GbE)", u++);
  for (let i = 0; i < 4; i++) push("power-shelf", `Power shelf ${i + 5} (33 kW)`, u++);
  return items;
}

const BODY_W = mm(440);
const FACE = (out: number): number => GPU_RACK.frontZ + out;
const REAR_Z = GPU_RACK.frontZ - GPU_RACK.trayDepth;

/** Build all boxes and LEDs of the populated rack (frame excluded). */
export function buildGpuRackParts(items: readonly GpuRackItem[], key: string): PartSink {
  const sink = new PartSink();
  const h = RU - mm(1.2);

  for (const it of items) {
    const y = it.yCenter;
    const o = it.index;
    const trayColor = it.type === "power-shelf" ? "#3a3f46" : "#23272d";
    // Tray body and faceplate.
    sink.box("metal", [0, y, GPU_RACK.frontZ - GPU_RACK.trayDepth / 2], [BODY_W, h, GPU_RACK.trayDepth], "#8f969e", o);
    sink.box("plastic", [0, y, FACE(mm(1.5))], [BODY_W, h, mm(3)], trayColor, o);

    if (it.type === "gpu-compute-tray") {
      // Green accent, 4 E1.S drives, vent field, 4 x 400G OSFP (ConnectX-7),
      // 2 x BlueField-3 ports and a BMC port.
      sink.box("plastic", [mm(-208), y, FACE(mm(3.2))], [mm(6), h - mm(6), mm(1)], "#76b900", o);
      sink.led([mm(-196), y + mm(10), FACE(mm(3.5))], mm(3), LED_COLORS.green, "solid", o);
      for (let d = 0; d < 4; d++) {
        const x = mm(-178) + d * mm(22);
        sink.box("plastic", [x, y, FACE(mm(4))], [mm(18), h - mm(8), mm(4)], "#3b4048", o);
        sink.led([x, y + h / 2 - mm(6), FACE(mm(6.3))], mm(2.4), LED_COLORS.green, "activity", o, 6 + hash01(key, o * 10 + d) * 10, hash01(key, o * 10 + d + 400));
      }
      sink.box("port", [mm(-45), y, FACE(mm(3.2))], [mm(70), h - mm(10), mm(1)], "#121417", o);
      for (let n = 0; n < 4; n++) {
        const x = mm(18) + n * mm(27);
        sink.box("metal", [x, y - mm(2), FACE(mm(4))], [mm(22.6), mm(14), mm(6)], "#b8bec6", o);
        sink.led([x, y + mm(10), FACE(mm(3.6))], mm(2.4), LED_COLORS.green, "activity", o, 12 + hash01(key, o * 20 + n) * 12, hash01(key, o * 20 + n + 600));
      }
      for (let n = 0; n < 2; n++) {
        sink.box("metal", [mm(132) + n * mm(22), y - mm(2), FACE(mm(4))], [mm(18.5), mm(12), mm(6)], "#aeb5bd", o);
      }
      sink.box("port", [mm(190), y - mm(2), FACE(mm(4))], [mm(16), mm(13), mm(5)], "#0c0d0f", o);
    } else if (it.type === "nvlink-switch-tray") {
      // NVLink ports are at the rear (blind-mated to the spine); the front has vents, mgmt and LEDs.
      sink.box("port", [mm(-20), y, FACE(mm(3.2))], [mm(300), h - mm(10), mm(1)], "#121417", o);
      sink.box("plastic", [mm(-208), y, FACE(mm(3.2))], [mm(6), h - mm(6), mm(1)], "#76b900", o);
      sink.led([mm(-196), y, FACE(mm(3.5))], mm(3), LED_COLORS.blue, "solid", o);
      for (let n = 0; n < 2; n++) sink.box("port", [mm(160) + n * mm(22), y - mm(2), FACE(mm(4))], [mm(16), mm(13), mm(5)], "#0c0d0f", o);
      sink.led([mm(200), y, FACE(mm(3.5))], mm(2.6), LED_COLORS.green, "activity", o, 4, hash01(key, o));
    } else if (it.type === "power-shelf") {
      // Six hot-swap 5.5 kW PSUs, each with an OK LED.
      for (let p = 0; p < 6; p++) {
        const x = mm(-185) + p * mm(74);
        sink.box("metal", [x, y, FACE(mm(4))], [mm(68), h - mm(4), mm(5)], "#4b525b", o);
        sink.box("port", [x + mm(22), y, FACE(mm(6.8))], [mm(10), mm(26), mm(1)], "#15171a", o);
        sink.led([x - mm(26), y + mm(10), FACE(mm(6.8))], mm(2.6), LED_COLORS.green, "solid", o);
      }
      // AC input connectors at the rear.
      sink.box("port", [mm(-120), y, REAR_Z - mm(8)], [mm(60), mm(30), mm(16)], "#0e0f11", o);
    } else {
      // 1U management switch, 48 x RJ45.
      for (let pt = 0; pt < 24; pt++) {
        const x = mm(-170) + pt * mm(14);
        for (const dy of [mm(-6), mm(6)]) {
          sink.box("port", [x, y + dy, FACE(mm(3))], [mm(12), mm(10), mm(4)], "#0c0d0f", o);
        }
        sink.led([x, y + mm(14), FACE(mm(3.5))], mm(2), LED_COLORS.green, pt < 20 ? "activity" : "off", o, 5 + hash01(key, pt) * 8, hash01(key, pt + 70));
      }
    }
  }

  // Rear: NVLink spine (4 cable cartridges) spanning the compute and switch trays.
  const spineItems = items.filter((i) => i.type === "gpu-compute-tray" || i.type === "nvlink-switch-tray");
  const yBot = spineItems[0].yCenter - RU / 2;
  const yTop = spineItems[spineItems.length - 1].yCenter + RU / 2;
  const spineH = yTop - yBot;
  const spineOwner = spineItems[Math.floor(spineItems.length / 2)].index;
  for (let c = 0; c < 4; c++) {
    const x = mm(-150) + c * mm(78);
    sink.box("metal", [x, yBot + spineH / 2, REAR_Z - mm(45)], [mm(72), spineH, mm(80)], "#2a2e34", spineOwner);
    // Bundles of twinax copper visible through the cartridge face.
    for (let b = 0; b < 26; b++) {
      sink.box("port", [x, yBot + (b + 0.5) * (spineH / 26), REAR_Z - mm(86)], [mm(60), mm(8), mm(3)], "#b87333", spineOwner);
    }
  }
  // 48-54 V DC busbar fed by the power shelves.
  const busOwner = items[0].index;
  const busBot = items[0].yCenter - RU / 2;
  const busTop = items[items.length - 1].yCenter + RU / 2;
  sink.box("metal", [mm(195), (busBot + busTop) / 2, REAR_Z - mm(20)], [mm(36), busTop - busBot, mm(16)], "#c27a3a", busOwner);

  return sink;
}

/** Coolant manifold and hose geometry (rack-local), drawn as pipes. */
export function gpuRackCoolant(items: readonly GpuRackItem[]): { supply: Vec3[][]; ret: Vec3[][] } {
  const z = REAR_Z - mm(150);
  const xs = mm(-255);
  const xr = mm(255);
  const yLow = GPU_RACK.u0 + RU * 2;
  const yHigh = GPU_RACK.height + mm(250);
  const supply: Vec3[][] = [[[xs, yLow, z], [xs, GPU_RACK.height - mm(40), z], [xs, yHigh, z]]];
  const ret: Vec3[][] = [[[xr, yLow, z], [xr, GPU_RACK.height - mm(40), z], [xr, yHigh, z]]];
  // Quick-disconnect hoses from the manifolds to each liquid-cooled tray.
  for (const it of items) {
    if (it.type !== "gpu-compute-tray" && it.type !== "nvlink-switch-tray") continue;
    const y = it.yCenter;
    supply.push([[xs, y, z], [xs + mm(15), y, z + mm(70)], [mm(-215), y, REAR_Z - mm(5)]]);
    ret.push([[xr, y, z], [xr - mm(12), y, z + mm(70)], [mm(228), y + mm(6), REAR_Z - mm(5)]]);
  }
  return { supply, ret };
}
