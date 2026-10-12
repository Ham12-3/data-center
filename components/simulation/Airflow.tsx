import { useFrame } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import { FAN_WALL_DIMS } from "@/components/equipment/Cooling";
import { HALL_A, HALL_B, hallAPodX, hallARowZ0, hallARowZ1, hallBPodX, hallBRowZ0, hallBRowZ1 } from "@/data/halls";
import { BUILDING, roomById } from "@/data/site";
import { hash01 } from "@/lib/random";
import { simClock } from "@/lib/sim/clock";
import { live } from "@/lib/sim/live";
import { RACK_DEPTH } from "@/lib/units";

const COLD = new THREE.Color("#3b9dff");
const HOT = new THREE.Color("#ff4b2b");
const CEILING_Y = BUILDING.partitionHeight - 0.9;

/**
 * A particle's journey is a fixed polyline of waypoints with a temperature
 * (0 = cold supply air, 1 = hot exhaust) at each. The particle advances along
 * it at a rate proportional to fan speed, and its colour is interpolated from
 * the temperatures, so it visibly turns from blue to red inside the rack.
 */
interface Journey {
  readonly pts: Float32Array; // xyz per waypoint
  readonly temps: Float32Array;
  readonly cum: Float32Array; // cumulative length
  readonly total: number;
}

function journey(waypoints: [number, number, number, number][]): Journey {
  const n = waypoints.length;
  const pts = new Float32Array(n * 3);
  const temps = new Float32Array(n);
  const cum = new Float32Array(n);
  waypoints.forEach(([x, y, z, t], i) => {
    pts.set([x, y, z], i * 3);
    temps[i] = t;
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(x - pts[i * 3 - 3], y - pts[i * 3 - 2], z - pts[i * 3 - 1]);
  });
  return { pts, temps, cum, total: cum[n - 1] };
}

/**
 * Hall A (raised floor, cold-aisle containment, CRAHs on the north and south
 * walls): cold air rises through perforated tiles into the cold aisle, is drawn
 * through the servers (heating up), exhausts into the hot aisle, rises to the
 * ceiling and drifts back to the nearest CRAH, which cools it and pushes it
 * under the floor again.
 */
function hallAJourneys(count: number): Journey[] {
  const FY = HALL_A.floorY;
  const room = roomById("hallA").rect;
  const list: Journey[] = [];
  for (let i = 0; i < count; i++) {
    const p = Math.floor(hash01("afp", i) * HALL_A.pods);
    const base = hallAPodX(p);
    const coldX = base + RACK_DEPTH + HALL_A.aisle / 2 + (hash01("afx", i) - 0.5) * 0.9;
    const west = hash01("afs", i) < 0.5;
    const faceX = west ? base + RACK_DEPTH : base + RACK_DEPTH + HALL_A.aisle;
    const rearX = west ? base : base + 2 * RACK_DEPTH + HALL_A.aisle;
    const hotX = rearX + (west ? -0.55 : 0.55);
    const z = hallARowZ0 + 0.3 + hash01("afz", i) * (hallARowZ1 - hallARowZ0 - 0.6);
    const h = FY + 0.25 + hash01("afh", i) * 1.7;
    const north = z < HALL_A.rowCenterZ;
    const wallZ = north ? room.z0 + 1.6 : room.z1 - 1.6;
    // CRAHs sit at the ends of the hot aisles, so return air drifts along the hot aisle.
    list.push(
      journey([
        [coldX, FY + 0.02, z, 0],
        [coldX, h, z, 0.02],
        [faceX, h, z, 0.05],
        [rearX, h, z, 0.95],
        [hotX, h + 0.3, z, 1],
        [hotX, CEILING_Y, z, 0.95],
        [hotX, CEILING_Y, wallZ, 0.85],
        [hotX, FY + 2.6, wallZ, 0.8],
      ]),
    );
  }
  return list;
}

/**
 * Hall B (slab floor, fan walls on the north wall, hot-aisle containment):
 * fan walls blow cold air south down the open cold aisles; racks draw it in,
 * exhaust into the contained hot aisle (only ~15% of GPU heat leaves as air),
 * and it rises through the ceiling plenum back north to the fan walls.
 */
function hallBJourneys(count: number): Journey[] {
  const room = roomById("hallB").rect;
  const list: Journey[] = [];
  const pitch = 2 * HALL_B.rowDepth + HALL_B.hotAisle + HALL_B.coldAisle;
  for (let i = 0; i < count; i++) {
    const p = Math.floor(hash01("bfp", i) * HALL_B.pods);
    const base = hallBPodX(p);
    const eastSide = hash01("bfs", i) < 0.5;
    const coldX = eastSide ? base + pitch - HALL_B.coldAisle / 2 : base - HALL_B.coldAisle / 2;
    const faceX = eastSide ? base + 2 * HALL_B.rowDepth + HALL_B.hotAisle : base;
    const hotX = base + HALL_B.rowDepth + HALL_B.hotAisle / 2 + (hash01("bfh", i) - 0.5) * 0.8;
    const z = hallBRowZ0 + 0.4 + hash01("bfz", i) * (hallBRowZ1 - hallBRowZ0 - 0.8);
    const h = 0.3 + hash01("bfy", i) * 1.8;
    const fwZ = room.z0 + FAN_WALL_DIMS[2] + 0.2;
    const startX = coldX + (hash01("bfx", i) - 0.5) * 2.5;
    list.push(
      journey([
        [startX, 0.6 + hash01("bfy0", i) * 2.6, fwZ, 0],
        [coldX, h, hallBRowZ0 - 1, 0.02],
        [coldX, h, z, 0.05],
        [faceX, h, z, 0.1],
        [hotX, h, z, 0.75],
        [hotX, CEILING_Y, z, 0.7],
        [hotX, CEILING_Y, fwZ + 0.5, 0.6],
        [startX, FAN_WALL_DIMS[1] - 0.3, fwZ - 0.6, 0.55],
      ]),
    );
  }
  return list;
}

const HALL_A_PARTICLES = 1400;
const HALL_B_PARTICLES = 700;

/**
 * Airflow simulation as a single point cloud. Positions and colours are
 * written on the CPU each frame (cheap at ~2,000 particles).
 */
export function Airflow(): ReactNode {
  const journeys = useMemo(() => [...hallAJourneys(HALL_A_PARTICLES), ...hallBJourneys(HALL_B_PARTICLES)], []);
  const progress = useRef<Float32Array>(Float32Array.from(journeys, (_, i) => hash01("afprog", i)));
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(journeys.length * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(journeys.length * 3), 3));
    return g;
  }, [journeys]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.14,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        sizeAttenuation: true,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const pts = pointsRef.current;
    if (!pts) return;
    const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = pts.geometry.getAttribute("color") as THREE.BufferAttribute;
    const pArr = pos.array as Float32Array;
    const cArr = col.array as Float32Array;
    // Air speed follows fan speed; a full loop takes ~10-20 s.
    const rate = simClock.delta * (0.03 + 0.07 * live.metrics.fanSpeed);
    const prog = progress.current;
    for (let i = 0; i < journeys.length; i++) {
      const j = journeys[i];
      prog[i] = (prog[i] + rate) % 1;
      const d = prog[i] * j.total;
      let k = 1;
      while (k < j.cum.length - 1 && j.cum[k] < d) k++;
      const seg = j.cum[k] - j.cum[k - 1] || 1;
      const t = Math.min(1, Math.max(0, (d - j.cum[k - 1]) / seg));
      for (let a = 0; a < 3; a++) pArr[i * 3 + a] = j.pts[(k - 1) * 3 + a] + (j.pts[k * 3 + a] - j.pts[(k - 1) * 3 + a]) * t;
      const temp = j.temps[k - 1] + (j.temps[k] - j.temps[k - 1]) * t;
      tmp.copy(COLD).lerp(HOT, temp);
      cArr[i * 3] = tmp.r;
      cArr[i * 3 + 1] = tmp.g;
      cArr[i * 3 + 2] = tmp.b;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
