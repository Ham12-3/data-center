import { type ReactNode, useMemo } from "react";
import { Selectable } from "@/components/common/Selectable";
import { BatteryCabinet, Switchgear, TransferSwitch, Ups } from "@/components/equipment/Electrical";
import { OverheadRuns, type TrayRun } from "@/components/equipment/Overhead";
import { roomById } from "@/data/site";

/**
 * Electrical room for one power path. Utility power arrives from the outdoor
 * transformer through the east wall, generator power through the cable trench;
 * the ATS selects the source, the switchboard distributes it, and the UPS
 * modules condition it before busway carries it to the data halls.
 * Rooms A and B are physically separate so one fire cannot take out both paths (2N).
 */
function ElectricalRoom({ feed }: { feed: "A" | "B" }): ReactNode {
  const r = roomById(feed === "A" ? "elecA" : "elecB").rect;
  const cx = (r.x0 + r.x1) / 2;
  const runs = useMemo<TrayRun[]>(() => {
    const kind = feed === "A" ? "buswayA" : "buswayB";
    return [
      { kind, from: [r.x0 + 1, 3.4, r.z0 + 5.4], to: [r.x1 - 1, 3.4, r.z0 + 5.4] },
      { kind, from: [cx, 3.4, r.z0 + 5.4], to: [cx, 3.4, r.z0 - 2.2] },
      { kind, from: [cx, 3.4, r.z0 - 2.2], to: [cx, 3.4, r.z0 - 4.5] },
    ];
  }, [feed, r, cx]);
  return (
    <group>
      <Switchgear id={`MSB-${feed}`} feed={feed} position={[cx - 1.2, 0, r.z0 + 4.2]} />
      <TransferSwitch id={`ATS-${feed}`} feed={feed} position={[r.x1 - 1.4, 0, r.z0 + 4.2]} />
      {[0, 1, 2].map((i) => (
        <Ups key={i} id={`UPS-${feed}${i + 1}`} feed={feed} position={[r.x0 + 2.2 + i * 3.1, 0, r.z0 + 9]} rotationY={0} />
      ))}
      {/* Second switchboard for mechanical (cooling) loads, which are not on the UPS. */}
      <Switchgear id={`MSB-${feed}-MECH`} feed={feed} sections={5} position={[cx, 0, r.z1 - 1.2]} rotationY={Math.PI} />
      <Selectable id={`elec${feed}-busway`} type="busway" label={`Busbar trunking, feed ${feed}`}>
        <OverheadRuns runs={runs} tapSpacing={100} />
      </Selectable>
    </group>
  );
}

/** Battery room: two strings of Li-ion cabinets per power path, kept apart. */
function BatteryRoom(): ReactNode {
  const r = roomById("battery").rect;
  const strings: { feed: "A" | "B"; z: number; rot: number }[] = [
    { feed: "A", z: r.z0 + 3.4, rot: 0 },
    { feed: "A", z: r.z0 + 6.8, rot: Math.PI },
    { feed: "B", z: r.z1 - 5.6, rot: 0 },
    { feed: "B", z: r.z1 - 2.2, rot: Math.PI },
  ];
  return (
    <group>
      {strings.flatMap((s, si) =>
        Array.from({ length: 14 }, (_, i) => (
          <BatteryCabinet
            key={`${si}-${i}`}
            id={`BAT-${s.feed}${si % 2 + 1}-${String(i + 1).padStart(2, "0")}`}
            feed={s.feed}
            position={[r.x0 + 1.9 + i * 0.6, 0, s.z]}
            rotationY={s.rot}
          />
        )),
      )}
    </group>
  );
}

export function PowerRooms(): ReactNode {
  return (
    <group>
      <ElectricalRoom feed="A" />
      <ElectricalRoom feed="B" />
      <BatteryRoom />
    </group>
  );
}
