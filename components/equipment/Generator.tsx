import type { ReactNode } from "react";
import { Block, Box, Cyl } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { PAL, glow, std } from "@/lib/three/materialCache";

/** 40 ft ISO container footprint used by most 2-3 MW containerised gensets. */
export const GENSET_LENGTH = 12.19;
export const GENSET_WIDTH = 2.44;
export const GENSET_HEIGHT = 2.9;
export const BELLY_TANK_H = 0.9;

/** Positions of the two roof radiator fans (local), used by the yard's fan animation. */
export const GENSET_FAN_LOCAL: readonly [number, number, number][] = [
  [GENSET_LENGTH / 2 - 1.5, BELLY_TANK_H + GENSET_HEIGHT + 0.45, -0.6],
  [GENSET_LENGTH / 2 - 1.5, BELLY_TANK_H + GENSET_HEIGHT + 0.45, 0.6],
];

export type GeneratorStatus = "standby" | "starting" | "running";

interface GeneratorProps {
  id: string;
  position: [number, number, number];
  status?: GeneratorStatus;
}

/**
 * Containerised diesel generator: sound-attenuated enclosure on a double-wall
 * belly fuel tank, roof radiator with fans at one end, exhaust silencer and stack.
 */
export function Generator({ id, position, status = "standby" }: GeneratorProps): ReactNode {
  const L = GENSET_LENGTH;
  const W = GENSET_WIDTH;
  const H = GENSET_HEIGHT;
  const top = BELLY_TANK_H + H;
  const body = std(PAL.genset, { roughness: 0.45, detail: { scale: 0.6, colorVar: 0.04, roughVar: 0.25, grime: 0.15, grimeHeight: 1.6 } });
  const dark = std("#4a5058", { roughness: 0.6, metalness: 0.4 });

  return (
    <Selectable id={id} type="generator" label={`Diesel generator ${id}`} position={position}>
      {/* Belly tank (sub-base fuel tank) and enclosure. */}
      <Block size={[L, BELLY_TANK_H, W + 0.1]} material={std("#2f3439", { roughness: 0.7 })} />
      <Block size={[L, H, W]} position={[0, BELLY_TANK_H, 0]} material={body} bevel={0.05} />
      {/* Access doors along both long sides. */}
      {[-3.6, -1.2, 1.2].map((x) =>
        [-1, 1].map((side) => (
          <Box
            key={`${x}-${side}`}
            size={[1.6, 2.1, 0.03]}
            position={[x, BELLY_TANK_H + 1.15, side * (W / 2 + 0.01)]}
            material={std("#d5d9de", { roughness: 0.5 })}
          />
        )),
      )}
      {/* Air intake louvres at the engine end and radiator discharge grille at the other. */}
      <Box size={[0.03, 2.2, W - 0.3]} position={[-L / 2 - 0.01, BELLY_TANK_H + 1.4, 0]} material={dark} cast={false} />
      <Box size={[3.2, 0.25, W]} position={[L / 2 - 1.6, top + 0.12, 0]} material={dark} />
      {GENSET_FAN_LOCAL.map(([x, y, z], i) => (
        <Cyl key={i} radius={0.62} height={0.3} position={[x, y - 0.12, z]} material={std("#2b2f34", { metalness: 0.5 })} />
      ))}
      {/* Exhaust: horizontal silencer on the roof, vertical stack with rain cap. */}
      <Cyl radius={0.38} height={3.4} position={[-1.5, top + 0.55, 0]} rotation={[0, 0, Math.PI / 2]} material={std("#8a8f96", { metalness: 0.7, roughness: 0.35 })} />
      <Cyl radius={0.22} height={3.2} position={[0.4, top + 1.8, 0]} material={std("#8a8f96", { metalness: 0.7, roughness: 0.35 })} />
      {/* Status beacon: amber while starting, green when running, dark on standby. */}
      <Box
        size={[0.22, 0.22, 0.22]}
        position={[-L / 2 + 0.4, top + 0.14, W / 2 - 0.3]}
        material={status === "running" ? glow("#3dff6e", 2) : status === "starting" ? glow("#ffb020", 2) : glow("#555b62", 1)}
        cast={false}
        dynamic
      />
    </Selectable>
  );
}

/** Horizontal bulk diesel tank on saddles inside a concrete containment bund. */
export function FuelTank({ id, position }: { id: string; position: [number, number, number] }): ReactNode {
  const L = 11;
  const R = 1.6;
  return (
    <Selectable id={id} type="fuel-tank" label={`Bulk fuel tank ${id}`} position={position}>
      {/* Bund walls (110% containment). */}
      <Block size={[L + 2, 0.12, 2 * R + 2]} material={std(PAL.concrete)} />
      {[-1, 1].map((s) => (
        <Block key={`bl-${s}`} size={[L + 2, 0.8, 0.2]} position={[0, 0, s * (R + 1)]} material={std(PAL.concrete)} />
      ))}
      {[-1, 1].map((s) => (
        <Block key={`bw-${s}`} size={[0.2, 0.8, 2 * R + 2]} position={[s * (L / 2 + 1), 0, 0]} material={std(PAL.concrete)} />
      ))}
      {[-L / 3, 0, L / 3].map((x) => (
        <Block key={x} size={[0.4, 0.9, 2 * R * 0.9]} position={[x, 0.1, 0]} material={std("#6b7178")} />
      ))}
      <Cyl radius={R} height={L} position={[0, 0.9 + R, 0]} rotation={[0, 0, Math.PI / 2]} material={std("#e6e8ea", { roughness: 0.45, metalness: 0.2 })} />
      {/* Top walkway and fill/vent pipes. */}
      <Box size={[L * 0.6, 0.08, 0.8]} position={[0, 0.9 + 2 * R + 0.1, 0]} material={std(PAL.safetyYellow)} />
      <Cyl radius={0.08} height={1.2} position={[L / 2 - 1, 0.9 + 2 * R + 0.6, 0.3]} material={std("#6b7178", { metalness: 0.6 })} />
    </Selectable>
  );
}
