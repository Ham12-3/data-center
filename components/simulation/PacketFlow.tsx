import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import { simClock } from "@/lib/sim/clock";
import { type DataRoute, dataRoute } from "@/lib/sim/dataPaths";
import { glow } from "@/lib/three/materialCache";
import { BUILDING } from "@/data/site";
import { useInteriorVisible, useStore } from "@/store/useStore";
import { FlowLine } from "./FlowLine";
import { useScenarioEffect } from "./useScenarioEffects";
import { live } from "@/lib/sim/live";

const POOL = 240;
/** Visual travel speed along the route, m/s of simulation time. */
const SPEED = 28;
const sphere = new THREE.SphereGeometry(1, 10, 8);
const requestMat = glow("#3dff6e", 1.6);
const responseMat = glow("#b5ff6a", 1.6);

interface Packet {
  alive: boolean;
  /** Distance travelled along the route, m. */
  d: number;
  /** true = request (towards the server), false = response. */
  out: boolean;
  /** Delay before starting (staggers a response burst), s. */
  wait: number;
}

/** Cumulative lengths along a polyline, for constant-speed travel. */
function measure(points: readonly (readonly [number, number, number])[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
  }
  return { cum, total: cum[cum.length - 1] };
}

function pointAt(route: DataRoute, cum: number[], d: number, out: THREE.Vector3): THREE.Vector3 {
  const pts = route.points;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
  const a = pts[i - 1];
  const b = pts[i];
  return out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/**
 * Data-flow simulation. Requests (green) travel from the internet through the
 * fibre entry, cross-connect, border router and spine to the target rack's leaf
 * switch and server; the server flashes while "processing", then responses
 * (lime) travel back. Emission rate scales with load. Pooled instances only.
 */
export function PacketFlow(): ReactNode {
  const scenario = useStore((s) => s.sim.scenario);
  // Failures from the scenario engine change the route once traffic has been rerouted.
  const fail = useScenarioEffect((fx) => ({
    server: fx.failedServer,
    spine: fx.failedSpine,
    fiber: fx.fiberCut,
    rerouted: fx.rerouted,
  }));
  const route = useMemo(
    () =>
      dataRoute(scenario, {
        altTarget: fail.server && fail.rerouted,
        spine: fail.spine && fail.rerouted ? "NC1-05" : undefined,
        entry: fail.fiber && fail.rerouted ? "B" : "A",
      }),
    [scenario, fail.server, fail.spine, fail.fiber, fail.rerouted],
  );
  const { cum, total } = useMemo(() => measure(route.points), [route]);
  const reqRef = useRef<THREE.InstancedMesh>(null);
  const resRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const dropRef = useRef<THREE.Mesh>(null);
  const drop = useRef(0);
  const packets = useRef<Packet[]>(Array.from({ length: POOL }, () => ({ alive: false, d: 0, out: true, wait: 0 })));
  const emitAcc = useRef(0);
  const flash = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), []);
  const serverPos = route.points[route.points.length - 1];
  const interior = useInteriorVisible();
  const F = BUILDING.footprint;
  const indoors = (p: readonly [number, number, number]) => p[0] > F.x0 && p[0] < F.x1 && p[2] > F.z0 && p[2] < F.z1;

  const activeRoute = useRef(route);

  // During the failover window, requests die at the failed element (red flash).
  const breakDist = useMemo(() => {
    const at = (name: string) => {
      const h = route.hops.find((x) => x.name === name);
      return h ? cum[h.point] : total;
    };
    if (fail.spine) return at("Spine switch");
    if (fail.fiber) return at("Fibre entry A");
    return total;
  }, [route, cum, total, fail.spine, fail.fiber]);
  const breakPos = useMemo(() => pointAt(route, cum, breakDist, new THREE.Vector3()), [route, cum, breakDist]);

  useFrame(() => {
    const dt = simClock.delta;
    // Reset the pool when the scenario (and so the route) changes.
    if (activeRoute.current !== route) {
      activeRoute.current = route;
      for (const p of packets.current) p.alive = false;
    }
    const load = useStore.getState().sim.load;
    const pool = packets.current;

    // Emit new requests at a rate proportional to load.
    emitAcc.current += dt * route.rate * (0.15 + load);
    while (emitAcc.current >= 1) {
      emitAcc.current -= 1;
      const free = pool.find((p) => !p.alive);
      if (free) Object.assign(free, { alive: true, d: 0, out: true, wait: 0 });
    }

    for (const p of pool) {
      if (!p.alive) continue;
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      p.d += dt * SPEED;
      if (p.out && live.effects.dropping && p.d >= breakDist) {
        // Lost in the failover window: no response comes back.
        p.alive = false;
        drop.current = 1;
        continue;
      }
      if (p.d >= total) {
        p.alive = false;
        if (p.out) {
          // Arrived at the server: flash, then send a burst of responses back.
          flash.current = 1;
          for (let k = 0; k < route.responseBurst; k++) {
            const free = pool.find((q) => !q.alive);
            if (free) Object.assign(free, { alive: true, d: 0, out: false, wait: 0.12 + k * 0.08 });
          }
        }
      }
    }

    const { m, p, q, s } = tmp;
    let nReq = 0;
    let nRes = 0;
    for (const pk of pool) {
      if (!pk.alive || pk.wait > 0) continue;
      pointAt(route, cum, pk.out ? pk.d : total - pk.d, p);
      // Packets look bigger outdoors so they read from the air.
      const r = p.y < 2.5 && Math.abs(p.z) < 30 ? 0.07 : p.z < -30 ? 0.5 : 0.12;
      s.setScalar(r);
      m.compose(p, q, s);
      if (pk.out && reqRef.current) reqRef.current.setMatrixAt(nReq++, m);
      else if (!pk.out && resRef.current) resRef.current.setMatrixAt(nRes++, m);
    }
    for (const [mesh, n] of [
      [reqRef.current, nReq],
      [resRef.current, nRes],
    ] as const) {
      if (!mesh) continue;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }

    drop.current = Math.max(0, drop.current - dt * 3);
    if (dropRef.current) {
      dropRef.current.scale.setScalar(0.08 + 0.3 * drop.current);
      dropRef.current.visible = drop.current > 0.01;
    }

    // Server "processing" glow, decaying after each arrival.
    flash.current = Math.max(0, flash.current - dt * 2.5);
    if (flashRef.current) {
      flashRef.current.scale.setScalar(0.05 + 0.18 * flash.current);
      flashRef.current.visible = flash.current > 0.01;
    }
  });

  return (
    <group>
      <FlowLine points={route.points} color="#3dff6e" radius={0.025} speed={6} spacing={2.5} opacity={0.35} />
      <instancedMesh ref={reqRef} args={[sphere, requestMat, POOL]} frustumCulled={false} />
      <instancedMesh ref={resRef} args={[sphere, responseMat, POOL]} frustumCulled={false} />
      <mesh ref={flashRef} geometry={sphere} material={glow("#eafff0", 3)} position={[...serverPos]} visible={false} />
      <mesh ref={dropRef} geometry={sphere} material={glow("#ff3b30", 3)} position={breakPos} visible={false} />
      {route.hops.map((h) => {
        const pt = route.points[h.point];
        // Labels for equipment inside the building only make sense when you can see inside.
        if (!interior && indoors(pt)) return null;
        return (
          <Html key={h.name} position={[pt[0], pt[1] + 0.45, pt[2]]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded bg-emerald-950/85 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-400/40">
              {h.name} · {h.latencyMs >= 1 ? `${h.latencyMs} ms` : `${(h.latencyMs * 1000).toFixed(1)} µs`}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
