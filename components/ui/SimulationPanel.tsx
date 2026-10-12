"use client";

import { useMemo } from "react";
import { dataRoute, roundTripMs } from "@/lib/sim/dataPaths";
import { type DataScenario, type SimLayers, useStore } from "@/store/useStore";

const SPEEDS = [0.25, 1, 2, 5];

const LAYERS: { key: keyof SimLayers; label: string; dot: string; title: string }[] = [
  { key: "data", label: "Data", dot: "bg-emerald-400", title: "Packets travelling from the internet to a server and back" },
  { key: "power", label: "Power", dot: "bg-cyan-300", title: "Electricity flowing through both 2N power paths" },
  { key: "airflow", label: "Airflow", dot: "bg-sky-400", title: "Cold air through the racks, hot air back to the coolers" },
  { key: "heatmap", label: "Heat map", dot: "bg-orange-400", title: "Thermal overlay on floors and racks" },
];

const SCENARIOS: { key: DataScenario; label: string }[] = [
  { key: "web", label: "Web page" },
  { key: "video", label: "Video stream" },
  { key: "database", label: "Database query" },
  { key: "ai", label: "AI inference" },
];

const fmtLatency = (ms: number) => (ms >= 1 ? `${ms.toFixed(ms < 10 ? 1 : 0)} ms` : `${(ms * 1000).toFixed(ms < 0.001 ? 2 : 1)} µs`);

/** The packet's journey for the selected scenario, hop by hop, with latencies. */
function HopList({ scenario }: { scenario: DataScenario }) {
  const route = useMemo(() => dataRoute(scenario), [scenario]);
  return (
    <div className="mt-2 rounded-md bg-emerald-500/5 p-2 ring-1 ring-emerald-400/20">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-emerald-300">{route.label} · request path</span>
        <span className="text-slate-300">
          Round trip ≈ <span className="font-semibold text-emerald-200">{fmtLatency(roundTripMs(route))}</span>
        </span>
      </div>
      <ol className="space-y-0.5">
        {route.hops.map((h, i) => (
          <li key={h.name} className="flex items-start gap-2 text-[11px] leading-snug" title={h.detail}>
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] text-emerald-200">{i + 1}</span>
            <span className="flex-1 text-slate-200">
              {h.name}
              <span className="text-slate-500"> · {h.detail}</span>
            </span>
            <span className="shrink-0 font-mono text-emerald-200">{fmtLatency(h.latencyMs)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[10px] text-slate-500">
        Inside the building every hop takes microseconds; distance across the internet and server processing dominate.
      </p>
    </div>
  );
}

/** Bottom panel: simulation clock, load, outdoor temperature, layers and data scenario. */
export default function SimulationPanel() {
  const sim = useStore((s) => s.sim);
  const setSim = useStore((s) => s.setSim);
  const toggle = useStore((s) => s.toggleSimLayer);
  const touring = useStore((s) => s.cameraMode === "tour");
  // The tour panel takes this spot; the tour sets the overlays itself.
  if (touring) return null;

  return (
    <section className="pointer-events-auto absolute bottom-3 left-[17.5rem] z-30 w-[32rem] max-w-[calc(100vw-36rem)] rounded-lg bg-slate-900/90 p-3 ring-1 ring-white/10 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSim({ playing: !sim.playing })}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
          aria-label={sim.playing ? "Pause simulation" : "Play simulation"}
        >
          {sim.playing ? "❚❚" : "▶"}
        </button>
        <div className="flex overflow-hidden rounded-md ring-1 ring-white/10">
          {SPEEDS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSim({ speed: v })}
              className={`px-2 py-1.5 text-[11px] font-medium ${sim.speed === v ? "bg-sky-500/25 text-sky-100" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
            >
              {v}×
            </button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-white/10" />
        {LAYERS.map((l) => (
          <button
            key={l.key}
            type="button"
            title={l.title}
            aria-pressed={sim.layers[l.key]}
            onClick={() => toggle(l.key)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ring-1 transition-colors ${
              sim.layers[l.key] ? "bg-white/15 text-white ring-white/30" : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${l.dot} ${sim.layers[l.key] ? "" : "opacity-40"}`} />
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <label className="block text-[11px] text-slate-400">
          <span className="flex justify-between">
            <span>Compute / traffic load</span>
            <span className="font-semibold text-slate-100">{Math.round(sim.load * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(sim.load * 100)}
            onChange={(e) => setSim({ load: Number(e.target.value) / 100 })}
            className="mt-1 w-full accent-sky-400"
          />
        </label>
        <label className="block text-[11px] text-slate-400">
          <span className="flex justify-between">
            <span>Outdoor temperature</span>
            <span className="font-semibold text-slate-100">{sim.outsideC} °C</span>
          </span>
          <input
            type="range"
            min={-5}
            max={40}
            value={sim.outsideC}
            onChange={(e) => setSim({ outsideC: Number(e.target.value) })}
            className="mt-1 w-full accent-orange-400"
          />
        </label>
      </div>

      {sim.layers.data && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSim({ scenario: s.key })}
                className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ${
                  sim.scenario === s.key ? "bg-emerald-500/20 text-emerald-100 ring-emerald-400/50" : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <HopList scenario={sim.scenario} />
        </>
      )}
    </section>
  );
}
