import type { RackFace, RackMountKind } from "@/types/equipment";
import { mm } from "@/lib/units";

export interface MountSpec {
  /** Nominal height in rack units (blanking panels may override). */
  readonly heightU: number;
  /** Body depth behind the mounting rail, metres. */
  readonly depth: number;
  readonly defaultFace: RackFace;
  /**
   * Full-depth devices span front-to-rear rails and block both faces of their
   * U positions. Shallow devices only occupy the face they mount on.
   */
  readonly fullDepth: boolean;
}

export const MOUNT_SPECS: Record<RackMountKind, MountSpec> = {
  "server-1u": { heightU: 1, depth: mm(720), defaultFace: "front", fullDepth: true },
  "server-2u": { heightU: 2, depth: mm(720), defaultFace: "front", fullDepth: true },
  // ToR switches are usually mounted at the rear so their ports face the server
  // NICs, with "port-side exhaust" airflow so they still breathe front-to-back.
  "tor-switch": { heightU: 1, depth: mm(450), defaultFace: "rear", fullDepth: false },
  // Spine switches and routers sit in network racks, ports facing the front.
  "spine-switch": { heightU: 2, depth: mm(600), defaultFace: "front", fullDepth: true },
  "border-router": { heightU: 4, depth: mm(700), defaultFace: "front", fullDepth: true },
  "patch-panel": { heightU: 1, depth: mm(60), defaultFace: "rear", fullDepth: false },
  "blanking-panel": { heightU: 1, depth: mm(4), defaultFace: "front", fullDepth: false },
};
