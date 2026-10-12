import type { RackItem } from "./layout";
import { PartSink } from "./parts";
import { buildBlankingPanel, buildPatchPanel } from "./recipes/passive";
import { buildServer } from "./recipes/server";
import { buildTorSwitch } from "./recipes/torSwitch";
import { buildBorderRouter, buildSpineSwitch } from "./recipes/spine";
import { connectionPlan } from "./cabling";

/**
 * Turn placed rack items into instancing-ready part lists. Each part keeps the
 * index of its owning item so a raycast hit on an instance maps back to a device.
 */
export function buildRackParts(items: readonly RackItem[]): PartSink {
  const sink = new PartSink();
  const plan = connectionPlan(items);

  items.forEach((item, owner) => {
    switch (item.kind) {
      case "server-1u":
      case "server-2u":
        buildServer(item, owner, sink);
        break;
      case "tor-switch":
        buildTorSwitch(item, owner, sink, {
          connectedAccess: plan.servers.length,
          connectedUplinks: plan.patchPanel ? plan.uplinksPerSwitch : 0,
        });
        break;
      case "spine-switch":
        buildSpineSwitch(item, owner, sink);
        break;
      case "border-router":
        buildBorderRouter(item, owner, sink);
        break;
      case "patch-panel":
        buildPatchPanel(item, owner, sink);
        break;
      case "blanking-panel":
        buildBlankingPanel(item, owner, sink);
        break;
    }
  });

  return sink;
}
