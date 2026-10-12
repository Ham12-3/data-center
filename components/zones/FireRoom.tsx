import { type ReactNode, useMemo } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { AgentCylinderBank } from "@/components/equipment/FireSafety";
import { roomById } from "@/data/site";
import { PAL, glow, std } from "@/lib/three/materialCache";

const room = roomById("fire").rect;

/**
 * Clean-agent fire suppression room. One cylinder bank per data hall; on a
 * confirmed alarm (two detectors, or VESDA Fire 2) the panel sounds a
 * pre-discharge alarm, waits ~30 s so people can leave, then floods the hall
 * with gas that puts out the fire without harming electronics. Water from the
 * pre-action sprinklers is the last resort.
 */
export function FireRoom(): ReactNode {
  const discharge = useMemo<V3[][]>(
    () => [
      // From each bank's manifold up to the ceiling and out into the halls, ending in nozzle drops.
      [[-3.5, 1.95, -4.55], [-3.5, 6.2, -4.55], [-7.5, 6.2, -4.55], [-14, 6.2, -4.55], [-24, 6.2, -4.55], [-34, 6.2, -4.55]],
      [[3.5, 1.95, -4.55], [3.5, 6.2, -4.55], [7.5, 6.2, -4.55], [16, 6.2, -4.55], [26, 6.2, -4.55], [36, 6.2, -4.55]],
      ...[-14, -24, -34, 16, 26, 36].map((x): V3[] => [[x, 6.2, -4.55], [x, 5.9, -4.55]]),
    ],
    [],
  );
  return (
    <group>
      <AgentCylinderBank id="FS-BANK-A" position={[-6.2, 0, -4.5]} count={8} label="Clean-agent cylinder bank (Hall A)" />
      <AgentCylinderBank id="FS-BANK-B" position={[0.8, 0, -4.5]} count={8} label="Clean-agent cylinder bank (Hall B)" />
      <Selectable id="fs-pipes" type="gas-suppression" label="Clean-agent discharge piping and nozzles">
        <PipeRuns runs={discharge} radius={0.05} material={std(PAL.fireRed, { roughness: 0.5 })} />
      </Selectable>
      <Selectable id="facp" type="gas-suppression" label="Fire alarm and suppression control panel">
        <Block size={[1.0, 1.2, 0.25]} position={[-2.5, 0.9, room.z1 - 0.3]} material={std(PAL.fireRed, { roughness: 0.45 })} />
        <Box size={[0.5, 0.3, 0.01]} position={[-2.5, 1.75, room.z1 - 0.43]} material={glow("#22c55e", 0.6)} cast={false} />
        {/* Manual release (yellow) and hold/abort (blue) stations. */}
        <Box size={[0.15, 0.15, 0.05]} position={[-1.4, 1.4, room.z1 - 0.2]} material={std(PAL.safetyYellow)} cast={false} />
        <Box size={[0.15, 0.15, 0.05]} position={[-1.1, 1.4, room.z1 - 0.2]} material={std("#2563eb")} cast={false} />
      </Selectable>
    </group>
  );
}
