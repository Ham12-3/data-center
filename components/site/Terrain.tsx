import { type ReactNode, useMemo } from "react";
import * as THREE from "three";
import { Box } from "@/components/common/Primitives";
import { FENCE, GATE, PARKING, type Rect, SUBSTATION, rectCenter, rectSize } from "@/data/site";
import { hash01 } from "@/lib/random";
import { roundedBox, unitCylinder, unitPlane } from "@/lib/three/geometries";
import { PAL, std } from "@/lib/three/materialCache";
import { applySurfaceDetail } from "@/lib/three/surfaceDetail";
import { useStore } from "@/store/useStore";
import { type InstanceSpec, InstancedBoxes } from "./Instanced";

const GROUND_SIZE = 1800;

/** Paved areas: no grass tufts are scattered inside these. */
const APRON: Rect = { x0: -56, x1: 56, z0: -39, z1: 36 };
const GEN_YARD: Rect = { x0: 45, x1: 89, z0: -36, z1: 38 };
const PAVED: readonly Rect[] = [
  APRON,
  GEN_YARD,
  SUBSTATION,
  PARKING,
  { x0: GATE.x0 - 2, x1: GATE.x1 + 2, z0: 30, z1: 400 },
  { x0: 76, x1: 104, z0: 41, z1: 69 },
];
const inside = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/**
 * Macro colour variation for grass: large soft patches of greener, drier and
 * darker turf. Fine detail (relief, roughness) comes from the procedural
 * world-space surface detail, so the two scales never visibly repeat together.
 */
function grassTexture(): THREE.CanvasTexture {
  const size = 1024;
  const el = document.createElement("canvas");
  el.width = el.height = size;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.fillStyle = "#5f7f3f";
  ctx.fillRect(0, 0, size, size);
  const tones = ["#6b8a45", "#4f6f35", "#7a8c4a", "#587a3b", "#6f7d42", "#4a6631"];
  for (let i = 0; i < 900; i++) {
    const x = hash01("gx", i) * size;
    const y = hash01("gy", i) * size;
    const r = 20 + hash01("gr", i) * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = tones[Math.floor(hash01("gc", i) * tones.length)];
    g.addColorStop(0, `${c}aa`);
    g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g;
    // Draw wrapped copies so the texture tiles seamlessly.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(el);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function useGrassMaterial(): THREE.MeshStandardMaterial {
  return useMemo(() => {
    const map = grassTexture();
    map.repeat.set(GROUND_SIZE / 240, GROUND_SIZE / 240);
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0 });
    applySurfaceDetail(m, { scale: 0.12, colorVar: 0.12, roughVar: 0.08, bump: 0.12, bumpScale: 3 });
    return m;
  }, []);
}

const asphalt = std(PAL.asphalt, { roughness: 0.9, detail: { scale: 0.18, colorVar: 0.08, roughVar: 0.12, bump: 0.025, bumpScale: 20 } });
const concrete = std("#b1b0aa", { roughness: 0.86, detail: { scale: 0.2, colorVar: 0.09, roughVar: 0.12, bump: 0.02, bumpScale: 12 } });

function Flat({ r, y, material }: { r: Rect; y: number; material: THREE.Material }) {
  const [cx, cz] = rectCenter(r);
  const [w, d] = rectSize(r);
  return <mesh geometry={unitPlane} material={material} position={[cx, y, cz]} rotation-x={-Math.PI / 2} scale={[w, d, 1]} receiveShadow />;
}

const CAR_COLORS = ["#e8e8e8", "#1f2a44", "#8a1c1c", "#3b3f46", "#c9ccd1", "#1d3b2a", "#0f0f10", "#5a6b7d", "#f0f0ee"];

/** Parked cars (body + glasshouse), bay markings and kerbs. */
function useParking(): { bodies: InstanceSpec[]; cabins: InstanceSpec[]; lines: InstanceSpec[]; wheels: InstanceSpec[] } {
  return useMemo(() => {
    const bodies: InstanceSpec[] = [];
    const cabins: InstanceSpec[] = [];
    const lines: InstanceSpec[] = [];
    const wheels: InstanceSpec[] = [];
    const [cx, cz] = rectCenter(PARKING);
    const [w, d] = rectSize(PARKING);
    const bays = Math.floor((w - 4) / 2.6);
    const rows = [cz - d / 2 + 3, cz - 2.8, cz + 2.8, cz + d / 2 - 3];
    rows.forEach((rz, r) => {
      for (let i = 0; i <= bays; i++) {
        const x = cx - w / 2 + 2 + i * 2.6;
        lines.push({ position: [x - 1.3, 0.03, rz], scale: [0.12, 0.01, 5] });
        if (i === bays) continue;
        const k = r * 100 + i;
        if (hash01("car", k) < 0.3) continue;
        const color = CAR_COLORS[Math.floor(hash01("carColor", k) * CAR_COLORS.length)];
        const jitter = (hash01("cj", k) - 0.5) * 0.4;
        const front = r % 2 === 0 ? 1 : -1;
        bodies.push({ position: [x, 0.62, rz + jitter], scale: [1, 1, 1], color });
        cabins.push({ position: [x, 1.18, rz + jitter - front * 0.25], scale: [1, 1, 1], color: "#1a222d" });
        for (const sx of [-0.8, 0.8]) for (const sz of [-1.45, 1.45]) {
          wheels.push({ position: [x + sx, 0.33, rz + jitter + sz], scale: [0.33, 0.24, 0.33] });
        }
      }
    });
    return { bodies, cabins, lines, wheels };
  }, []);
}

/** Broadleaf trees: trunk plus two or three overlapping canopy blobs, jittered. */
function useTrees(): { trunks: InstanceSpec[]; crowns: InstanceSpec[] } {
  return useMemo(() => {
    const trunks: InstanceSpec[] = [];
    const crowns: InstanceSpec[] = [];
    let k = 0;
    const greens = ["#3e5f2e", "#4a6b34", "#55743a", "#365527", "#5d7a3c"];
    const plant = (x0: number, z0: number) => {
      const s = 0.8 + hash01("tree", k) * 0.7;
      const x = x0 + (hash01("tx", k) - 0.5) * 8;
      const z = z0 + (hash01("tz", k) - 0.5) * 8;
      trunks.push({ position: [x, 1.8 * s, z], scale: [0.22 * s, 3.6 * s, 0.22 * s] });
      const blobs = 2 + Math.floor(hash01("tb", k) * 2);
      for (let b = 0; b < blobs; b++) {
        const a = hash01("ta", k * 7 + b) * Math.PI * 2;
        const rr = 1.0 * s;
        crowns.push({
          position: [x + Math.cos(a) * rr, (4.6 + b * 0.9) * s, z + Math.sin(a) * rr],
          scale: [(2.4 - b * 0.3) * s, (2.0 - b * 0.2) * s, (2.4 - b * 0.3) * s],
          rotationY: a,
          color: greens[Math.floor(hash01("tc", k * 5 + b) * greens.length)],
        });
      }
      k++;
    };
    for (let x = FENCE.x0 - 12; x <= FENCE.x1 + 12; x += 11) {
      plant(x, FENCE.z0 - 13);
      plant(x + 5, FENCE.z0 - 24);
      if (x < GATE.x0 - 14 || x > GATE.x1 + 14) plant(x, FENCE.z1 + 14);
    }
    for (let z = FENCE.z0; z <= FENCE.z1; z += 11) {
      plant(FENCE.x0 - 13, z);
      plant(FENCE.x0 - 25, z + 5);
    }
    // A small grove inside the fence by the offices.
    for (let i = 0; i < 6; i++) plant(-75 + (i % 3) * 9, 50 + Math.floor(i / 3) * 9);
    return { trunks, crowns };
  }, []);
}

/** Grass tufts scattered over unpaved ground near the site, for close-up texture. */
function useTufts(): InstanceSpec[] {
  return useMemo(() => {
    const list: InstanceSpec[] = [];
    let i = 0;
    while (list.length < 14000 && i < 60000) {
      const x = (hash01("tuftx", i) - 0.5) * 360 - 5;
      const z = (hash01("tuftz", i) - 0.5) * 300;
      i++;
      if (PAVED.some((r) => inside(r, x, z, 1.5))) continue;
      const s = 0.6 + hash01("tufts", i) * 0.9;
      const shade = ["#5a7a38", "#6b8740", "#4d6c30", "#7b8f48"][i % 4];
      list.push({ position: [x, 0.12 * s, z], scale: [0.16 * s, 0.26 * s, 0.16 * s], rotationY: hash01("tuftr", i) * 6.28, color: shade });
    }
    return list;
  }, []);
}

/** Expansion joints in the concrete apron, every 6 m. */
function useJoints(): InstanceSpec[] {
  return useMemo(() => {
    const list: InstanceSpec[] = [];
    const [w, d] = rectSize(APRON);
    const [cx, cz] = rectCenter(APRON);
    for (let x = APRON.x0 + 6; x < APRON.x1; x += 6) list.push({ position: [x, 0.006, cz], scale: [0.04, 0.004, d] });
    for (let z = APRON.z0 + 6; z < APRON.z1; z += 6) list.push({ position: [cx, 0.006, z], scale: [w, 0.004, 0.04] });
    return list;
  }, []);
}

const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
/** Car body and glasshouse at true size with generous bevels (instances are not scaled). */
const CAR_BODY = roundedBox(1.82, 0.74, 4.5, 0.22);
const CAR_CABIN = roundedBox(1.6, 0.56, 2.4, 0.2);
const tuftGeometry = new THREE.ConeGeometry(1, 1, 5);

/** Ground, paving, roads, parking with cars, and landscaping. */
export function Terrain(): ReactNode {
  const grass = useGrassMaterial();
  const parking = useParking();
  const trees = useTrees();
  const tufts = useTufts();
  // Grass tufts are pure decoration: dropped at Low quality.
  const showTufts = useStore((s) => s.qualityLevel !== "low");
  const joints = useJoints();
  const gateX = (GATE.x0 + GATE.x1) / 2;
  const dashes = useMemo<InstanceSpec[]>(
    () => Array.from({ length: 60 }, (_, i) => ({ position: [gateX, 0.03, GATE.z + 6 + i * 5], scale: [0.15, 0.01, 2.4] })),
    [gateX],
  );

  return (
    <group>
      <mesh geometry={unitPlane} material={grass} position={[0, -0.02, 0]} rotation-x={-Math.PI / 2} scale={[GROUND_SIZE, GROUND_SIZE, 1]} receiveShadow />
      <Flat r={APRON} y={0} material={concrete} />
      <InstancedBoxes items={joints} material={std("#7e7e79", { roughness: 0.95 })} cast={false} />

      {/* Access road from the south edge to the gate, then a ring road around the building. */}
      <Flat r={{ x0: gateX - 4.5, x1: gateX + 4.5, z0: 30, z1: 400 }} y={0.012} material={asphalt} />
      <Flat r={{ x0: -55, x1: 55, z0: 28, z1: 36 }} y={0.014} material={asphalt} />
      <Flat r={{ x0: -55, x1: 55, z0: -38, z1: -30 }} y={0.014} material={asphalt} />
      <Flat r={{ x0: -55, x1: -47, z0: -38, z1: 36 }} y={0.014} material={asphalt} />
      <Flat r={{ x0: 47, x1: 55, z0: -38, z1: 36 }} y={0.014} material={asphalt} />
      <Flat r={PARKING} y={0.016} material={asphalt} />
      <InstancedBoxes items={dashes} material={std("#f1f1ee", { roughness: 0.6 })} cast={false} />

      <InstancedBoxes items={parking.lines} material={std("#f1f1ee", { roughness: 0.6 })} cast={false} />
      <InstancedBoxes items={parking.bodies} material={std("#ffffff", { roughness: 0.25, metalness: 0 })} geometry={CAR_BODY} />
      <InstancedBoxes items={parking.cabins} material={std("#ffffff", { roughness: 0.08 })} geometry={CAR_CABIN} />
      <InstancedBoxes items={parking.wheels} material={std("#151515", { roughness: 0.8 })} geometry={unitCylinder} />

      {/* Kerbs along the building frontage and around the parking. */}
      <Box size={[84, 0.15, 0.3]} position={[0, 0.075, 27.4]} material={concrete} cast={false} />
      <Box size={[rectSize(PARKING)[0], 0.15, 0.3]} position={[rectCenter(PARKING)[0], 0.075, PARKING.z0]} material={concrete} cast={false} />

      <InstancedBoxes items={trees.trunks} material={std("#4f3d2c", { roughness: 0.9 })} geometry={unitCylinder} />
      <InstancedBoxes
        items={trees.crowns}
        material={std("#ffffff", { roughness: 0.9, detail: { scale: 1.2, colorVar: 0.2, roughVar: 0.05, bump: 0.5, bumpScale: 5 } })}
        geometry={crownGeometry}
      />
      {showTufts && <InstancedBoxes items={tufts} material={std("#ffffff", { roughness: 0.95 })} geometry={tuftGeometry} cast={false} />}
    </group>
  );
}
