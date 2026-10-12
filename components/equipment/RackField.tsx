import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { EquipmentTypeId } from "@/types/equipment";
import type { RackKind, RackPlacement } from "@/data/halls";
import { cameraTracker } from "@/lib/cameraTracker";
import { live } from "@/lib/sim/live";
import { heatColor } from "@/lib/sim/model";
import { GPU_RACK } from "@/lib/rack/gpuRack";
import { roundedBox } from "@/lib/three/geometries";
import {
  blackEmissive,
  computeFrontEmissive,
  computeFrontMap,
  computeRearEmissive,
  computeRearMap,
  gpuFrontEmissive,
  gpuFrontMap,
  gpuRearMap,
} from "@/lib/three/rackFaceTextures";
import { RACK_DEPTH, RACK_HEIGHT, RACK_WIDTH } from "@/lib/units";
import { useStore } from "@/store/useStore";
import { GpuRack } from "./GpuRack";
import { Rack } from "./Rack";

type Shape = "rack42" | "gpu";

const DIMS: Record<Shape, [number, number, number]> = {
  rack42: [RACK_WIDTH, RACK_HEIGHT, RACK_DEPTH],
  gpu: [GPU_RACK.width, GPU_RACK.height, GPU_RACK.depth],
};

const TYPE_OF: Record<RackKind, EquipmentTypeId> = {
  compute: "rack",
  storage: "rack",
  network: "network-rack",
  gpu: "gpu-rack",
};

const CLICK_TOLERANCE = 5;
/** How often (ms) to re-pick which racks are close enough to draw in full detail. */
const LOD_INTERVAL = 250;

/**
 * Box materials in BoxGeometry face order (+X, -X, +Y, -Y, +Z, -Z). Rack-local
 * +Z is the front, so faces 4 and 5 carry the front and rear door paintings.
 */
function useShellMaterials(shape: Shape): THREE.Material[] {
  return useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: "#2a2e34", metalness: 0, roughness: 0.48 });
    const top = new THREE.MeshStandardMaterial({ color: "#23262b", metalness: 0, roughness: 0.6 });
    const face = (map: THREE.Texture, emissiveMap: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: "#ffffff", emissiveIntensity: 3, metalness: 0, roughness: 0.5 });
    const front = shape === "gpu" ? face(gpuFrontMap(), gpuFrontEmissive()) : face(computeFrontMap(), computeFrontEmissive());
    const rear = shape === "gpu" ? face(gpuRearMap(), blackEmissive()) : face(computeRearMap(), computeRearEmissive());
    return [side, side, top, top, front, rear];
  }, [shape]);
}

interface ShellProps {
  shape: Shape;
  placements: readonly RackPlacement[];
  hidden: ReadonlySet<string>;
}

/** All far-away racks of one shape as a single instanced, multi-material bevelled box (geometry at true size). */
function RackShells({ shape, placements, hidden }: ShellProps): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  const materials = useShellMaterials(shape);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const [w, h, d] = DIMS[shape];

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    placements.forEach((r, i) => {
      q.setFromAxisAngle(yAxis, r.rotationY);
      p.set(r.position[0], r.position[1] + h / 2, r.position[2]);
      // Racks drawn in detail are hidden here by collapsing their instance.
      if (hidden.has(r.id)) s.set(0, 0, 0);
      else s.set(1, 1, 1);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements, hidden, w, h, d]);

  // Heat-map mode tints each cabinet by its inlet temperature (refreshed once a second).
  const tint = useRef({ since: 1, wasOn: false });
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const on = useStore.getState().sim.layers.heatmap;
    tint.current.since += dt;
    if (on === tint.current.wasOn && (!on || tint.current.since < 1)) return;
    tint.current.since = 0;
    tint.current.wasOn = on;
    const c = new THREE.Color();
    placements.forEach((r, i) => {
      const st = live.metrics.racks.get(r.id);
      if (on && st) c.setRGB(...heatColor(st.inletC, 18, 32));
      else c.set("#ffffff");
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>): RackPlacement | undefined =>
    e.instanceId === undefined ? undefined : placements[e.instanceId];

  return (
    <instancedMesh
      key={placements.length}
      ref={ref}
      args={[roundedBox(w, h, d, 0.012), materials, placements.length]}
      castShadow
      receiveShadow
      onClick={(e) => {
        const r = pick(e);
        if (!r || e.delta > CLICK_TOLERANCE) return;
        e.stopPropagation();
        select({ id: r.id, type: TYPE_OF[r.kind], label: r.label });
      }}
      onPointerMove={(e) => {
        const r = pick(e);
        if (!r) return;
        e.stopPropagation();
        if (useStore.getState().hovered?.id !== r.id) hover({ id: r.id, type: TYPE_OF[r.kind], label: r.label });
      }}
      onPointerOut={() => hover(null)}
    />
  );
}

interface RackFieldProps {
  placements: readonly RackPlacement[];
  /** Maximum number of racks drawn in full detail at once. */
  maxDetailed?: number;
  /** Distance (m) within which a rack is drawn in full detail. */
  radius?: number;
}

/**
 * Level of detail for a hall full of racks. Every rack is an instanced box
 * with a painted front, which costs a single draw call; the few racks nearest
 * the camera, plus the selected one, are swapped for fully modelled racks.
 * Swapping is cheap because detailed geometry is cached per rack model.
 */
export function RackField({ placements, maxDetailed = 10, radius = 7 }: RackFieldProps): ReactNode {
  const [detailed, setDetailed] = useState<readonly string[]>([]);
  const selectedId = useStore((s) => s.selected?.id);
  const globalDoors = useStore((s) => s.rackDoorsOpen);

  const byShape = useMemo(
    () => ({
      rack42: placements.filter((p) => p.kind !== "gpu"),
      gpu: placements.filter((p) => p.kind === "gpu"),
    }),
    [placements],
  );

  useEffect(() => {
    const tick = () => {
      const { x, y, z } = cameraTracker;
      const near: { id: string; d: number }[] = [];
      for (const p of placements) {
        const dx = p.position[0] - x;
        const dy = p.position[1] + 1 - y;
        const dz = p.position[2] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < radius) near.push({ id: p.id, d });
      }
      near.sort((a, b) => a.d - b.d);
      const ids = near.slice(0, maxDetailed).map((n) => n.id);
      // The selected rack (or the rack holding a selected device / tray in service) is always detailed.
      const { selected, trayService } = useStore.getState();
      for (const key of [selected?.id, trayService?.rackId]) {
        if (!key) continue;
        const rack = placements.find((p) => key === p.id || key.startsWith(`${p.id}/`));
        if (rack && !ids.includes(rack.id)) ids.push(rack.id);
      }
      ids.sort();
      setDetailed((prev) => (prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids));
    };
    tick();
    const t = window.setInterval(tick, LOD_INTERVAL);
    return () => window.clearInterval(t);
  }, [placements, maxDetailed, radius]);

  const hidden = useMemo(() => new Set(detailed), [detailed]);
  const lookup = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);

  return (
    // Racks swap between instanced shells and detailed models as the camera moves: never statically batched.
    <group userData={{ noBatch: true }}>
      {byShape.rack42.length > 0 && <RackShells shape="rack42" placements={byShape.rack42} hidden={hidden} />}
      {byShape.gpu.length > 0 && <RackShells shape="gpu" placements={byShape.gpu} hidden={hidden} />}
      {detailed.map((id) => {
        const p = lookup.get(id);
        if (!p) return null;
        const isSelected = selectedId === p.id;
        return (
          <Select key={id} enabled={isSelected}>
            {p.kind === "gpu" ? (
              <GpuRack id={p.id} position={p.position} rotationY={p.rotationY} />
            ) : (
              <Rack id={p.id} slots={p.slots ?? []} position={p.position} rotationY={p.rotationY} doorsOpen={globalDoors || isSelected} />
            )}
          </Select>
        );
      })}
    </group>
  );
}
