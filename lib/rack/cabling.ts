import type { PowerFeed } from "@/types/equipment";
import type { RackItem } from "./layout";
import type { Vec3 } from "./parts";
import { pduOutletForU } from "./pdu";
import { patchPanelAdapter } from "./recipes/passive";
import { serverNicPort, serverPsuInlet } from "./recipes/server";
import { ACCESS_PORTS, switchAccessPort, switchUplinkPort } from "./recipes/torSwitch";
import { mm } from "@/lib/units";

export type CableKind = "powerA" | "powerB" | "copper" | "fiber";

export interface CableRoute {
  readonly kind: CableKind;
  /** Control points for a smooth curve, rack-local. First and last are the plugs. */
  readonly points: readonly Vec3[];
}

export interface ConnectionPlan {
  readonly servers: readonly RackItem[];
  /** Leaf A is the upper ToR switch, leaf B the one below it. */
  readonly leafA: RackItem | null;
  readonly leafB: RackItem | null;
  readonly patchPanel: RackItem | null;
  readonly uplinksPerSwitch: number;
}

/**
 * Decide which devices are cabled to which. Every server is dual-homed: NIC 0
 * to leaf A and NIC 1 to leaf B (same port number on each), so losing either
 * switch leaves every server reachable. Each leaf sends 4 x 100G uplinks to the
 * patch panel, from where structured cabling runs to the spine switches.
 */
export function connectionPlan(items: readonly RackItem[]): ConnectionPlan {
  const servers = items
    .filter((i) => i.kind === "server-1u" || i.kind === "server-2u")
    .slice(0, ACCESS_PORTS);
  const leaves = items.filter((i) => i.kind === "tor-switch").sort((a, b) => b.uStart - a.uStart);
  return {
    servers,
    leafA: leaves[0] ?? null,
    leafB: leaves[1] ?? null,
    patchPanel: items.find((i) => i.kind === "patch-panel") ?? null,
    uplinksPerSwitch: 4,
  };
}

const add = (p: Vec3, dx: number, dy: number, dz: number): Vec3 => [p[0] + dx, p[1] + dy, p[2] + dz];

/** Power cord: PSU inlet -> short drop -> sag -> PDU outlet at the same height. */
function powerCord(server: RackItem, feed: PowerFeed): CableRoute {
  const start = serverPsuInlet(server, feed);
  const end = pduOutletForU(feed, server.uStart);
  const side = feed === "A" ? -1 : 1;
  return {
    kind: feed === "A" ? "powerA" : "powerB",
    points: [
      start,
      add(start, 0, -mm(4), -mm(45)),
      [side * mm(212), (start[1] + end[1]) / 2 - mm(18), mm(-420)],
      add(end, -side * mm(18), 0, 0),
      end,
    ],
  };
}

/**
 * Copper data cable from a server NIC up to a ToR port. Cables leave the NIC
 * rearwards, join a vertical bundle (spread slightly per cable so it reads as a
 * bundle rather than one tube), rise to the switch, then turn into the port.
 */
function dataCable(nic: Vec3, port: Vec3, laneIndex: number, nicIndex: 0 | 1): CableRoute {
  const laneX = mm(-150) + nicIndex * mm(40) + (laneIndex % 5) * mm(6);
  const laneZ = mm(-330) - (Math.floor(laneIndex / 5) % 4) * mm(7);
  return {
    kind: "copper",
    points: [
      nic,
      add(nic, 0, 0, -mm(40)),
      [laneX, nic[1] + mm(25), laneZ],
      [laneX, port[1] - mm(45), laneZ],
      add(port, 0, -mm(8), -mm(45)),
      port,
    ],
  };
}

/** Short fibre jumper looping from a switch uplink to the patch panel above. */
function fiberJumper(port: Vec3, adapter: Vec3): CableRoute {
  return {
    kind: "fiber",
    points: [port, add(port, 0, 0, -mm(40)), add(adapter, 0, -mm(10), -mm(45)), adapter],
  };
}

export function buildCableRoutes(items: readonly RackItem[]): CableRoute[] {
  const plan = connectionPlan(items);
  const routes: CableRoute[] = [];

  plan.servers.forEach((server, k) => {
    routes.push(powerCord(server, "A"), powerCord(server, "B"));
    if (plan.leafA) routes.push(dataCable(serverNicPort(server, 0), switchAccessPort(plan.leafA, k), k, 0));
    if (plan.leafB) routes.push(dataCable(serverNicPort(server, 1), switchAccessPort(plan.leafB, k), k, 1));
  });

  if (plan.patchPanel) {
    const pp = plan.patchPanel;
    [plan.leafA, plan.leafB].forEach((leaf, li) => {
      if (!leaf) return;
      for (let i = 0; i < plan.uplinksPerSwitch; i++) {
        routes.push(fiberJumper(switchUplinkPort(leaf, i), patchPanelAdapter(pp, 16 + li * plan.uplinksPerSwitch + i)));
      }
    });
  }

  return routes;
}
