import type { EquipmentTypeId } from "@/types/equipment";
import { GPU_RACK } from "./gpuRack";
import type { Vec3 } from "./parts";
import { RU, mm } from "@/lib/units";

/**
 * Detailed layout of a GB200 compute tray for the service view: two "Bianca"
 * boards, each with one Grace CPU and two Blackwell GPUs under liquid cold
 * plates, plumbed in series to the rear quick-disconnect couplings. All
 * coordinates are tray-local: origin at the centre of the tray body, +Z
 * towards the front (cold aisle), Y up. Pure data, so it can be tested.
 */

export const TRAY = {
  width: mm(440),
  height: RU - mm(1.2),
  depth: GPU_RACK.trayDepth,
  /** How far the tray slides out on its rails, m. */
  travel: mm(640),
  /** Blind-mate connectors at the rear separate after this much travel, m. */
  decoupleAt: mm(6),
} as const;

const H = TRAY.height;
const D = TRAY.depth;
const FLOOR = -H / 2 + mm(3);

export interface TrayPart {
  readonly key: string;
  readonly type: EquipmentTypeId | null;
  readonly label: string;
  readonly kind: "pcb" | "gpu" | "cpu" | "hbm" | "lpddr" | "coldplate" | "qd" | "nvlink" | "busbar" | "nic" | "drive" | "fan" | "cover" | "pan" | "wall" | "dpu";
  readonly pos: Vec3;
  readonly size: Vec3;
  /** Vertical offset in the exploded view, m. */
  readonly explode: number;
}

/** Board centres (x) and the GPU/CPU positions along each board (z). */
const BOARD_X = [mm(-108), mm(108)] as const;
const GPU_Z = [mm(130), mm(-10)] as const;
const CPU_Z = mm(-150);

export function trayParts(): TrayPart[] {
  const parts: TrayPart[] = [];
  const add = (p: TrayPart) => parts.push(p);

  add({ key: "pan", type: "gpu-compute-tray", label: "Tray chassis", kind: "pan", pos: [0, -H / 2 + mm(1), 0], size: [TRAY.width, mm(2), D], explode: 0 });
  for (const s of [-1, 1]) {
    add({ key: `wall${s}`, type: "gpu-compute-tray", label: "Tray chassis", kind: "wall", pos: [s * (TRAY.width / 2 - mm(1)), 0, 0], size: [mm(2), H, D], explode: 0 });
  }
  add({ key: "cover", type: "gpu-compute-tray", label: "Tray cover", kind: "cover", pos: [0, H / 2 - mm(1), -mm(40)], size: [TRAY.width, mm(2), D - mm(80)], explode: mm(330) });

  BOARD_X.forEach((bx, b) => {
    const n = b + 1;
    add({ key: `pcb${n}`, type: "gpu-compute-tray", label: `Bianca board ${n} (GB200 superchip)`, kind: "pcb", pos: [bx, FLOOR + mm(1), mm(-10)], size: [mm(196), mm(2), mm(440)], explode: 0 });
    GPU_Z.forEach((gz, g) => {
      const label = `Blackwell GPU ${b * 2 + g + 1}`;
      add({ key: `gpu${n}${g}`, type: "gpu-chip", label, kind: "gpu", pos: [bx, FLOOR + mm(4), gz], size: [mm(76), mm(3), mm(76)], explode: mm(80) });
      // Eight HBM3e stacks around the two compute dies.
      for (let h = 0; h < 8; h++) {
        const side = h < 4 ? -1 : 1;
        add({
          key: `hbm${n}${g}${h}`,
          type: "gpu-chip",
          label: `${label}: HBM3e stack`,
          kind: "hbm",
          pos: [bx + side * mm(26), FLOOR + mm(6.2), gz - mm(24) + (h % 4) * mm(16)],
          size: [mm(10), mm(1.5), mm(12)],
          explode: mm(80),
        });
      }
      add({ key: `cp-gpu${n}${g}`, type: "cold-plate", label: `Cold plate on ${label}`, kind: "coldplate", pos: [bx, FLOOR + mm(13), gz], size: [mm(88), mm(12), mm(88)], explode: mm(190) });
    });
    add({ key: `cpu${n}`, type: "grace-cpu", label: `Grace CPU ${n}`, kind: "cpu", pos: [bx, FLOOR + mm(4), CPU_Z], size: [mm(56), mm(3), mm(56)], explode: mm(80) });
    for (let k = 0; k < 6; k++) {
      add({
        key: `lpddr${n}${k}`,
        type: "grace-cpu",
        label: `Grace CPU ${n}: LPDDR5X memory`,
        kind: "lpddr",
        pos: [bx + (k < 3 ? -1 : 1) * mm(40), FLOOR + mm(3.5), CPU_Z - mm(18) + (k % 3) * mm(18)],
        size: [mm(14), mm(1.5), mm(14)],
        explode: mm(80),
      });
    }
    add({ key: `cp-cpu${n}`, type: "cold-plate", label: `Cold plate on Grace CPU ${n}`, kind: "coldplate", pos: [bx, FLOOR + mm(12), CPU_Z], size: [mm(66), mm(10), mm(66)], explode: mm(190) });
  });

  // Front section: E1.S drives, ConnectX-7 NICs, BlueField-3 DPUs, fans for the air-cooled parts.
  for (let d = 0; d < 4; d++) {
    add({ key: `drive${d}`, type: "gpu-compute-tray", label: `E1.S NVMe drive ${d + 1}`, kind: "drive", pos: [mm(-178) + d * mm(22), 0, D / 2 - mm(60)], size: [mm(16), H - mm(8), mm(110)], explode: mm(40) });
  }
  for (let n = 0; n < 4; n++) {
    add({ key: `nic${n}`, type: "nic-card", label: `ConnectX-7 400G NIC ${n + 1}`, kind: "nic", pos: [mm(18) + n * mm(27), FLOOR + mm(8), D / 2 - mm(70)], size: [mm(22), mm(14), mm(120)], explode: mm(50) });
  }
  for (let n = 0; n < 2; n++) {
    add({ key: `dpu${n}`, type: "nic-card", label: `BlueField-3 DPU ${n + 1}`, kind: "dpu", pos: [mm(132) + n * mm(24), FLOOR + mm(8), D / 2 - mm(90)], size: [mm(20), mm(14), mm(160)], explode: mm(50) });
  }
  for (let f = 0; f < 6; f++) {
    add({ key: `fan${f}`, type: "gpu-compute-tray", label: "40 mm fan (air-cooled components)", kind: "fan", pos: [mm(-175) + f * mm(70), 0, mm(235)], size: [mm(40), H - mm(6), mm(28)], explode: mm(30) });
  }

  // Rear: blind-mate couplings that separate as soon as the tray slides out.
  add({ key: "qd-s", type: "quick-disconnect", label: "Quick disconnect: coolant supply", kind: "qd", pos: [mm(-215), 0, -D / 2 - mm(10)], size: [mm(22), mm(22), mm(26)], explode: 0 });
  add({ key: "qd-r", type: "quick-disconnect", label: "Quick disconnect: coolant return", kind: "qd", pos: [mm(228), 0, -D / 2 - mm(10)], size: [mm(22), mm(22), mm(26)], explode: 0 });
  for (let c = 0; c < 4; c++) {
    add({ key: `nvl${c}`, type: "nvlink-switch-tray", label: "NVLink blind-mate connector", kind: "nvlink", pos: [mm(-150) + c * mm(78), 0, -D / 2 - mm(6)], size: [mm(60), H - mm(10), mm(14)], explode: 0 });
  }
  add({ key: "busbar-clip", type: "power-shelf", label: "48 V busbar clip", kind: "busbar", pos: [mm(195), 0, -D / 2 - mm(8)], size: [mm(34), H - mm(8), mm(16)], explode: 0 });
  return parts;
}

/**
 * Coolant loops on each board: supply from the rear coupling into the CPU
 * cold plate, then both GPU plates in series, and back out to the return
 * coupling (blue in, red out). Tray-local polylines, lifted with the plates
 * in the exploded view.
 */
export function trayCoolantLoops(): { supply: Vec3[][]; ret: Vec3[][] } {
  const y = FLOOR + mm(13);
  const supply: Vec3[][] = [];
  const ret: Vec3[][] = [];
  BOARD_X.forEach((bx) => {
    supply.push([[mm(-215), 0, -D / 2], [mm(-215), y, -D / 2 + mm(30)], [bx - mm(20), y, -D / 2 + mm(30)], [bx - mm(20), y, CPU_Z - mm(33)]]);
    supply.push([[bx + mm(20), y, CPU_Z + mm(33)], [bx + mm(20), y, GPU_Z[1] - mm(44)]]);
    supply.push([[bx - mm(20), y, GPU_Z[1] + mm(44)], [bx - mm(20), y, GPU_Z[0] - mm(44)]]);
    ret.push([[bx + mm(20), y, GPU_Z[0] - mm(44)], [bx + mm(52), y, GPU_Z[0] - mm(60)], [bx + mm(52), y, -D / 2 + mm(45)], [mm(228), y, -D / 2 + mm(45)], [mm(228), 0, -D / 2]]);
  });
  return { supply, ret };
}

/** Parse a GPU device id ("B03-05/U14") into its rack and starting unit. */
export function parseGpuDeviceId(id: string): { rackId: string; uStart: number } | null {
  const m = /^(.+)\/U(\d+)$/.exec(id);
  return m ? { rackId: m[1], uStart: Number(m[2]) } : null;
}
