import type { RackSlotConfig } from "@/types/equipment";

/** Phase 1 test room, metres. The rack sits at the origin. */
export const DEMO_ROOM = { width: 12, depth: 9, height: 4 } as const;

/** 22 x 1U compute servers in U9-U30; the one in U17 is reporting a warning. */
const computeNodes: RackSlotConfig[] = Array.from({ length: 22 }, (_, i) => ({
  kind: "server-1u",
  u: 9 + i,
  status: 9 + i === 17 ? "warning" : "ok",
}));

/**
 * A typical enterprise compute rack, bottom to top:
 * - heavy 2U storage nodes at the bottom (keeps the centre of gravity low)
 * - a band of 1U compute servers
 * - a few 2U application servers
 * - two leaf (ToR) switches and a fibre patch panel at the top, rear-mounted
 * Empty front positions are filled with blanking panels automatically.
 * Roughly 28 servers x ~400 W ≈ 11 kW: a realistic modern air-cooled rack.
 */
export const DEMO_RACK_SLOTS: readonly RackSlotConfig[] = [
  { kind: "server-2u", u: 1, label: "Storage node" },
  { kind: "server-2u", u: 3, label: "Storage node" },
  { kind: "server-2u", u: 5, label: "Storage node" },
  ...computeNodes,
  { kind: "server-2u", u: 31, label: "Application server" },
  { kind: "server-2u", u: 33, label: "Application server" },
  { kind: "server-2u", u: 36, label: "Application server" },
  { kind: "tor-switch", u: 40, label: "Leaf switch B" },
  { kind: "tor-switch", u: 41, label: "Leaf switch A" },
  { kind: "patch-panel", u: 42, label: "Fibre patch panel" },
];
