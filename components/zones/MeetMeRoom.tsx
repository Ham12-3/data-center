import { type ReactNode, useMemo } from "react";
import { Block, Box } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { OverheadRuns, type TrayRun } from "@/components/equipment/Overhead";
import { RackField } from "@/components/equipment/RackField";
import { type InstanceSpec, InstancedBoxes } from "@/components/site/Instanced";
import { CARRIER_CAGES, CORE_RACKS, MMR_RACKS } from "@/data/halls";
import { HALL_A } from "@/data/halls";
import { PAL, glow, std } from "@/lib/three/materialCache";

const mesh = std("#8a939c", { transparent: true, opacity: 0.35, metalness: 0.6, roughness: 0.4, doubleSide: true });
const post = std("#3b4048", { metalness: 0.6 });

/** Wire-mesh carrier cage: four walls, a gate and a carrier colour band. */
function CarrierCage({ id, x, z, carrier, color }: (typeof CARRIER_CAGES)[number]): ReactNode {
  const w = 3.2;
  const d = 2.8;
  const h = 2.6;
  const gateSide = x < 0 ? 1 : -1;
  return (
    <Selectable id={id} type="carrier-cage" label={`Carrier cage: ${carrier}`} position={[x, 0, z]}>
      <Box size={[w, h, 0.02]} position={[0, h / 2, -d / 2]} material={mesh} cast={false} />
      <Box size={[w, h, 0.02]} position={[0, h / 2, d / 2]} material={mesh} cast={false} />
      <Box size={[0.02, h, d]} position={[-gateSide * (w / 2), h / 2, 0]} material={mesh} cast={false} />
      <Box size={[0.02, h, d * 0.55]} position={[gateSide * (w / 2), h / 2, -d * 0.22]} material={mesh} cast={false} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} size={[0.05, h, 0.05]} position={[(sx * w) / 2, h / 2, (sz * d) / 2]} material={post} />))}
      <Box size={[w, 0.12, 0.03]} position={[0, h - 0.1, d / 2 + 0.02]} material={std(color)} cast={false} />
      <Box size={[0.1, 0.14, 0.04]} position={[gateSide * (w / 2 + 0.03), 1.2, d * 0.3]} material={std("#1b1e22")} cast={false} />
    </Selectable>
  );
}

/**
 * Cross-connect frames (optical distribution frames). A cross-connect is a
 * patch cord linking a carrier's port to a customer's port, so a new network
 * link can be set up in minutes without touching the carrier's fibre.
 */
function CrossConnects(): ReactNode {
  const jumpers = useMemo(() => {
    const list: InstanceSpec[] = [];
    for (let f = 0; f < 5; f++) {
      const x = -1.2 + f * 0.6;
      for (let j = 0; j < 14; j++) {
        for (const side of [-1, 1]) {
          list.push({ position: [x - 0.24 + j * 0.036, 1.1, -20.5 + side * 0.17], scale: [0.004, 1.7 - (j % 4) * 0.12, 0.004] });
        }
      }
    }
    return list;
  }, []);
  return (
    <Selectable id="mmr-odf" type="cross-connect" label="Cross-connect frames (ODF)">
      {Array.from({ length: 5 }, (_, f) => (
        <group key={f} position={[-1.2 + f * 0.6, 0, -20.5]}>
          <Block size={[0.58, 2.2, 0.3]} material={std("#2a2e34", { metalness: 0.4 })} />
          {[-1, 1].map((s) => (
            <Box key={s} size={[0.5, 1.6, 0.02]} position={[0, 1.25, s * 0.155]} material={std("#3a414a")} cast={false} />
          ))}
        </group>
      ))}
      <InstancedBoxes items={jumpers} material={std(PAL.fiberYellow, { roughness: 0.5 })} cast={false} />
    </Selectable>
  );
}

/** Fibre entrance cabinets where the outside-plant cables from entries A and B terminate. */
function EntranceCabinets(): ReactNode {
  return (
    <group>
      {(
        [
          ["A", 0, -25.2, 0],
          ["B", -6.55, -20.5, Math.PI / 2],
        ] as const
      ).map(([id, x, z, rot]) => (
        <Selectable key={id} id={`fiber-entrance-${id}`} type="fiber-entry" label={`Fibre entrance cabinet ${id} (from entry ${id})`} position={[x, 0, z]} rotation={[0, rot, 0]}>
          <Block size={[0.9, 2.1, 0.5]} material={std("#d3d6da", { roughness: 0.45 })} />
          <Box size={[0.3, 0.08, 0.01]} position={[0, 1.85, 0.256]} material={std(id === "A" ? "#f08a24" : "#f08a24")} cast={false} />
          <Box size={[0.06, 0.06, 0.01]} position={[0.3, 1.85, 0.256]} material={glow("#3dff6e", 1.3)} cast={false} />
        </Selectable>
      ))}
    </group>
  );
}

/**
 * Meet-Me Room and network core. Carriers bring fibre in through two diverse
 * entries; cross-connects link them to the border routers, which feed the
 * spine switches, which connect to every leaf (ToR) switch in the halls.
 */
export function MeetMeRoom(): ReactNode {
  const trays = useMemo<TrayRun[]>(
    () => [
      { kind: "fiber", from: [0, 3.0, -25], to: [0, 3.0, -12.6] },
      { kind: "fiber", from: [-6.6, 3.0, -20.5], to: [6.6, 3.0, -20.5] },
      { kind: "fiber", from: [-6.6, 3.0, -23.9], to: [6.6, 3.0, -23.9] },
      { kind: "fiber", from: [-6.6, 3.0, -17.2], to: [6.6, 3.0, -17.2] },
      // Fibre entry B arrives overhead across Hall A from the west wall.
      { kind: "fiber", from: [-41.6, 4.4, -18], to: [-6.6, 4.4, -18] },
      // Core: trays over both rows and backbones from each hall.
      { kind: "fiber", from: [-2.6, 2.7, -12], to: [2.6, 2.7, -12] },
      { kind: "fiber", from: [-2.6, 2.7, -9.6], to: [2.6, 2.7, -9.6] },
      { kind: "fiber", from: [-7.2, HALL_A.floorY + 3.55, -10.8], to: [7.2, HALL_A.floorY + 3.55, -10.8] },
    ],
    [],
  );
  return (
    <group>
      {CARRIER_CAGES.map((c) => (
        <CarrierCage key={c.id} {...c} />
      ))}
      <RackField placements={MMR_RACKS} maxDetailed={4} />
      <RackField placements={CORE_RACKS} maxDetailed={8} />
      <CrossConnects />
      <EntranceCabinets />
      <Selectable id="mmr-trays" type="cable-tray" label="Fibre raceways (Meet-Me Room and network core)">
        <OverheadRuns runs={trays} />
      </Selectable>
    </group>
  );
}
