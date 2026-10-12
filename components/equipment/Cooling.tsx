import { Html } from "@react-three/drei";
import { type ReactNode, useMemo } from "react";
import { useScenarioEffect } from "@/components/simulation/useScenarioEffects";
import { Block, Box, Cyl, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { type FanSpec, SpinningFans } from "@/components/common/SpinningFans";
import { PAL, glow, std } from "@/lib/three/materialCache";

const cabinet = std("#d9dce0", { roughness: 0.45, detail: { scale: 1.5, colorVar: 0.03, roughVar: 0.2 } });
const seam = std("#9ba2aa", { roughness: 0.6 });
const grille = std("#2b2f35", { roughness: 0.7, metalness: 0.3 });

/** Vertiv Liebert CW181-class downflow CRAH: 3099 W x 1067 D x 2388 H mm, 181 kW. */
export const CRAH_DIMS: V3 = [3.1, 2.39, 1.07];

interface PlacedProps {
  id: string;
  position: V3;
  /** Rotation about Y; 0 means the unit's front faces +Z. */
  rotationY?: number;
}

/**
 * Downflow chilled-water CRAH. Warm return air enters the top grille, passes
 * over a chilled-water A-frame coil and is pushed down into the raised-floor
 * plenum by EC fans that sit below the floor line.
 */
export function Crah({ id, position, rotationY = 0, floorY }: PlacedProps & { floorY: number }): ReactNode {
  const [w, h, d] = CRAH_DIMS;
  // Failure scenario: CRAH-A{index+1} trips, showing a red beacon and fault display.
  const failedId = useScenarioEffect((fx) => (fx.crahFailure?.unitFailed ? `CRAH-A${fx.crahFailure.index + 1}` : null));
  const failed = failedId === id;
  return (
    <Selectable id={id} type="crah" label={`CRAH unit ${id}`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[w, h, d]} material={cabinet} bevel={0.02} />
      {/* Panel seams and handles on the front. */}
      {[-1, -0.33, 0.33, 1].map((k) => (
        <Box key={k} size={[0.015, h - 0.1, 0.01]} position={[(k * w) / 2.05, h / 2, d / 2 + 0.005]} material={seam} cast={false} />
      ))}
      {[-0.66, 0, 0.66].map((k) => (
        <Box key={`h${k}`} size={[0.02, 0.18, 0.03]} position={[(k * w) / 2 + 0.4, h / 2, d / 2 + 0.015]} material={std(PAL.steel, { metalness: 0.8 })} cast={false} />
      ))}
      {/* Top return-air grille, controller display, and the EC fan section below the floor. */}
      <Box size={[w - 0.1, 0.02, d - 0.1]} position={[0, h + 0.005, 0]} material={grille} cast={false} />
      <Box size={[0.32, 0.2, 0.01]} position={[-w / 2 + 0.45, h * 0.7, d / 2 + 0.008]} material={glow(failed ? "#ff3b30" : "#67e8f9", failed ? 1.6 : 0.9)} cast={false} dynamic />
      {failed && (
        <>
          <Cyl radius={0.09} height={0.18} position={[w / 2 - 0.3, h + 0.1, 0]} material={glow("#ff3b30", 3)} cast={false} />
          <Html position={[0, h + 0.6, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded bg-red-950/90 px-2 py-0.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-400/60">
              {id} FAULT · fan motor tripped
            </div>
          </Html>
        </>
      )}
      <Block size={[w - 0.2, floorY - 0.05, d - 0.1]} position={[0, -floorY + 0.02, 0]} material={std("#4a5058", { metalness: 0.4 })} />
      {[-1, 0, 1].map((k) => (
        <Cyl key={k} radius={0.33} height={0.05} position={[k * 0.95, -floorY / 2, d / 2 - 0.02]} rotation={[Math.PI / 2, 0, 0]} material={grille} />
      ))}
    </Selectable>
  );
}

/**
 * In-row CDU (CoolIT CHx2000 class, ~750 x 1200 mm footprint, up to ~2 MW):
 * a heat exchanger and redundant pumps separating the facility water loop (FWS)
 * from the rack coolant loop (TCS).
 */
export const CDU_DIMS: V3 = [0.75, 2.0, 1.2];

/** Top-of-stub pipe connection points, CDU-local (front = +Z). */
export const CDU_STUBS = {
  fwsSupply: [-0.2, CDU_DIMS[1] + 0.3, 0.25],
  fwsReturn: [0.2, CDU_DIMS[1] + 0.3, 0.25],
  tcsSupply: [-0.2, CDU_DIMS[1] + 0.3, -0.3],
  tcsReturn: [0.2, CDU_DIMS[1] + 0.3, -0.3],
} as const satisfies Record<string, V3>;

export function Cdu({ id, position, rotationY = 0 }: PlacedProps): ReactNode {
  const [w, h, d] = CDU_DIMS;
  return (
    <Selectable id={id} type="cdu" label={`Coolant distribution unit ${id}`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[w, h, d]} material={std("#2d3238", { roughness: 0.45 })} bevel={0.015} />
      {/* Front door with HMI touchscreen, status LEDs and a vent band. */}
      <Box size={[w - 0.06, h - 0.1, 0.02]} position={[0, h / 2, d / 2 + 0.01]} material={std("#353b42", { metalness: 0.3, roughness: 0.45 })} />
      <Box size={[0.3, 0.2, 0.01]} position={[0, h * 0.72, d / 2 + 0.025]} material={glow("#38bdf8", 1.1)} cast={false} />
      <Box size={[0.26, 0.04, 0.008]} position={[0, h * 0.72 - 0.15, d / 2 + 0.025]} material={glow("#3dff6e", 1.4)} cast={false} />
      <Box size={[w - 0.16, 0.5, 0.01]} position={[0, 0.45, d / 2 + 0.025]} material={grille} cast={false} />
      <Box size={[0.12, 0.03, 0.01]} position={[0, h - 0.18, d / 2 + 0.025]} material={std("#2f7de1")} cast={false} />
      {/* Pipe stubs on top: facility water in/out at the front (larger), rack coolant in/out at the rear. */}
      {(
        [
          [CDU_STUBS.fwsSupply[0], CDU_STUBS.fwsSupply[2], 0.07, PAL.chwSupply],
          [CDU_STUBS.fwsReturn[0], CDU_STUBS.fwsReturn[2], 0.07, PAL.chwReturn],
          [CDU_STUBS.tcsSupply[0], CDU_STUBS.tcsSupply[2], 0.05, PAL.chwSupply],
          [CDU_STUBS.tcsReturn[0], CDU_STUBS.tcsReturn[2], 0.05, PAL.chwReturn],
        ] as const
      ).map(([x, z, r, c]) => (
        <Cyl key={`${x}${z}`} radius={r} height={0.3} position={[x, h + 0.15, z]} material={std(c, { roughness: 0.4 })} />
      ))}
    </Selectable>
  );
}

/**
 * Fan wall (Vertiv CoolLoop Thermal Wall CA60 class, 3050 W x 1524 D x
 * 3665 H mm, ~400 kW): a chilled-water coil and a grid of EC fans blowing
 * cool air horizontally into a slab-floor hall.
 */
export const FAN_WALL_DIMS: V3 = [3.05, 3.67, 1.52];

export function fanWallFans(position: V3, rotationY: number): FanSpec[] {
  const [w, , d] = FAN_WALL_DIMS;
  const fans: FanSpec[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const lx = (c - 1) * (w / 3);
      const ly = 1.1 + r * 1.35;
      const lz = d / 2 + 0.06;
      // Rotate the local fan centre into place (rotation about Y).
      const x = position[0] + lx * Math.cos(rotationY) + lz * Math.sin(rotationY);
      const z = position[2] - lx * Math.sin(rotationY) + lz * Math.cos(rotationY);
      fans.push({ position: [x, position[1] + ly, z], radius: 0.42, axis: Math.abs(Math.sin(rotationY)) > 0.5 ? "x" : "z", speed: 10, blades: 7 });
    }
  }
  return fans;
}

export function FanWall({ id, position, rotationY = 0 }: PlacedProps): ReactNode {
  const [w, h, d] = FAN_WALL_DIMS;
  return (
    <Selectable id={id} type="fan-wall" label={`Fan wall ${id}`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[w, h, d]} material={cabinet} bevel={0.02} />
      <Box size={[w - 0.1, h - 0.3, 0.04]} position={[0, h / 2 - 0.05, d / 2 + 0.02]} material={std("#3a4048", { metalness: 0.3 })} cast={false} />
      {[0, 1].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <Cyl
            key={`${r}${c}`}
            radius={0.47}
            height={0.08}
            position={[(c - 1) * (w / 3), 1.1 + r * 1.35, d / 2 + 0.05]}
            rotation={[Math.PI / 2, 0, 0]}
            material={grille}
          />
        )),
      )}
      <Box size={[0.3, 0.18, 0.01]} position={[w / 2 - 0.3, h - 0.25, d / 2 + 0.045]} material={glow("#67e8f9", 0.9)} cast={false} />
    </Selectable>
  );
}

/** Fans of several fan walls, animated together. */
export function FanWallFans({ walls }: { walls: readonly { position: V3; rotationY: number }[] }): ReactNode {
  const fans = useMemo(() => walls.flatMap((w) => fanWallFans(w.position, w.rotationY)), [walls]);
  return <SpinningFans fans={fans} />;
}
