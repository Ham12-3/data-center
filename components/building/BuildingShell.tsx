import { type ReactNode, useMemo } from "react";
import * as THREE from "three";
import { Block, Box } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { BUILDING, rectSize } from "@/data/site";
import { PAL, glow, std } from "@/lib/three/materialCache";
import { applySurfaceDetail } from "@/lib/three/surfaceDetail";
import { CLADDING_PANEL, claddingTexture } from "@/lib/three/textures";
import { useStore } from "@/store/useStore";
import { Walls } from "./Walls";

const { footprint: F, wallThickness: T, height: H, roofY } = BUILDING;
const [W, D] = rectSize(F);

function useCladding(length: number): THREE.MeshStandardMaterial {
  return useMemo(() => {
    const map = claddingTexture().clone();
    map.repeat.set(length / CLADDING_PANEL, 1);
    // Painted metal panels: dielectric, satin, with slight weathering and ground-level grime.
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0 });
    applySurfaceDetail(m, { scale: 0.25, colorVar: 0.05, roughVar: 0.2, grime: 0.2, grimeHeight: 3 });
    return m;
  }, [length]);
}

const glass = std("#24384a", { transparent: true, opacity: 0.78, roughness: 0.05 });
const frame = std("#5b636d", { metalness: 1, roughness: 0.35 });

/** Solid exterior: clad walls, plinth, roof slab, entrance, windows, louvres and doors. */
function Facade(): ReactNode {
  const longWall = useCladding(W);
  const shortWall = useCladding(D);
  const plinth = std("#8a8d8f", { roughness: 0.85, detail: { scale: 0.4, colorVar: 0.1, roughVar: 0.1, bump: 0.03, bumpScale: 10, grime: 0.25, grimeHeight: 0.8 } });
  const roof = std(PAL.roof, { roughness: 0.92, detail: { scale: 0.15, colorVar: 0.1, roughVar: 0.1, bump: 0.03, bumpScale: 5 } });
  return (
    <group>
      <Box size={[W, H, T]} position={[0, H / 2, F.z0 + T / 2]} material={longWall} />
      <Box size={[W, H, T]} position={[0, H / 2, F.z1 - T / 2]} material={longWall} />
      <Box size={[T, H, D]} position={[F.x0 + T / 2, H / 2, 0]} material={shortWall} />
      <Box size={[T, H, D]} position={[F.x1 - T / 2, H / 2, 0]} material={shortWall} />
      {/* Dark plinth band and parapet coping. */}
      <Box size={[W + 0.1, 0.8, D + 0.1]} position={[0, 0.4, 0]} material={plinth} cast={false} />
      <Box size={[W + 0.2, 0.15, D + 0.2]} position={[0, H + 0.07, 0]} material={std(PAL.claddingDark, { roughness: 0.4 })} bevel={0.04} />
      {/* Vertical pilaster strips every 6 m break up the long facades. */}
      {Array.from({ length: 15 }, (_, i) => -42 + i * 6).map((x) =>
        [F.z0 - 0.06, F.z1 + 0.06].map((z) => (
          <Box key={`${x}${z}`} size={[0.35, H - 0.8, 0.12]} position={[x, H / 2 + 0.4, z]} material={std("#c7ccd2", { roughness: 0.45 })} cast={false} />
        )),
      )}
      {Array.from({ length: 9 }, (_, i) => -24 + i * 6).map((z) =>
        [F.x0 - 0.06, F.x1 + 0.06].map((x) => (
          <Box key={`${x}${z}`} size={[0.12, H - 0.8, 0.35]} position={[x, H / 2 + 0.4, z]} material={std("#c7ccd2", { roughness: 0.45 })} cast={false} />
        )),
      )}

      {/* Roof slab with membrane, set below the parapet. */}
      <Box size={[W - 2 * T, 0.4, D - 2 * T]} position={[0, roofY - 0.2, 0]} material={roof} />
      <Block size={[5, 3.6, 4]} position={[-2, roofY, 12]} material={std(PAL.cladding)} />
      <Box size={[1.2, 2.2, 0.05]} position={[-2, roofY + 1.1, 2.03 + 12]} material={std("#56606b")} cast={false} />

      {/* Main entrance: glazed lobby frontage with canopy. */}
      <Box size={[9, 4.4, 0.08]} position={[-16, 2.4, F.z1 + 0.05]} material={glass} cast={false} />
      {[-20.4, -18.2, -16, -13.8, -11.6].map((x) => (
        <Box key={x} size={[0.12, 4.4, 0.14]} position={[x, 2.4, F.z1 + 0.07]} material={frame} />
      ))}
      <Box size={[12, 0.35, 4]} position={[-16, 4.8, F.z1 + 2]} material={std(PAL.claddingDark)} />
      <Box size={[11.6, 0.04, 3.6]} position={[-16, 4.6, F.z1 + 2]} material={glow("#fff4dc", 0.9)} cast={false} />
      {/* Office/NOC ribbon windows. */}
      <Box size={[12, 1.6, 0.08]} position={[-3.5, 3, F.z1 + 0.05]} material={glass} cast={false} />
      {/* Loading dock roller shutter at the cooling plant, louvres on the electrical rooms. */}
      <Box size={[5, 4.5, 0.1]} position={[-33, 2.25, F.z1 + 0.06]} material={std("#8c949c", { metalness: 0.5 })} />
      <Box size={[7, 0.25, 3]} position={[-33, 4.8, F.z1 + 1.5]} material={std(PAL.claddingDark)} />
      {[18, 24, 32, 38].map((x) => (
        <Box key={x} size={[3, 2.2, 0.1]} position={[x, 5.5, F.z1 + 0.06]} material={std("#565e67", { metalness: 0.5 })} cast={false} />
      ))}
      {/* Branding strip. */}
      <Box size={[16, 1.1, 0.06]} position={[22, 10.2, F.z1 + 0.06]} material={std("#1d3a5f")} cast={false} />
      <Box size={[15, 0.18, 0.03]} position={[22, 10.2, F.z1 + 0.1]} material={glow("#7dd3fc", 1.2)} cast={false} />
    </group>
  );
}

/**
 * The building envelope. In normal view it is a solid clad box with a roof;
 * in cutaway (X-ray) view the roof is removed and the walls switch to
 * inward-facing planes, so the nearest walls vanish and every room is visible.
 */
export function BuildingShell(): ReactNode {
  const cutaway = useStore((s) => s.cutaway);
  return (
    <group>
      {/* Ground floor slab. */}
      <Box size={[W, 0.3, D]} position={[0, -0.14, 0]} material={std("#9ea2a6", { roughness: 0.85 })} cast={false} />
      {cutaway ? (
        <Walls width={W - 0.02} depth={D - 0.02} height={H} />
      ) : (
        <Selectable id="building" type="building" label="Data centre building">
          <Facade />
        </Selectable>
      )}
    </group>
  );
}
