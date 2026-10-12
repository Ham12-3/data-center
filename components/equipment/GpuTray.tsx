import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, Cyl } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { GPU_RACK, type GpuRackItem } from "@/lib/rack/gpuRack";
import { TRAY, type TrayPart, trayCoolantLoops, trayParts } from "@/lib/rack/gpuTray";
import { unitBox } from "@/lib/three/geometries";
import { PAL, glow, std } from "@/lib/three/materialCache";
import { mm } from "@/lib/units";
import { useStore } from "@/store/useStore";

const PART_MATERIAL: Record<TrayPart["kind"], THREE.Material> = {
  pan: std("#8f969e", { metalness: 1, roughness: 0.45 }),
  wall: std("#8f969e", { metalness: 1, roughness: 0.45 }),
  cover: std("#b8bec6", { metalness: 1, roughness: 0.35 }),
  pcb: std("#1d5c3a", { roughness: 0.6 }),
  gpu: std("#1f2b25", { roughness: 0.5 }),
  hbm: std("#141516", { roughness: 0.4 }),
  cpu: std("#1f2b25", { roughness: 0.5 }),
  lpddr: std("#202224", { roughness: 0.45 }),
  coldplate: std("#c9915f", { metalness: 1, roughness: 0.3 }),
  qd: std("#c4cad1", { metalness: 1, roughness: 0.25 }),
  nvlink: std("#c9a227", { metalness: 1, roughness: 0.3 }),
  busbar: std("#c27a3a", { metalness: 1, roughness: 0.3 }),
  nic: std("#1d5c3a", { roughness: 0.6 }),
  dpu: std("#2a3a5c", { roughness: 0.55 }),
  drive: std("#3b4048", { roughness: 0.5 }),
  fan: std("#18191b", { roughness: 0.6 }),
};
const DIE = std("#9aa0a6", { metalness: 1, roughness: 0.2 });
const SUPPLY = std(PAL.chwSupply, { roughness: 0.4 });
const RETURN = std(PAL.chwReturn, { roughness: 0.4 });

/** Where the tray sits when lifted off the rails onto the service cart (rack-local). */
const CART_Y = 1.05;
const CART_Z = GPU_RACK.frontZ + 1.25;

/** Smoothing rate for the tray's slide / lift animation (1/s). */
const EASE = 8;

interface GpuTrayProps {
  rackId: string;
  item: GpuRackItem;
  /** Rack transform, needed to turn the pointer ray into rail travel. */
  rackPosition: readonly [number, number, number];
  rackRotationY: number;
}

/**
 * A GPU compute tray pulled out for service. Drag its front handle to slide it
 * along the rails; the rear blind-mate couplings (coolant, NVLink, power)
 * separate after a few millimetres. From the panel it can be lifted onto a
 * service cart and exploded so every component can be inspected.
 */
export function GpuTray({ rackId, item, rackPosition, rackRotationY }: GpuTrayProps): ReactNode {
  const service = useStore((s) => s.trayService);
  const setExtension = useStore((s) => s.setTrayExtension);
  const get = useThree((s) => s.get);
  const parts = useMemo(() => trayParts(), []);
  const loops = useMemo(() => trayCoolantLoops(), []);
  const trayRef = useRef<THREE.Group>(null);
  const partRefs = useRef<(THREE.Group | null)[]>([]);
  const loopRef = useRef<THREE.Group>(null);
  const explode = useRef(0);
  const drag = useRef<{ s0: number; e0: number } | null>(null);

  const extension = service?.extension ?? 0;
  const removed = service?.removed ?? false;
  const exploded = service?.exploded ?? false;
  const baseZ = GPU_RACK.frontZ - TRAY.depth / 2;

  // Rail axis in world space: from the tray's home position, along the rack's front direction.
  const rail = useMemo(() => {
    const dir = new THREE.Vector3(Math.sin(rackRotationY), 0, Math.cos(rackRotationY));
    const origin = new THREE.Vector3(...rackPosition).addScaledVector(dir, baseZ).add(new THREE.Vector3(0, item.yCenter, 0));
    return { origin, dir };
  }, [rackPosition, rackRotationY, baseZ, item.yCenter]);

  /**
   * Closest point between the rail line (origin + s·dir) and the pointer ray
   * (o + t·v): s = (b·e − c·d) / (a·c − b²) with a = dir·dir, b = dir·v,
   * c = v·v, d = dir·w, e = v·w and w = origin − o.
   */
  const railParam = (ray: THREE.Ray): number | null => {
    const w = rail.origin.clone().sub(ray.origin);
    const a = rail.dir.dot(rail.dir);
    const b = rail.dir.dot(ray.direction);
    const c = ray.direction.dot(ray.direction);
    const d = rail.dir.dot(w);
    const e = ray.direction.dot(w);
    const denom = a * c - b * b;
    if (Math.abs(denom) < 1e-6) return null;
    return (b * e - c * d) / denom;
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (removed) return;
    e.stopPropagation();
    const s = railParam(e.ray);
    if (s === null) return;
    drag.current = { s0: s, e0: extension };
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    const controls = get().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = false;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const s = railParam(e.ray);
    if (s === null) return;
    setExtension(Math.min(TRAY.travel, Math.max(0, d.e0 + (s - d.s0))));
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    drag.current = null;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    const controls = get().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = true;
  };

  useFrame((_, dt) => {
    const g = trayRef.current;
    if (!g) return;
    const k = 1 - Math.exp(-EASE * dt);
    const ty = removed ? CART_Y : item.yCenter;
    const tz = removed ? CART_Z : baseZ + extension;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    explode.current += ((exploded ? 1 : 0) - explode.current) * k;
    parts.forEach((p, i) => {
      const ref = partRefs.current[i];
      if (ref) ref.position.y = p.explode * explode.current;
    });
    if (loopRef.current) loopRef.current.position.y = mm(190) * explode.current;
  });

  const deviceBase = `${rackId}/U${item.uStart}`;
  const decoupled = removed || extension > TRAY.decoupleAt;

  return (
    <group>
      <group ref={trayRef} position={[0, item.yCenter, baseZ]}>
        {parts.map((p, i) => (
          <group
            key={p.key}
            ref={(el) => {
              partRefs.current[i] = el;
            }}
          >
            {p.type ? (
              <Selectable id={`${deviceBase}/${p.key}`} type={p.type} label={`${p.label} · ${deviceBase}`}>
                <TrayPartMesh part={p} />
              </Selectable>
            ) : (
              <TrayPartMesh part={p} />
            )}
          </group>
        ))}
        <group ref={loopRef}>
          <PipeRuns runs={loops.supply} radius={mm(4)} material={SUPPLY} shared />
          <PipeRuns runs={loops.ret} radius={mm(4)} material={RETURN} shared />
        </group>
        {/* Front faceplate with pull handles: the drag handle. */}
        <group onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <Box size={[TRAY.width, TRAY.height, mm(4)]} position={[0, 0, TRAY.depth / 2 + mm(2)]} material={std("#23272d", { roughness: 0.5 })} />
          <Box size={[mm(6), TRAY.height - mm(6), mm(1)]} position={[mm(-208), 0, TRAY.depth / 2 + mm(4.5)]} material={std("#76b900")} cast={false} />
          {[-1, 1].map((s) => (
            <Box key={s} size={[mm(14), TRAY.height - mm(8), mm(26)]} position={[s * mm(205), 0, TRAY.depth / 2 + mm(16)]} material={std(PAL.steel, { metalness: 1, roughness: 0.3 })} />
          ))}
          <Box size={[mm(10), mm(10), mm(1)]} position={[mm(-192), mm(10), TRAY.depth / 2 + mm(4.5)]} material={glow(decoupled ? "#ffb020" : "#3dff6e", 2)} cast={false} />
        </group>
      </group>

      {/* Rack-side halves of the quick disconnects stay on the manifold hoses; their valves close as the tray leaves. */}
      {[
        [mm(-215), SUPPLY],
        [mm(228), RETURN],
      ].map(([x, mat], i) => (
        <group key={i} position={[x as number, item.yCenter, GPU_RACK.frontZ - TRAY.depth - mm(34)]}>
          <Cyl radius={mm(12)} height={mm(22)} rotation={[Math.PI / 2, 0, 0]} material={PART_MATERIAL.qd} />
          <Cyl radius={mm(13)} height={mm(5)} position={[0, 0, mm(-8)]} rotation={[Math.PI / 2, 0, 0]} material={mat as THREE.Material} />
          {decoupled && <Cyl radius={mm(9)} height={mm(2)} position={[0, 0, mm(12)]} rotation={[Math.PI / 2, 0, 0]} material={std("#e8eaec", { metalness: 1, roughness: 0.2 })} />}
        </group>
      ))}

      {/* Service cart, shown once the tray is lifted off the rails. */}
      {removed && (
        <group position={[0, 0, CART_Z]}>
          <Box size={[0.62, 0.03, 0.95]} position={[0, CART_Y - TRAY.height / 2 - 0.02, 0]} material={std("#4b5563", { roughness: 0.5 })} />
          <Box size={[0.58, 0.02, 0.9]} position={[0, 0.25, 0]} material={std("#4b5563", { roughness: 0.5 })} />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <group key={`${sx}${sz}`}>
                <Block size={[0.03, CART_Y - TRAY.height / 2 - 0.03, 0.03]} position={[sx * 0.28, 0.06, sz * 0.43]} material={std("#9aa3ad", { metalness: 1, roughness: 0.4 })} />
                <Cyl radius={0.04} height={0.03} position={[sx * 0.28, 0.04, sz * 0.43]} rotation={[0, 0, Math.PI / 2]} material={std("#18191b")} />
              </group>
            )),
          )}
        </group>
      )}
    </group>
  );
}

/** One tray component; GPUs also get their two compute dies drawn on top. */
function TrayPartMesh({ part }: { part: TrayPart }): ReactNode {
  return (
    <group>
      <mesh geometry={unitBox} material={PART_MATERIAL[part.kind]} position={[...part.pos]} scale={[...part.size]} castShadow receiveShadow />
      {part.kind === "gpu" &&
        [-1, 1].map((s) => (
          <mesh
            key={s}
            geometry={unitBox}
            material={DIE}
            position={[part.pos[0] + s * mm(9), part.pos[1] + part.size[1] / 2 + mm(0.6), part.pos[2]]}
            scale={[mm(16), mm(1.2), mm(34)]}
          />
        ))}
      {part.kind === "fan" && (
        <mesh position={[part.pos[0], part.pos[1], part.pos[2] + part.size[2] / 2 + mm(0.5)]} rotation={[Math.PI / 2, 0, 0]} scale={[mm(17), mm(1), mm(17)]}>
          <cylinderGeometry args={[1, 1, 1, 16]} />
          <meshStandardMaterial color="#3a3d42" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
