import { Html } from "@react-three/drei";
import { type ReactNode, useMemo } from "react";
import { Box } from "@/components/common/Primitives";
import { StaticBatch } from "@/components/common/StaticBatch";
import { type InstanceSpec, InstancedBoxes } from "@/components/site/Instanced";
import { BUILDING, type FloorFinish, PARTITIONS, ROOMS, rectCenter, rectSize } from "@/data/site";
import { unitPlane } from "@/lib/three/geometries";
import { glow, std } from "@/lib/three/materialCache";
import { useStore } from "@/store/useStore";

const FLOOR_MATERIALS: Record<FloorFinish, ReturnType<typeof std>> = {
  raised: std("#8e9296", { roughness: 0.9 }), // structural slab under the raised floor
  epoxy: std("#b4bac1", { roughness: 0.35 }),
  carpet: std("#2f3a4c", { roughness: 1 }),
  polished: std("#d6d3cc", { roughness: 0.2, metalness: 0.05 }),
  concrete: std("#a3a5a7", { roughness: 0.85 }),
};

const wallPaint = std("#e4e6e9", { roughness: 0.9 });
const ceilingMat = std("#4a5059", { roughness: 0.95 });

/** Floors per room, in their own finish. */
function RoomFloors(): ReactNode {
  return (
    <group>
      {ROOMS.map((r) => {
        const [cx, cz] = rectCenter(r.rect);
        const [w, d] = rectSize(r.rect);
        return (
          <mesh
            key={r.id}
            geometry={unitPlane}
            material={FLOOR_MATERIALS[r.floor]}
            position={[cx, 0.005, cz]}
            rotation-x={-Math.PI / 2}
            scale={[w, d, 1]}
            receiveShadow
          />
        );
      })}
    </group>
  );
}

/** Partition walls; gaps between segments are doorways. */
function Partitions(): ReactNode {
  const h = BUILDING.partitionHeight;
  return (
    <group>
      {PARTITIONS.map(([x0, z0, x1, z1], i) => {
        const horizontal = Math.abs(z1 - z0) < 1e-6;
        const len = horizontal ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
        return (
          <Box
            key={i}
            size={horizontal ? [len, h, 0.2] : [0.2, h, len]}
            position={[(x0 + x1) / 2, h / 2, (z0 + z1) / 2]}
            material={wallPaint}
          />
        );
      })}
    </group>
  );
}

/**
 * Ceilings with recessed linear LED fixtures: cool white in technical rooms,
 * warm white in the offices. Only rendered when the camera is inside, since
 * from the cutaway view above they would hide the rooms.
 */
function Ceilings(): ReactNode {
  const fixtures = useMemo(() => {
    const cool: InstanceSpec[] = [];
    const warm: InstanceSpec[] = [];
    for (const r of ROOMS) {
      const list = r.light === "cool" ? cool : warm;
      for (let x = r.rect.x0 + 1.5; x < r.rect.x1 - 0.8; x += 3) {
        for (let z = r.rect.z0 + 1.2; z < r.rect.z1 - 0.6; z += 2.4) {
          list.push({ position: [x, BUILDING.partitionHeight - 0.03, z], scale: [1.4, 0.04, 0.14] });
        }
      }
    }
    return { cool, warm };
  }, []);
  return (
    <group>
      {ROOMS.map((r) => {
        const [cx, cz] = rectCenter(r.rect);
        const [w, d] = rectSize(r.rect);
        return (
          <mesh
            key={r.id}
            geometry={unitPlane}
            material={ceilingMat}
            position={[cx, BUILDING.partitionHeight, cz]}
            rotation-x={Math.PI / 2}
            scale={[w, d, 1]}
          />
        );
      })}
      <InstancedBoxes items={fixtures.cool} material={glow("#eef4ff", 1.3)} cast={false} receive={false} />
      <InstancedBoxes items={fixtures.warm} material={glow("#ffe6c4", 1.2)} cast={false} receive={false} />
    </group>
  );
}

/** Floating room names, shown in the cutaway overview. */
function RoomLabels(): ReactNode {
  return (
    <group>
      {ROOMS.filter((r) => r.id !== "corridor").map((r) => {
        const [cx, cz] = rectCenter(r.rect);
        return (
          <Html key={r.id} position={[cx, BUILDING.partitionHeight + 1.2, cz]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-white/15">
              {r.name}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

/** Interior fit-out shared by every room. Equipment lives in components/zones. */
export function Interior({ children }: { children?: ReactNode }): ReactNode {
  const cameraInside = useStore((s) => s.cameraInside);
  const cutaway = useStore((s) => s.cutaway);
  const showCeiling = useStore((s) => s.layers.ceiling);
  const ceilingsLoaded = useStore((s) => s.ceilingsLoaded);
  return (
    <group>
      <RoomFloors />
      <Partitions />
      {/* Own batch inside a visibility group: shown / hidden as you walk in and out, never rebuilt. */}
      {ceilingsLoaded && (
        <group visible={cameraInside && showCeiling}>
          <StaticBatch>
            <Ceilings />
          </StaticBatch>
        </group>
      )}
      {cutaway && !cameraInside && <RoomLabels />}
      {children}
    </group>
  );
}
