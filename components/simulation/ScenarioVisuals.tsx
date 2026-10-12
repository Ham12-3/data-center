import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import { Block, Box } from "@/components/common/Primitives";
import { GENSET_HEIGHT, BELLY_TANK_H } from "@/components/equipment/Generator";
import { CORE_RACKS, HALL_A, HALL_A_RACKS } from "@/data/halls";
import { GENERATORS, roomById } from "@/data/site";
import { hash01 } from "@/lib/random";
import { rackLocalToWorld } from "@/lib/rack/transform";
import { simClock } from "@/lib/sim/clock";
import { dataRoute } from "@/lib/sim/dataPaths";
import { live } from "@/lib/sim/live";
import { unitBox } from "@/lib/three/geometries";
import { glow, std } from "@/lib/three/materialCache";
import { renderState } from "@/lib/three/renderState";
import { useInteriorVisible, useStore } from "@/store/useStore";
import { FlowLine } from "./FlowLine";
import { useScenarioEffect } from "./useScenarioEffects";

// ---------------------------------------------------------------------------
// Lighting during a power cut
// ---------------------------------------------------------------------------

/** The ceiling fixtures share these cached materials (see building/Interior). */
const FIXTURES = [
  { mat: glow("#eef4ff", 1.3), base: new THREE.Color("#eef4ff").multiplyScalar(1.3 * 2.2) },
  { mat: glow("#ffe6c4", 1.2), base: new THREE.Color("#ffe6c4").multiplyScalar(1.2 * 2.2) },
];

/**
 * Lights flicker and drop to emergency level when the utility fails, until the
 * generators take over. Inside the building the whole view dims (exposure);
 * fixtures dim everywhere.
 */
function LightingEffects(): null {
  const get = useThree((s) => s.get);
  useFrame(() => {
    const f = live.effects.lightFactor;
    for (const { mat, base } of FIXTURES) mat.color.copy(base).multiplyScalar(0.08 + 0.92 * f);
    const inside = useStore.getState().cameraInside;
    get().gl.toneMappingExposure = renderState.exposure * (inside ? 0.3 + 0.7 * f : 1);
  });
  return null;
}

// ---------------------------------------------------------------------------
// Generator exhaust
// ---------------------------------------------------------------------------

const PUFFS_PER_STACK = 18;

/** Exhaust plumes from each stack: dark on start-up, lighter once at speed. */
function GeneratorExhaust(): ReactNode {
  const ref = useRef<THREE.Points>(null);
  const stacks = useMemo(() => GENERATORS.map((g) => new THREE.Vector3(g.x + 0.4, 0.2 + BELLY_TANK_H + GENSET_HEIGHT + 3.4, g.z)), []);
  const count = stacks.length * PUFFS_PER_STACK;
  const age = useRef(Float32Array.from({ length: count }, (_, i) => hash01("puff", i)));
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const material = useMemo(
    () => new THREE.PointsMaterial({ color: "#6b6f75", size: 1.6, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true }),
    [],
  );

  useFrame(() => {
    const pts = ref.current;
    if (!pts) return;
    const rpm = live.effects.generatorRpm;
    pts.visible = rpm > 0.01;
    if (!pts.visible) return;
    const mat = pts.material as THREE.PointsMaterial;
    // Cold start: thick dark smoke while cranking, a light haze once warm.
    mat.opacity = rpm < 0.95 ? 0.55 : 0.3;
    mat.color.set(rpm < 0.95 ? "#3f4247" : "#9aa0a6");
    const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const ages = age.current;
    for (let i = 0; i < count; i++) {
      ages[i] = (ages[i] + simClock.delta * 0.35) % 1;
      const s = stacks[Math.floor(i / PUFFS_PER_STACK)];
      const a = ages[i];
      // Rise and drift downwind (east) while spreading.
      arr[i * 3] = s.x + a * 6 + (hash01("pdx", i) - 0.5) * a * 3;
      arr[i * 3 + 1] = s.y + a * 9;
      arr[i * 3 + 2] = s.z + (hash01("pdz", i) - 0.5) * a * 3;
    }
    pos.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------------------------------------------------------------------------
// Failure markers (server, switch, fibre)
// ---------------------------------------------------------------------------

function FailureMarker({ position, label, interiorOnly }: { position: readonly [number, number, number]; label: string; interiorOnly: boolean }): ReactNode {
  const ref = useRef<THREE.Mesh>(null);
  const interior = useInteriorVisible();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(0.12 + 0.06 * Math.sin(clock.elapsedTime * 8));
  });
  if (interiorOnly && !interior) return null;
  return (
    <group position={[...position]}>
      <mesh ref={ref} material={glow("#ff3b30", 3)}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <Html position={[0, 0.5, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-red-950/90 px-2 py-0.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-400/60">{label}</div>
      </Html>
    </group>
  );
}

/** A small excavator by the north fibre trench. */
function Excavator(): ReactNode {
  const yellow = std("#f2b705", { roughness: 0.5 });
  const dark = std("#2b2f34", { roughness: 0.7 });
  return (
    <group position={[-7, 0, -38]} rotation={[0, 0.6, 0]}>
      <Block size={[2.4, 0.7, 3.4]} material={dark} />
      <Block size={[2.2, 1.1, 2.2]} position={[0, 0.8, 0.2]} material={yellow} bevel={0.08} />
      <Box size={[1.0, 0.9, 1.0]} position={[0.5, 2.3, -0.3]} material={std("#30475e", { roughness: 0.1 })} />
      <Box size={[0.35, 0.35, 3.2]} position={[-0.3, 2.4, 2.4]} rotation={[0.5, 0, 0]} material={yellow} />
      <Box size={[0.3, 0.3, 2.2]} position={[-0.3, 1.6, 4.4]} rotation={[-0.9, 0, 0]} material={yellow} />
      <Box size={[0.9, 0.5, 0.6]} position={[-0.3, 0.5, 5.0]} material={dark} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Fire: smoke, strobes, countdown, discharge and agent fog
// ---------------------------------------------------------------------------

const FIRE_RACK = HALL_A_RACKS.find((r) => r.id === "A05-10") ?? HALL_A_RACKS[0];
const HALL = roomById("hallA").rect;
// Module-level so per-frame updates mutate three.js objects, not React-owned values.
const strobeMat = new THREE.MeshBasicMaterial({ color: "#ff2020", toneMapped: false });
const fogMat = new THREE.MeshBasicMaterial({ color: "#eef3f8", transparent: true, opacity: 0, depthWrite: false });
const smokeMat = new THREE.PointsMaterial({ color: "#55585c", size: 0.5, transparent: true, opacity: 0.5, depthWrite: false });
const SMOKE_COUNT = 160;

function FireEffects(): ReactNode {
  const stage = useScenarioEffect((fx) => fx.fire.stage);
  const countdown = useScenarioEffect((fx) => (fx.fire.countdown === null ? null : Math.ceil(fx.fire.countdown)));
  const smokeRef = useRef<THREE.Points>(null);
  const fogRef = useRef<THREE.Mesh>(null);
  const smokeAge = useRef(Float32Array.from({ length: SMOKE_COUNT }, (_, i) => hash01("smoke", i)));
  const smokeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
    return g;
  }, []);
  const origin = useMemo(() => new THREE.Vector3(...rackLocalToWorld(FIRE_RACK.position, FIRE_RACK.rotationY, [0.1, 1.2, -0.3])), []);

  const strobes = useMemo<[number, number, number][]>(
    () => [
      [HALL.x0 + 0.2, 3.2, -18],
      [HALL.x0 + 0.2, 3.2, -4],
      [HALL.x1 - 0.2, 3.2, -18],
      [HALL.x1 - 0.2, 3.2, -4],
      [-30, 3.2, HALL.z0 + 0.2],
      [-16, 3.2, HALL.z0 + 0.2],
      [-30, 3.2, HALL.z1 - 0.2],
      [-16, 3.2, HALL.z1 - 0.2],
    ],
    [],
  );

  useFrame(({ clock }) => {
    const fire = live.effects.fire;
    // Red strobes flash during the alarm and discharge.
    const alarm = fire.stage === "fire1" || fire.stage === "fire2" || fire.stage === "discharge";
    const on = alarm && Math.floor(clock.elapsedTime * 3) % 2 === 0;
    strobeMat.color.set(on ? "#ff2020" : "#3a0d0d").multiplyScalar(on ? 4 : 1);
    // Agent fog builds up to design concentration.
    if (fogRef.current) {
      const mat = fogRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = fire.gas * 0.38;
      fogRef.current.visible = fire.gas > 0.01;
    }
    const pts = smokeRef.current;
    if (!pts) return;
    pts.visible = fire.smoke > 0.01;
    (pts.material as THREE.PointsMaterial).opacity = 0.55 * fire.smoke;
    const arr = (pts.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const ages = smokeAge.current;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      ages[i] = (ages[i] + simClock.delta * 0.25) % 1;
      const a = ages[i];
      arr[i * 3] = origin.x + (hash01("sx", i) - 0.5) * (0.3 + a * 2.5);
      arr[i * 3 + 1] = origin.y + a * 5;
      arr[i * 3 + 2] = origin.z + (hash01("sz", i) - 0.5) * (0.3 + a * 2.5);
    }
    pts.geometry.getAttribute("position").needsUpdate = true;
  });

  return (
    <group>
      {strobes.map((p, i) => (
        <mesh key={i} geometry={unitBox} material={strobeMat} position={p} scale={[0.18, 0.12, 0.18]} />
      ))}
      <points ref={smokeRef} geometry={smokeGeo} material={smokeMat} frustumCulled={false} />
      <mesh
        ref={fogRef}
        geometry={unitBox}
        material={fogMat}
        position={[(HALL.x0 + HALL.x1) / 2, (HALL_A.floorY + 6.8) / 2, (HALL.z0 + HALL.z1) / 2]}
        scale={[HALL.x1 - HALL.x0 - 0.2, 6.8 - HALL_A.floorY, HALL.z1 - HALL.z0 - 0.2]}
        renderOrder={5}
      />
      {stage === "discharge" && (
        <FlowLine
          points={[
            [-3.5, 6.2, -4.55],
            [-7.5, 6.2, -4.55],
            [-34, 6.2, -4.55],
          ]}
          color="#ffffff"
          radius={0.08}
          speed={30}
          spacing={2}
          opacity={0.4}
          intensity={3}
        />
      )}
      {countdown !== null && (
        <Html position={[-24, 4.5, -11]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="animate-pulse whitespace-nowrap rounded-lg bg-red-950/90 px-4 py-2 text-center ring-2 ring-red-500">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red-300">Evacuate · gas release in</div>
            <div className="text-3xl font-bold tabular-nums text-red-100">{countdown} s</div>
          </div>
        </Html>
      )}
      {stage !== "none" && (
        <Html position={[origin.x, origin.y + 2.2, origin.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-red-950/90 px-2 py-0.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-400/60">
            {stage === "extinguished" || stage === "ventilating" ? "Fire out · A05-10" : `Smoke detected · rack A05-10 · ${stage.toUpperCase()}`}
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Everything a running scenario adds to the 3D scene. */
export function ScenarioVisuals(): ReactNode {
  const scenarioId = useStore((s) => s.scenario?.id ?? null);
  const dataScenario = useStore((s) => s.sim.scenario);
  const fx = useScenarioEffect((e) => ({ server: e.failedServer, spine: e.failedSpine, fiber: e.fiberCut }));
  const interior = useInteriorVisible();
  const serverPos = useMemo(() => {
    const pts = dataRoute(dataScenario).points;
    return pts[pts.length - 1];
  }, [dataScenario]);
  const spinePos = useMemo(() => {
    const spine = CORE_RACKS.find((r) => r.id === "NC1-04") ?? CORE_RACKS[0];
    return rackLocalToWorld(spine.position, spine.rotationY, [0, 1.3, 0.7]);
  }, []);

  return (
    <group>
      <LightingEffects />
      <GeneratorExhaust />
      {fx.server && <FailureMarker position={serverPos} label="Server failed · health checks failing" interiorOnly />}
      {fx.spine && <FailureMarker position={spinePos} label="Spine switch NC1-04 down" interiorOnly />}
      {fx.fiber && (
        <>
          <FailureMarker position={[-2, 0.8, -37]} label="Fibre route A cut" interiorOnly={false} />
          <Excavator />
        </>
      )}
      {scenarioId === "fire" && interior && <FireEffects />}
    </group>
  );
}
