import { type ReactNode, useCallback } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Box } from "@/components/common/Primitives";
import { GPU_RACK, type GpuRackItem } from "@/lib/rack/gpuRack";
import { getGpuRackModel } from "@/lib/rack/model";
import { unitBox } from "@/lib/three/geometries";
import { PAL, std } from "@/lib/three/materialCache";
import { RU } from "@/lib/units";
import { useStore } from "@/store/useStore";
import { RackEquipment } from "./RackEquipment";
import { GpuTray } from "./GpuTray";
import { StatusLEDs } from "./StatusLEDs";

const frameMat = std("#1b1e22", { metalness: 0.45, roughness: 0.5 });
const sideMat = std("#24282d", { metalness: 0.35, roughness: 0.5 });
const highlight = std("#7dd3fc", { transparent: true, opacity: 0.28, emissive: "#38bdf8", emissiveIntensity: 1.5, depthWrite: false });
const hoseSupply = std(PAL.chwSupply, { roughness: 0.45 });
const hoseReturn = std(PAL.chwReturn, { roughness: 0.45 });

/** MGX-style frame: no doors, so trays, manifolds and the spine are visible. */
function GpuRackFrame(): ReactNode {
  const { width: W, depth: D, height: H } = GPU_RACK;
  const post = 0.04;
  return (
    <group>
      <Box size={[W, 0.06, D]} position={[0, 0.03, 0]} material={frameMat} />
      <Box size={[W, 0.04, D]} position={[0, H - 0.02, 0]} material={frameMat} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} size={[post, H - 0.1, post]} position={[sx * (W / 2 - post / 2), H / 2, sz * (D / 2 - post / 2)]} material={frameMat} />
        )),
      )}
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[0.008, H - 0.1, D - 2 * post]} position={[sx * (W / 2 - 0.004), H / 2, 0]} material={sideMat} />
      ))}
    </group>
  );
}

export const gpuDeviceId = (rackId: string, item: GpuRackItem): string => `${rackId}/U${item.uStart}`;

interface GpuRackProps {
  id: string;
  position: readonly [number, number, number];
  rotationY: number;
}

/**
 * Detailed NVL72 rack: 18 compute trays, 9 NVLink switch trays, 8 power
 * shelves, the copper NVLink spine and busbar at the rear, and blue/red
 * coolant manifolds with a quick-disconnect hose to every liquid-cooled tray.
 */
export function GpuRack({ id, position, rotationY }: GpuRackProps): ReactNode {
  const model = getGpuRackModel();
  const showPipes = useStore((s) => s.layers.pipes);
  const selectedId = useStore((s) => s.selected?.id);
  const serviceU = useStore((s) => (s.trayService?.rackId === id ? s.trayService.uStart : null));
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
      const info = { id: gpuDeviceId(id, item), type: item.type, label: `${item.label} · GPU rack ${id}` };
      if (kind === "click") select(info);
      else if (useStore.getState().hovered?.id !== info.id) hover(info);
    },
    [hover, id, model.items, select],
  );

  const selectedItem = selectedId?.startsWith(`${id}/`) ? model.items.find((it) => gpuDeviceId(id, it) === selectedId) : undefined;
  // A tray pulled out for service is drawn by GpuTray instead of the instanced rack contents.
  const serviceItem = serviceU === null ? undefined : model.items.find((it) => it.uStart === serviceU);

  return (
    <group position={[...position]} rotation-y={rotationY}>
      <GpuRackFrame />
      <RackEquipment boxes={model.parts.boxes} onPick={onPick} hidden={serviceItem?.index ?? null} />
      <StatusLEDs leds={model.parts.leds} hidden={serviceItem?.index ?? null} />
      {serviceItem && <GpuTray rackId={id} item={serviceItem} rackPosition={position} rackRotationY={rotationY} />}
      {showPipes && (
        <>
          <PipeRuns runs={model.coolant.supply} radius={0.012} material={hoseSupply} shared />
          <PipeRuns runs={model.coolant.ret} radius={0.012} material={hoseReturn} shared />
        </>
      )}
      {selectedItem && selectedItem !== serviceItem && (
        <mesh
          geometry={unitBox}
          material={highlight}
          position={[0, selectedItem.yCenter, GPU_RACK.frontZ - GPU_RACK.trayDepth / 2]}
          scale={[0.46, RU, GPU_RACK.trayDepth + 0.02]}
        />
      )}
    </group>
  );
}
