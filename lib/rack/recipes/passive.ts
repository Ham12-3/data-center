import type { RackItem } from "@/lib/rack/layout";
import { MOUNT_SPECS } from "@/lib/rack/mountSpecs";
import { HARDWARE_COLORS as C } from "@/lib/rack/palette";
import { type PartSink, type Vec3, faceFrame, facePoint } from "@/lib/rack/parts";
import { DEVICE_FLANGE_WIDTH, mm } from "@/lib/units";

/** 24 LC duplex adapters = 48 fibres. */
export const PATCH_ADAPTERS = 24;
const ADAPTER_PITCH = mm(15.8);
const ADAPTER_OUT = mm(6);

/** Plug-in point of patch panel adapter `index`, rack-local. */
export function patchPanelAdapter(item: RackItem, index: number): Vec3 {
  const x = -((PATCH_ADAPTERS - 1) * ADAPTER_PITCH) / 2 + index * ADAPTER_PITCH;
  return facePoint(faceFrame(item.face), x, item.yCenter, ADAPTER_OUT);
}

/** 1U fibre patch panel: the structured-cabling demarcation for the rack. */
export function buildPatchPanel(item: RackItem, owner: number, sink: PartSink): void {
  const f = faceFrame(item.face);
  const depth = MOUNT_SPECS[item.kind].depth;
  const h = item.height;
  const y = item.yCenter;

  sink.box("metal", facePoint(f, 0, y, -depth / 2), [mm(430), h - mm(4), depth], C.patchFace, owner);
  sink.box("plastic", facePoint(f, 0, y, mm(1)), [DEVICE_FLANGE_WIDTH, h, mm(2)], C.patchFace, owner);
  for (let i = 0; i < PATCH_ADAPTERS; i++) {
    const x = patchPanelAdapter(item, i)[0];
    sink.box("plastic", [x, y, f.faceZ + f.dir * (ADAPTER_OUT / 2)], [mm(12.5), mm(10.5), ADAPTER_OUT], C.lcAdapterSM, owner);
  }
}

/** Blanking panel: a plain plate that stops hot air recirculating through empty U. */
export function buildBlankingPanel(item: RackItem, owner: number, sink: PartSink): void {
  const f = faceFrame(item.face);
  sink.box("plastic", facePoint(f, 0, item.yCenter, mm(1.5)), [DEVICE_FLANGE_WIDTH, item.height, mm(3)], C.blanking, owner);
}
