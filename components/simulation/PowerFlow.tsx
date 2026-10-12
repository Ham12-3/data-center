import { Html } from "@react-three/drei";
import type { ReactNode } from "react";
import type { FacilityMetrics } from "@/lib/sim/model";
import { GENERATOR_PATHS, POWER_PATHS, type PowerNode } from "@/lib/sim/powerPaths";
import { useInteriorVisible } from "@/store/useStore";
import { FlowLine } from "./FlowLine";
import { useScenarioEffect } from "./useScenarioEffects";
import type { ScenarioEffects } from "@/lib/sim/scenarios";
import { useLiveMetrics } from "./useLiveMetrics";

const ELECTRIC = "#7df9ff";

const mw = (kw: number) => (kw >= 1000 ? `${(kw / 1000).toFixed(2)} MW` : `${Math.round(kw)} kW`);

/** Power through each stage of one feed. Both feeds carry half the load (2N). */
function nodeValue(node: PowerNode, m: FacilityMetrics, fx: Pick<ScenarioEffects, "gridUp" | "onGenerator" | "onBattery">): string {
  const half = (v: number) => v / 2;
  const utilityKw = fx.gridUp && !fx.onGenerator ? half(m.totalKw) : 0;
  switch (node.kind) {
    case "grid":
      return fx.gridUp ? mw(utilityKw) : "OUTAGE";
    // IT (via UPS) and mechanical loads both come off the same transformers and ATS.
    case "transformer":
      return mw(utilityKw);
    case "ats":
      return fx.onGenerator ? `on generator · ${mw(half(m.totalKw))}` : fx.onBattery ? "no source · UPS on battery" : `utility · ${mw(half(m.totalKw))}`;
    case "ups":
      return fx.onBattery
        ? `ON BATTERY · ${mw(half(m.itKw.total))} out`
        : `${mw(half(m.itKw.total + m.upsLossKw))} in · ${mw(half(m.itKw.total))} out`;
    case "hallA":
      return mw(half(m.itKw.hallA));
    default:
      return "";
  }
}

/**
 * Power-flow simulation. Glowing pulses run along both independent feeds,
 * from the utility substation through the transformers, ATS, switchboard and
 * UPS to the data halls, with the battery DC link and Hall B branch. Pulse
 * speed scales with the power on each feed. Generator paths are drawn dimmed:
 * they only carry power during a utility failure.
 */
export function PowerFlow(): ReactNode {
  const m = useLiveMetrics(500);
  const interior = useInteriorVisible();
  const fx = useScenarioEffect((e) => ({ gridUp: e.gridUp, onGenerator: e.onGenerator, onBattery: e.onBattery, genRunning: e.generatorRpm > 0.05 }));
  // Pulse speed proportional to power: ~6 m/s at 4 MW per feed.
  const speed = Math.max(1.5, (m.feedKw.A / 4000) * 6);
  const utilityLive = fx.gridUp && !fx.onGenerator;
  return (
    <group>
      {POWER_PATHS.map((p) => (
        <group key={p.feed}>
          {utilityLive ? (
            <FlowLine points={p.upstream} color={ELECTRIC} radius={0.08} speed={speed} spacing={4} opacity={0.3} intensity={3} />
          ) : (
            <FlowLine points={p.upstream} color="#7f1d1d" radius={0.08} speed={0} spacing={4} opacity={0.35} intensity={0} />
          )}
          <FlowLine points={p.downstream} color={ELECTRIC} radius={0.08} speed={speed} spacing={4} opacity={0.3} intensity={3} />
          {/* DC link: batteries charge slowly normally, and discharge fast (reverse flow) when the UPS has no input. */}
          {fx.onBattery ? (
            <FlowLine points={p.battery} color="#c4b5fd" radius={0.07} speed={-speed} spacing={1.5} opacity={0.4} intensity={4} />
          ) : (
            <FlowLine points={p.battery} color="#c4b5fd" radius={0.05} speed={speed * 0.3} spacing={2} opacity={0.25} intensity={1.5} />
          )}
          <FlowLine points={p.hallB} color={ELECTRIC} radius={0.08} speed={speed} spacing={4} opacity={0.3} intensity={3} />
          {p.nodes
            .filter((n) => interior || n.kind === "grid" || n.kind === "transformer")
            .map((n) => (
              <Html key={n.label} position={[...n.position]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <div className="whitespace-nowrap rounded bg-cyan-950/85 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100 ring-1 ring-cyan-300/40">
                  <span className="text-cyan-300">{n.label}</span> · {nodeValue(n, m, fx)}
                </div>
              </Html>
            ))}
        </group>
      ))}
      {interior && (
        <Html position={[22, 3.6, -5]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-cyan-950/85 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100 ring-1 ring-cyan-300/40">
            <span className="text-cyan-300">Hall B (A+B)</span> · {mw(m.itKw.hallB)}
          </div>
        </Html>
      )}
      {GENERATOR_PATHS.map((pts, i) =>
        fx.onGenerator ? (
          <FlowLine key={i} points={pts} color="#fbbf24" radius={0.09} speed={speed} spacing={4} opacity={0.35} intensity={3.5} />
        ) : (
          <FlowLine key={i} points={pts} color="#fbbf24" radius={0.06} speed={0} spacing={4} opacity={fx.genRunning ? 0.4 : 0.18} intensity={0} />
        ),
      )}
      {(fx.onGenerator || fx.genRunning) && (
        <Html position={[67, 8, -2]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-amber-950/85 px-1.5 py-0.5 text-[10px] font-medium text-amber-100 ring-1 ring-amber-300/50">
            <span className="text-amber-300">Generators</span> · {fx.onGenerator ? `carrying ${mw(m.totalKw)}` : "starting…"}
          </div>
        </Html>
      )}
    </group>
  );
}
