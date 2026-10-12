import type { ReactNode } from "react";
import { Block, Box, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { FEED_COLORS } from "@/lib/rack/palette";
import { PAL, glow, std } from "@/lib/three/materialCache";

const grey = std(PAL.cabinetGrey, { roughness: 0.45, detail: { scale: 1.5, colorVar: 0.03, roughVar: 0.2 } });
const darkPanel = std("#3a4048", { roughness: 0.5, metalness: 0.3 });
const handle = std(PAL.steel, { metalness: 0.85, roughness: 0.25 });

interface Placed {
  id: string;
  position: V3;
  rotationY?: number;
  feed: "A" | "B";
}

/** Feed-coloured identification band across the top of a lineup. */
function FeedBand({ width, y, z, feed }: { width: number; y: number; z: number; feed: "A" | "B" }) {
  return <Box size={[width, 0.06, 0.01]} position={[0, y, z]} material={std(FEED_COLORS[feed])} cast={false} />;
}

/**
 * Low-voltage main switchboard: a lineup of sections holding the incoming
 * transformer breaker, generator breaker and outgoing feeder breakers, with a
 * mimic diagram of the busbar painted across the doors.
 */
export function Switchgear({ id, position, rotationY = 0, feed, sections = 8 }: Placed & { sections?: number }): ReactNode {
  const w = 0.8;
  const h = 2.2;
  const d = 1.0;
  const total = sections * w;
  return (
    <Selectable id={id} type="switchgear" label={`LV main switchboard ${id} (feed ${feed})`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[total, h, d]} position={[0, 0, 0]} material={grey} bevel={0.015} />
      {Array.from({ length: sections }, (_, i) => {
        const x = -total / 2 + w * (i + 0.5);
        const big = i === 0 || i === sections - 1;
        return (
          <group key={i}>
            <Box size={[0.01, h - 0.05, 0.01]} position={[x + w / 2, h / 2, d / 2 + 0.005]} material={std("#9aa1a9")} cast={false} />
            {big ? (
              <Box size={[0.55, 0.45, 0.04]} position={[x, 1.2, d / 2 + 0.02]} material={darkPanel} cast={false} />
            ) : (
              [0.55, 1.05, 1.55].map((y) => <Box key={y} size={[0.5, 0.3, 0.03]} position={[x, y, d / 2 + 0.015]} material={darkPanel} cast={false} />)
            )}
            <Box size={[0.03, 0.2, 0.04]} position={[x + 0.3, 1.0, d / 2 + 0.03]} material={handle} cast={false} />
            <Box size={[0.08, 0.05, 0.01]} position={[x - 0.2, 1.85, d / 2 + 0.012]} material={glow(i % 3 === 0 ? "#ff3b30" : "#3dff6e", 1.2)} cast={false} />
          </group>
        );
      })}
      {/* Mimic bus line. */}
      <Box size={[total - 0.2, 0.025, 0.005]} position={[0, 1.95, d / 2 + 0.008]} material={std("#111")} cast={false} />
      <FeedBand width={total} y={h - 0.06} z={d / 2 + 0.01} feed={feed} />
    </Selectable>
  );
}

/**
 * Automatic transfer switch: watches the utility supply and, if it fails,
 * starts the generators and transfers the load once they are stable
 * (NFPA 110 Type 10: within 10 s). The UPS carries the load during the gap.
 */
export function TransferSwitch({ id, position, rotationY = 0, feed }: Placed): ReactNode {
  return (
    <Selectable id={id} type="ats" label={`Automatic transfer switch ${id} (feed ${feed})`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[1.6, 2.2, 1.0]} material={grey} bevel={0.015} />
      <Box size={[0.5, 0.35, 0.02]} position={[-0.35, 1.45, 0.51]} material={glow("#1e293b", 1)} cast={false} />
      <Box size={[0.42, 0.06, 0.01]} position={[-0.35, 1.55, 0.525]} material={glow("#3dff6e", 1.3)} cast={false} />
      <Box size={[0.42, 0.06, 0.01]} position={[-0.35, 1.4, 0.525]} material={glow("#555b62", 1)} cast={false} />
      <Box size={[0.6, 0.6, 0.03]} position={[0.35, 0.9, 0.515]} material={darkPanel} cast={false} />
      <Box size={[0.03, 0.22, 0.04]} position={[0.72, 1.0, 0.53]} material={handle} cast={false} />
      <FeedBand width={1.6} y={2.14} z={0.51} feed={feed} />
    </Selectable>
  );
}

/**
 * Double-conversion UPS (Vertiv Liebert EXL S1 1.2 MW class:
 * 2654 W x 914 D x 2009 H mm, ~97% efficient online, ~99% in eco mode).
 * Rectifier → DC bus (batteries) → inverter, so the load never sees a gap.
 */
export function Ups({ id, position, rotationY = 0, feed }: Placed): ReactNode {
  const w = 2.65;
  const h = 2.01;
  const d = 0.91;
  return (
    <Selectable id={id} type="ups" label={`UPS module ${id} (feed ${feed})`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[w, h, d]} material={std("#26292e", { roughness: 0.42 })} bevel={0.015} />
      {[-1, -0.33, 0.33, 1].map((k) => (
        <Box key={k} size={[0.012, h - 0.06, 0.01]} position={[(k * w) / 2.03, h / 2, d / 2 + 0.006]} material={std("#4a5058")} cast={false} />
      ))}
      <Box size={[0.36, 0.24, 0.012]} position={[-w / 2 + 0.55, 1.45, d / 2 + 0.008]} material={glow("#38bdf8", 1)} cast={false} />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[0.05, 0.05, 0.01]} position={[-w / 2 + 0.85 + i * 0.09, 1.25, d / 2 + 0.008]} material={glow("#3dff6e", 1.4)} cast={false} />
      ))}
      <Box size={[w - 0.3, 0.35, 0.01]} position={[0, 0.3, d / 2 + 0.007]} material={std("#16181b")} cast={false} />
      <FeedBand width={w} y={h - 0.05} z={d / 2 + 0.008} feed={feed} />
    </Selectable>
  );
}

/**
 * Lithium-ion battery cabinet (Vertiv HPL class: 600 x 1100 x 2000 mm,
 * ~51 kWh). A string of cabinets gives a UPS ~5 minutes at full load,
 * which is plenty to bridge the ~10 s until generators take over.
 */
export function BatteryCabinet({ id, position, rotationY = 0, feed }: Placed): ReactNode {
  return (
    <Selectable id={id} type="battery-cabinet" label={`Li-ion battery cabinet ${id} (string ${feed})`} position={position} rotation={[0, rotationY, 0]}>
      <Block size={[0.6, 2.0, 1.1]} material={std("#e5e7ea", { roughness: 0.45 })} bevel={0.012} />
      <Box size={[0.52, 1.85, 0.01]} position={[0, 1.0, 0.556]} material={std("#d2d6db", { roughness: 0.5 })} cast={false} />
      <Box size={[0.16, 0.1, 0.01]} position={[0, 1.6, 0.565]} material={glow("#3dff6e", 0.9)} cast={false} />
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} size={[0.44, 0.012, 0.005]} position={[0, 0.3 + i * 0.15, 0.565]} material={std("#a6acb3")} cast={false} />
      ))}
      <Box size={[0.6, 0.05, 0.01]} position={[0, 1.95, 0.558]} material={std(FEED_COLORS[feed])} cast={false} />
    </Selectable>
  );
}
