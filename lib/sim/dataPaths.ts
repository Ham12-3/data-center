import type { DataScenario } from "@/store/useStore";
import { CORE_RACKS, HALL_A, HALL_A_RACKS, HALL_B_LAYOUT, type RackPlacement } from "@/data/halls";
import { GPU_RACK } from "@/lib/rack/gpuRack";
import type { Vec3 } from "@/lib/rack/parts";
import { rackLocalToWorld } from "@/lib/rack/transform";
import { REAR_RAIL_Z, uCenter } from "@/lib/units";

/**
 * Routes for the data-flow simulation: the physical path a request takes from
 * a user on the internet to a server, hop by hop, with typical latencies.
 * Pure data: the renderer moves packets along `points` and the UI lists `hops`.
 */

export interface Hop {
  readonly name: string;
  readonly detail: string;
  /** Index into `points` where the packet reaches this hop. */
  readonly point: number;
  /** One-way latency added by this hop (or, for the server, processing time), ms. */
  readonly latencyMs: number;
}

export interface DataRoute {
  readonly scenario: DataScenario;
  readonly label: string;
  readonly target: RackPlacement;
  readonly points: readonly Vec3[];
  readonly hops: readonly Hop[];
  /** Packets emitted per second per unit of load. */
  readonly rate: number;
  /** Response packets per request (video sends a burst back). */
  readonly responseBurst: number;
}

const BACKBONE_Z = -10.8;
const BACKBONE_Y = HALL_A.floorY + 3.55;

const byId = (list: readonly RackPlacement[], id: string): RackPlacement => {
  const r = list.find((p) => p.id === id);
  if (!r) throw new Error(`Unknown rack ${id}`);
  return r;
};

/** Variations of a route caused by failures (from the scenario engine). */
export interface RouteOptions {
  /** The target server failed and the load balancer moved traffic to another rack. */
  readonly altTarget?: boolean;
  /** Spine switch to use (a failed spine is routed around). */
  readonly spine?: string;
  /** Which diverse fibre entry the traffic arrives on. */
  readonly entry?: "A" | "B";
}

interface ScenarioSpec {
  label: string;
  target: () => RackPlacement;
  altTarget: () => RackPlacement;
  wanMs: number;
  serverName: string;
  serverDetail: string;
  processingMs: number;
  rate: number;
  responseBurst: number;
}

const SCENARIOS: Record<DataScenario, ScenarioSpec> = {
  web: {
    label: "Web page request",
    target: () => byId(HALL_A_RACKS, "A02-08"),
    altTarget: () => byId(HALL_A_RACKS, "A02-14"),
    wanMs: 15,
    serverName: "Web server",
    serverDetail: "Renders the page (cache hit, some database lookups)",
    processingMs: 8,
    rate: 6,
    responseBurst: 2,
  },
  video: {
    label: "Video stream",
    target: () => byId(HALL_A_RACKS, "A03-10"),
    altTarget: () => byId(HALL_A_RACKS, "A03-15"),
    wanMs: 20,
    serverName: "Storage / streaming node",
    serverDetail: "Reads the next video segment from NVMe and streams it",
    processingMs: 4,
    rate: 3,
    responseBurst: 6,
  },
  database: {
    label: "Database query",
    target: () => byId(HALL_A_RACKS, "A07-12"),
    altTarget: () => byId(HALL_A_RACKS, "A07-16"),
    wanMs: 15,
    serverName: "Database node",
    serverDetail: "Index lookup, rows read from memory or NVMe",
    processingMs: 2,
    rate: 8,
    responseBurst: 1,
  },
  ai: {
    label: "AI inference request",
    target: () => byId(HALL_B_LAYOUT.racks, "B03-05"),
    altTarget: () => byId(HALL_B_LAYOUT.racks, "B03-08"),
    wanMs: 25,
    serverName: "GPU compute tray",
    serverDetail: "Runs the model on Blackwell GPUs (time to first token)",
    processingMs: 120,
    rate: 4,
    responseBurst: 3,
  },
};

/** Build the route for a scenario, optionally around a failure. */
export function dataRoute(scenario: DataScenario, opts: RouteOptions = {}): DataRoute {
  const spec = SCENARIOS[scenario];
  const target = opts.altTarget ? spec.altTarget() : spec.target();
  const router = byId(CORE_RACKS, "NC1-01");
  const spine = byId(CORE_RACKS, opts.spine ?? "NC1-04");
  const points: Vec3[] = [];
  const hops: Hop[] = [];
  const add = (p: Vec3) => points.push(p);
  const hop = (name: string, detail: string, latencyMs: number) => hops.push({ name, detail, latencyMs, point: points.length - 1 });

  if (opts.entry === "B") {
    // Diverse route: in from the west, overhead across Hall A to the Meet-Me Room.
    add([-170, 3, -18]);
    hop("Internet user", "Across the public internet, via the second carrier route", spec.wanMs + 0.3);
    add([-62, 0.5, -18]);
    hop("Fibre entry B", "Carrier fibre enters through the west vault", 0.005);
    add([-42.2, 0.6, -18]);
    add([-41.6, 4.4, -18]);
    add([-6.6, 4.4, -18]);
    add([-6.55, 1.6, -20.2]);
    hop("Entrance cabinet B", "Route B terminates on the west side of the MMR", 0.0001);
  } else {
    add([-2, 3, -170]);
    hop("Internet user", "Across the public internet and carrier backbone", spec.wanMs);
    add([-2, 0.5, -48]);
    hop("Fibre entry A", "Carrier fibre enters through the north vault", 0.005);
    add([-2, 0.6, -26.2]);
    add([0, 1.6, -25.0]);
    hop("Entrance cabinet", "Outside-plant fibre terminates", 0.0001);
  }
  add([0, 1.9, -20.5]);
  hop("Cross-connect", "Patch from the carrier to the facility's router", 0.0001);
  add([0, 3.0, -20.5]);
  add([0, 3.0, -12.6]);
  add(rackLocalToWorld(router.position, router.rotationY, [0, 1.5, 0.62]));
  hop("Border router", "BGP routing, filtering and DDoS protection", 0.03);
  add(rackLocalToWorld(spine.position, spine.rotationY, [0, 1.3, 0.62]));
  hop("Spine switch", "Forwards to the leaf of the target rack", 0.0006);
  add([spine.position[0], BACKBONE_Y, BACKBONE_Z]);

  // Along the overhead fibre backbone to the target row, then down the row.
  const isGpu = target.kind === "gpu";
  const top = isGpu ? GPU_RACK.height : 2.0;
  const above = rackLocalToWorld(target.position, target.rotationY, [0, top + 0.6, 0]);
  add([above[0], BACKBONE_Y, BACKBONE_Z]);
  add([above[0], BACKBONE_Y, above[2]]);
  if (isGpu) {
    add(rackLocalToWorld(target.position, target.rotationY, [0, top - 0.1, GPU_RACK.frontZ + 0.05]));
    hop("Leaf switch", "Rail-optimised leaf for this GPU rack's NICs", 0.0005);
    add(rackLocalToWorld(target.position, target.rotationY, [0.05, 1.15, GPU_RACK.frontZ + 0.02]));
  } else {
    add(rackLocalToWorld(target.position, target.rotationY, [0.15, uCenter(41, 1), REAR_RAIL_Z - 0.05]));
    hop("Leaf (ToR) switch", "Top-of-rack switch delivers to the server's NIC", 0.0005);
    add(rackLocalToWorld(target.position, target.rotationY, [-0.06, uCenter(20, 1), REAR_RAIL_Z + 0.02]));
  }
  hop(spec.serverName, spec.serverDetail, spec.processingMs);

  return { scenario, label: spec.label, target, points, hops, rate: spec.rate, responseBurst: spec.responseBurst };
}

/** Round-trip time: every network hop twice, plus server processing once. */
export function roundTripMs(route: DataRoute): number {
  const hops = route.hops;
  const network = hops.slice(0, -1).reduce((sum, h) => sum + h.latencyMs, 0);
  return 2 * network + hops[hops.length - 1].latencyMs;
}
