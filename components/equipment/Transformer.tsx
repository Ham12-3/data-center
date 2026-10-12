import type { ReactNode } from "react";
import { Block, Box, Cyl } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { FEED_COLORS } from "@/lib/rack/palette";
import { PAL, std } from "@/lib/three/materialCache";

const porcelain = std("#7a4b2e", { roughness: 0.35 });

/** Radiator fin bank: a row of thin vertical panels. */
function Fins({ count, pitch, size, position, alongX }: { count: number; pitch: number; size: [number, number, number]; position: [number, number, number]; alongX: boolean }) {
  const mat = std("#7f8a92", { metalness: 0.4, roughness: 0.5 });
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => {
        const o = (i - (count - 1) / 2) * pitch;
        return <Box key={i} size={size} position={alongX ? [o, 0, 0] : [0, 0, o]} material={mat} />;
      })}
    </group>
  );
}

/**
 * Pad-mounted MV/LV transformer (e.g. 11 kV → 415 V, ~2.5-3 MVA) feeding one
 * electrical room. Oil-filled tank with radiator fins on two sides.
 */
export function PadTransformer({ id, position, feed }: { id: string; position: [number, number, number]; feed: "A" | "B" }): ReactNode {
  return (
    <Selectable id={id} type="transformer" label={`MV/LV transformer ${id} (feed ${feed})`} position={position}>
      <Block size={[3.2, 0.25, 3.6]} material={std(PAL.concrete)} />
      <Block size={[1.8, 2.1, 2.2]} position={[0, 0.25, 0]} material={std("#7d8a80", { roughness: 0.55, metalness: 0.2 })} />
      <Fins count={8} pitch={0.24} size={[0.45, 1.6, 0.04]} position={[-1.15, 1.2, 0]} alongX={false} />
      <Fins count={8} pitch={0.24} size={[0.45, 1.6, 0.04]} position={[1.15, 1.2, 0]} alongX={false} />
      {[-0.5, 0, 0.5].map((z) => (
        <Cyl key={z} radius={0.06} height={0.45} position={[-0.4, 2.55, z]} material={porcelain} />
      ))}
      <Box size={[0.6, 0.12, 0.02]} position={[0, 1.9, 1.11]} material={std(FEED_COLORS[feed])} cast={false} />
    </Selectable>
  );
}

/** Large substation power transformer (e.g. 132/33 kV, 60-90 MVA). */
export function PowerTransformer({ id, position }: { id: string; position: [number, number, number] }): ReactNode {
  return (
    <Selectable id={id} type="transformer" label={`Substation transformer ${id}`} position={position}>
      <Block size={[8, 0.5, 6]} material={std(PAL.concrete)} />
      <Block size={[5, 3.6, 3.2]} position={[0, 0.5, 0]} material={std("#6f7a72", { roughness: 0.5, metalness: 0.25 })} />
      <Fins count={14} pitch={0.32} size={[0.04, 3, 0.9]} position={[0, 2.1, 2.2]} alongX />
      <Fins count={14} pitch={0.32} size={[0.04, 3, 0.9]} position={[0, 2.1, -2.2]} alongX />
      {/* Conservator tank. */}
      <Cyl radius={0.5} height={3.2} position={[-0.8, 5.2, 0]} rotation={[0, 0, Math.PI / 2]} material={std("#6f7a72", { metalness: 0.25 })} />
      {/* HV bushings (tall) and LV bushings (short). */}
      {[-1.2, 0, 1.2].map((z) => (
        <Cyl key={`hv${z}`} radius={0.16} height={2.2} position={[1.4, 5.2, z]} material={porcelain} />
      ))}
      {[-0.8, 0, 0.8].map((z) => (
        <Cyl key={`lv${z}`} radius={0.12} height={1} position={[-1.8, 4.6, z]} material={porcelain} />
      ))}
    </Selectable>
  );
}
