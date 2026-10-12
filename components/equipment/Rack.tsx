import { type ReactNode, useCallback } from "react";
import type { RackSlotConfig } from "@/types/equipment";
import type { RackItem } from "@/lib/rack/layout";
import { getRackModel } from "@/lib/rack/model";
import { faceFrame } from "@/lib/rack/parts";
import { MOUNT_SPECS } from "@/lib/rack/mountSpecs";
import { DEVICE_FLANGE_WIDTH } from "@/lib/units";
import { std } from "@/lib/three/materialCache";
import { unitBox } from "@/lib/three/geometries";
import { useStore } from "@/store/useStore";
import { RackCabling } from "./RackCabling";
import { RackDoor } from "./RackDoor";
import { RackEquipment } from "./RackEquipment";
import { RackFrame } from "./RackFrame";
import { RackPDU } from "./RackPDU";
import { StatusLEDs } from "./StatusLEDs";

interface RackProps {
  id: string;
  slots: readonly RackSlotConfig[];
  position?: readonly [number, number, number];
  /** Rotation about Y in radians. 0 = front faces +Z. */
  rotationY?: number;
  doorsOpen?: boolean;
}

const highlight = std("#7dd3fc", { transparent: true, opacity: 0.28, emissive: "#38bdf8", emissiveIntensity: 1.5, depthWrite: false });

/** Translucent box around the selected device so it stands out inside the rack. */
function DeviceHighlight({ item }: { item: RackItem }): ReactNode {
  const spec = MOUNT_SPECS[item.kind];
  const f = faceFrame(item.face);
  const depth = spec.depth + 0.012;
  const z = f.faceZ - f.dir * (spec.depth / 2) + f.dir * 0.004;
  return (
    <mesh geometry={unitBox} material={highlight} position={[0, item.yCenter, z]} scale={[DEVICE_FLANGE_WIDTH + 0.01, item.height + 0.006, depth]} />
  );
}

/** Instance id of a device inside a rack, e.g. "A03-07/U12". */
export const deviceId = (rackId: string, item: RackItem): string => `${rackId}/U${item.uStart}`;

/**
 * A fully detailed 42U rack: enclosure, doors, devices, dual PDUs and cabling.
 * Geometry comes from a cached model shared by all racks with the same slots.
 * Each device inside is individually clickable.
 */
export function Rack({ id, slots, position = [0, 0, 0], rotationY = 0, doorsOpen }: RackProps): ReactNode {
  const model = getRackModel(slots);
  const globalDoors = useStore((s) => s.rackDoorsOpen);
  const showCables = useStore((s) => s.layers.cables);
  const selectedId = useStore((s) => s.selected?.id);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);

  const onPick = useCallback(
    (owner: number, kind: "click" | "hover" | "out") => {
      if (kind === "out") {
        if (useStore.getState().hovered?.id.startsWith(`${id}/`)) hover(null);
        return;
      }
      const item = model.items[owner];
      if (!item) return;
      const info = { id: deviceId(id, item), type: item.kind, label: `${item.label} · rack ${id}, U${item.uStart}` };
      if (kind === "click") select(info);
      else if (useStore.getState().hovered?.id !== info.id) hover(info);
    },
    [hover, id, model.items, select],
  );

  const selectedItem = selectedId?.startsWith(`${id}/`) ? model.items.find((it) => deviceId(id, it) === selectedId) : undefined;
  const open = doorsOpen ?? globalDoors;

  return (
    <group position={[...position]} rotation-y={rotationY}>
      <RackFrame />
      <RackDoor face="front" open={open} />
      <RackDoor face="rear" open={open} />
      <RackEquipment boxes={model.parts.boxes} onPick={onPick} />
      <StatusLEDs leds={model.parts.leds} />
      <RackPDU feed="A" />
      <RackPDU feed="B" />
      {showCables && <RackCabling routes={model.routes} />}
      {selectedItem && <DeviceHighlight item={selectedItem} />}
    </group>
  );
}
