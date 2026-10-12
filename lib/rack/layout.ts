import type {
  DeviceStatus,
  RackFace,
  RackMountKind,
  RackSlotConfig,
} from "@/types/equipment";
import { RACK_UNITS, deviceHeight, uBottom, uCenter } from "@/lib/units";
import { MOUNT_SPECS } from "./mountSpecs";

/** A device placed in a rack, with derived geometry. Pure data, no Three.js. */
export interface RackItem {
  /** Stable id, unique within the scene: `${rackId}/U${uStart}-${face}`. */
  readonly id: string;
  readonly kind: RackMountKind;
  readonly uStart: number;
  readonly heightU: number;
  readonly face: RackFace;
  readonly status: DeviceStatus;
  readonly label: string;
  /** True if added automatically to fill an empty front position. */
  readonly autoFilled: boolean;
  /** Rack-local Y of the bottom edge and centre of the device. */
  readonly yBottom: number;
  readonly yCenter: number;
  readonly height: number;
}

const KIND_LABELS: Record<RackMountKind, string> = {
  "server-1u": "1U server",
  "server-2u": "2U server",
  "tor-switch": "Top-of-rack switch",
  "spine-switch": "Spine switch",
  "border-router": "Border router",
  "patch-panel": "Fibre patch panel",
  "blanking-panel": "Blanking panel",
};

function makeItem(
  rackId: string,
  kind: RackMountKind,
  uStart: number,
  heightU: number,
  face: RackFace,
  status: DeviceStatus,
  label: string,
  autoFilled: boolean,
): RackItem {
  return {
    id: `${rackId}/U${uStart}-${face}`,
    kind,
    uStart,
    heightU,
    face,
    status,
    label,
    autoFilled,
    yBottom: uBottom(uStart),
    yCenter: uCenter(uStart, heightU),
    height: deviceHeight(heightU),
  };
}

/**
 * Resolve an authored slot list into placed rack items.
 *
 * - Validates that every device fits within U1..U42 and that nothing overlaps.
 *   Front and rear faces are tracked separately: a full-depth server blocks
 *   both, while a shallow rear-mounted switch leaves its front position open.
 * - Fills every open front position with blanking panels. Without them, hot
 *   exhaust air would recirculate through the gaps into the cold aisle.
 *
 * Throws on invalid configuration: layouts are static data, so fail fast.
 */
export function resolveRackLayout(
  rackId: string,
  slots: readonly RackSlotConfig[],
): RackItem[] {
  // occupancy[face][u] -> id of the slot occupying it (1-based index).
  const occupancy: Record<RackFace, (string | null)[]> = {
    front: new Array<string | null>(RACK_UNITS + 1).fill(null),
    rear: new Array<string | null>(RACK_UNITS + 1).fill(null),
  };
  const items: RackItem[] = [];

  for (const slot of slots) {
    const spec = MOUNT_SPECS[slot.kind];
    const heightU = slot.heightU ?? spec.heightU;
    const face = slot.face ?? spec.defaultFace;
    const top = slot.u + heightU - 1;

    if (!Number.isInteger(slot.u) || slot.u < 1 || top > RACK_UNITS) {
      throw new Error(
        `[${rackId}] ${slot.kind} at U${slot.u} (${heightU}U) does not fit in U1-U${RACK_UNITS}`,
      );
    }

    const faces: RackFace[] = spec.fullDepth ? ["front", "rear"] : [face];
    const tag = `${slot.kind}@U${slot.u}`;
    for (const f of faces) {
      for (let u = slot.u; u <= top; u++) {
        const existing = occupancy[f][u];
        if (existing) {
          throw new Error(`[${rackId}] ${tag} overlaps ${existing} at U${u} (${f})`);
        }
        occupancy[f][u] = tag;
      }
    }

    items.push(
      makeItem(
        rackId,
        slot.kind,
        slot.u,
        heightU,
        face,
        slot.status ?? "ok",
        slot.label ?? KIND_LABELS[slot.kind],
        false,
      ),
    );
  }

  // Fill open front positions with blanking panels, preferring 2U panels.
  let u = 1;
  while (u <= RACK_UNITS) {
    if (occupancy.front[u]) {
      u++;
      continue;
    }
    const twoFree = u + 1 <= RACK_UNITS && !occupancy.front[u + 1];
    const heightU = twoFree ? 2 : 1;
    items.push(
      makeItem(rackId, "blanking-panel", u, heightU, "front", "ok", KIND_LABELS["blanking-panel"], true),
    );
    u += heightU;
  }

  return items.sort((a, b) => a.uStart - b.uStart || a.face.localeCompare(b.face));
}
