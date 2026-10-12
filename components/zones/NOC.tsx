import type { ReactNode } from "react";
import { Block, Box, Cyl } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { roomById } from "@/data/site";
import { unitPlane } from "@/lib/three/geometries";
import { std } from "@/lib/three/materialCache";
import { type ScreenKind, screenMaterial } from "@/lib/three/screenTextures";

const room = roomById("noc").rect;
const bezel = std("#0d0f12", { roughness: 0.4, metalness: 0.3 });
const desk = std("#5b4a3a", { roughness: 0.55 });
const deskTop = std("#d9d4cc", { roughness: 0.35 });
const chair = std("#1f2329", { roughness: 0.7 });

/** Video wall layout: [screen kind, column, row]; each panel is 1.9 x 1.07 m. */
const WALL: [ScreenKind, number, number][] = [
  ["power", 0, 1],
  ["thermal", 1, 1],
  ["floorplan", 2, 1],
  ["network", 3, 1],
  ["alerts", 0, 0],
  ["pue", 1, 0],
  ["cctv", 2, 0],
  ["power", 3, 0],
];
const PANEL_W = 1.9;
const PANEL_H = 1.07;

function Screen({ kind, position, size, rotationY = 0 }: { kind: ScreenKind; position: [number, number, number]; size: [number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Box size={[size[0] + 0.04, size[1] + 0.04, 0.04]} position={[0, 0, -0.025]} material={bezel} cast={false} />
      <mesh geometry={unitPlane} material={screenMaterial(kind)} scale={[size[0], size[1], 1]} />
    </group>
  );
}

/** Operator desk with a three-monitor workstation and a chair. */
function Workstation({ position, rotationY, k }: { position: [number, number, number]; rotationY: number; k: number }) {
  const kinds: ScreenKind[] = ["alerts", "network", "thermal", "power", "pue", "cctv"];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Block size={[1.6, 0.72, 0.8]} material={desk} />
      <Box size={[1.62, 0.03, 0.82]} position={[0, 0.735, 0]} material={deskTop} />
      {[-0.52, 0, 0.52].map((x, i) => (
        <group key={x} rotation={[0, x * -0.35, 0]} position={[x, 0, 0]}>
          <Box size={[0.04, 0.3, 0.04]} position={[0, 0.9, -0.22]} material={bezel} cast={false} />
          <Screen kind={kinds[(k + i) % kinds.length]} position={[0, 1.13, -0.2]} size={[0.5, 0.29]} />
        </group>
      ))}
      <Cyl radius={0.26} height={0.08} position={[0, 0.48, 0.75]} material={chair} />
      <Box size={[0.5, 0.55, 0.08]} position={[0, 0.8, 0.98]} material={chair} />
      <Cyl radius={0.03} height={0.42} position={[0, 0.24, 0.75]} material={std("#8d959e", { metalness: 0.7 })} />
    </group>
  );
}

/**
 * Network Operations Center: operators watch power, cooling, network and
 * security 24/7 on a video wall fed by the building management system (BMS),
 * DCIM and network monitoring tools.
 */
export function NOC(): ReactNode {
  const cx = (room.x0 + room.x1) / 2;
  const wallZ = room.z0 + 0.25;
  const wallW = 4 * PANEL_W;
  return (
    <group>
      <Selectable id="noc-video-wall" type="video-wall" label="NOC video wall">
        <Block size={[wallW + 0.6, 0.9, 0.5]} position={[cx, 0, wallZ + 0.1]} material={std("#2a2f36", { roughness: 0.5 })} />
        {WALL.map(([kind, c, r]) => (
          <Screen key={`${c}-${r}`} kind={kind} position={[cx - wallW / 2 + PANEL_W * (c + 0.5), 1.55 + r * (PANEL_H + 0.02), wallZ]} size={[PANEL_W - 0.02, PANEL_H]} />
        ))}
      </Selectable>
      <Selectable id="noc-desks" type="noc" label="NOC operator workstations">
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((i) => {
            // Rows curve gently around the video wall.
            const angle = (i - 1.5) * 0.12;
            const radius = 6 + row * 2.4;
            const x = cx + Math.sin(angle) * radius;
            const z = wallZ + Math.cos(angle) * radius;
            return <Workstation key={`${row}-${i}`} k={row * 4 + i} position={[x, 0.15 * row, z]} rotationY={-angle} />;
          }),
        )}
        {/* Tiered platforms for the back rows. */}
        <Block size={[9, 0.15, 2.4]} position={[cx, 0, wallZ + 8.4]} material={std("#2b3546", { roughness: 1 })} />
        <Block size={[10, 0.3, 2.4]} position={[cx, 0, wallZ + 10.8]} material={std("#2b3546", { roughness: 1 })} />
      </Selectable>
    </group>
  );
}
