import { useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { HALL_A, HALL_A_RACKS, HALL_B_LAYOUT, type RackPlacement } from "@/data/halls";
import { type Rect, roomById } from "@/data/site";
import { live } from "@/lib/sim/live";
import { HALL_A_SUPPLY_C, HALL_B_SUPPLY_C, heatColor } from "@/lib/sim/model";
import { unitPlane } from "@/lib/three/geometries";

const CELL = 0.5;
/** Gaussian kernel width for spreading each sample point's temperature, m. */
const SIGMA = 0.75;
const REFRESH_S = 1;

interface Sample {
  readonly x: number;
  readonly z: number;
  readonly rackId: string;
  readonly side: "inlet" | "exhaust";
}

/**
 * Each rack contributes two sample points: one in front (its inlet
 * temperature) and one behind (its exhaust temperature).
 */
function samplesFor(racks: readonly RackPlacement[], reach: number): Sample[] {
  const out: Sample[] = [];
  for (const r of racks) {
    const fx = Math.sin(r.rotationY);
    const fz = Math.cos(r.rotationY);
    out.push({ x: r.position[0] + fx * reach, z: r.position[2] + fz * reach, rackId: r.id, side: "inlet" });
    out.push({ x: r.position[0] - fx * reach, z: r.position[2] - fz * reach, rackId: r.id, side: "exhaust" });
  }
  return out;
}

interface FloorMapProps {
  rect: Rect;
  y: number;
  racks: readonly RackPlacement[];
  ambientC: number;
}

/**
 * Thermal map painted on a hall floor. Every second, each cell's temperature
 * is the kernel-weighted average of nearby sample points blended with the room
 * ambient, then mapped through the blue→red heat palette into a DataTexture.
 */
function FloorMap({ rect, y, racks, ambientC }: FloorMapProps): ReactNode {
  const cols = Math.ceil((rect.x1 - rect.x0) / CELL);
  const rows = Math.ceil((rect.z1 - rect.z0) / CELL);
  const samples = useMemo(() => samplesFor(racks, 0.95), [racks]);
  const since = useRef(REFRESH_S);
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);

  // Sample positions never move, so each cell's kernel weights are computed
  // once; a refresh is then just a short weighted sum per cell.
  const kernel = useMemo(() => {
    const inv2s2 = 1 / (2 * SIGMA * SIGMA);
    const reach = SIGMA * 3;
    const cells: { idx: Int32Array; w: Float32Array; wSum: number }[] = [];
    for (let j = 0; j < rows; j++) {
      // DataTexture row 0 is at v = 0, which the plane (rotated -90° about X) maps to the +z edge.
      const z = rect.z1 - (j + 0.5) * CELL;
      for (let i = 0; i < cols; i++) {
        const x = rect.x0 + (i + 0.5) * CELL;
        const idx: number[] = [];
        const w: number[] = [];
        samples.forEach((smp, n) => {
          const dx = smp.x - x;
          const dz = smp.z - z;
          if (Math.abs(dx) > reach || Math.abs(dz) > reach) return;
          idx.push(n);
          w.push(Math.exp(-(dx * dx + dz * dz) * inv2s2));
        });
        cells.push({ idx: Int32Array.from(idx), w: Float32Array.from(w), wSum: w.reduce((a, b) => a + b, 0) });
      }
    }
    return cells;
  }, [samples, rect, cols, rows]);

  const { texture, material } = useMemo(() => {
    const data = new Uint8Array(cols * rows * 4);
    const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return { texture: tex, material: mat };
  }, [cols, rows]);

  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );

  useFrame((_, dt) => {
    since.current += dt;
    if (since.current < REFRESH_S) return;
    since.current = 0;
    // Written through the mesh ref: the texture is owned by three.js, not React.
    const map = meshRef.current?.material.map;
    if (!map) return;
    const data = (map.image as { data: Uint8Array }).data;
    const racksState = live.metrics.racks;
    // Current temperature of every sample point.
    const temps = samples.map((smp) => {
      const st = racksState.get(smp.rackId);
      return st ? (smp.side === "inlet" ? st.inletC : st.exhaustC) : ambientC;
    });
    kernel.forEach((cell, c) => {
      let tSum = ambientC * 0.15;
      for (let n = 0; n < cell.idx.length; n++) tSum += cell.w[n] * temps[cell.idx[n]];
      const wSum = cell.wSum + 0.15;
      const [r, g, b] = heatColor(tSum / wSum, 18, 40);
      const k = c * 4;
      data[k] = r * 255;
      data[k + 1] = g * 255;
      data[k + 2] = b * 255;
      data[k + 3] = Math.min(235, 110 + cell.wSum * 140);
    });
    map.needsUpdate = true;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={unitPlane}
      material={material}
      position={[(rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2]}
      rotation-x={-Math.PI / 2}
      scale={[cols * CELL, rows * CELL, 1]}
      renderOrder={2}
    />
  );
}

const capGeometry = new THREE.BoxGeometry(1, 1, 1);

/**
 * A thin heat-coloured cap on top of every rack, coloured by inlet temperature,
 * so hot spots read clearly from the overview camera.
 */
function RackCaps({ racks, height }: { racks: readonly RackPlacement[]; height: number }): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  const since = useRef(REFRESH_S);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    since.current += dt;
    if (since.current < REFRESH_S) return;
    since.current = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    racks.forEach((r, i) => {
      q.setFromAxisAngle(up, r.rotationY);
      m.compose(new THREE.Vector3(r.position[0], r.position[1] + height + 0.02, r.position[2]), q, new THREE.Vector3(0.56, 0.03, 1.0));
      mesh.setMatrixAt(i, m);
      const st = live.metrics.racks.get(r.id);
      mesh.setColorAt(i, c.setRGB(...heatColor(st?.inletC ?? 20, 18, 32)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  });

  return <instancedMesh ref={ref} args={[capGeometry, material, racks.length]} />;
}

/** Thermal overlay on both data hall floors, plus heat caps on every rack. */
export function HeatMap(): ReactNode {
  return (
    <group>
      <RackCaps racks={HALL_A_RACKS} height={2.0} />
      <RackCaps racks={HALL_B_LAYOUT.racks} height={2.236} />
      <FloorMap rect={roomById("hallA").rect} y={HALL_A.floorY + 0.02} racks={HALL_A_RACKS} ambientC={HALL_A_SUPPLY_C + 4} />
      <FloorMap rect={roomById("hallB").rect} y={0.03} racks={HALL_B_LAYOUT.racks} ambientC={HALL_B_SUPPLY_C + 3} />
    </group>
  );
}
