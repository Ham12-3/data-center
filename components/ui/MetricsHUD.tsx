"use client";

import { useMemo } from "react";
import { useScenarioEffect } from "@/components/simulation/useScenarioEffects";
import { useLiveMetrics } from "@/components/simulation/useLiveMetrics";
import { ASHRAE_MAX_INLET_C } from "@/lib/sim/model";
import { SIM_RACKS } from "@/lib/sim/facility";

const mw = (kw: number) => (kw >= 1000 ? `${(kw / 1000).toFixed(2)} MW` : `${Math.round(kw)} kW`);

function Stat({ label, value, sub, tone = "text-slate-50" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-md bg-white/[0.04] px-2.5 py-1.5 ring-1 ring-white/5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

/** Faulted servers in the rack configurations are permanent alerts until repaired. */
const FAULTED_SERVERS = SIM_RACKS.reduce((n, r) => n + (r.slots ?? []).filter((s) => s.status === "fault").length, 0);
const WARNING_SERVERS = SIM_RACKS.reduce((n, r) => n + (r.slots ?? []).filter((s) => s.status === "warning").length, 0);

/**
 * Live facility metrics: total and IT power, PUE, inlet temperatures,
 * throughput and alerts, plus a breakdown of where the overhead goes.
 */
export default function MetricsHUD() {
  const m = useLiveMetrics();
  const power = useScenarioEffect((fx) => ({ grid: fx.gridUp, battery: fx.onBattery, soc: fx.batterySoc, gen: fx.onGenerator }));
  const source = power.battery
    ? { label: `UPS batteries · ${Math.round(power.soc * 100)}%`, tone: "text-amber-300" }
    : power.gen
      ? { label: "Diesel generators", tone: "text-amber-300" }
      : { label: "Utility grid (2N feeds)", tone: "text-emerald-300" };
  const hotRacks = useMemo(() => [...m.racks.values()].filter((r) => r.inletC > ASHRAE_MAX_INLET_C).length, [m]);
  const alerts = FAULTED_SERVERS + WARNING_SERVERS + hotRacks;
  const overhead = m.totalKw - m.itKw.total;
  const parts = [
    { label: "Cooling", kw: m.coolingKw.total, color: "bg-sky-400" },
    { label: "UPS + distribution losses", kw: m.upsLossKw + m.distributionLossKw, color: "bg-cyan-300" },
    { label: "Lighting, offices, other", kw: m.otherKw, color: "bg-slate-400" },
  ];

  return (
    <section className="pointer-events-auto absolute bottom-3 right-3 z-30 w-[22rem] rounded-lg bg-slate-900/90 p-3 ring-1 ring-white/10 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Facility metrics</h2>
        <span className="flex items-center gap-1 text-[10px] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> live
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Total power" value={mw(m.totalKw)} sub={`Feed A ${mw(m.feedKw.A)}`} />
        <Stat label="IT load" value={mw(m.itKw.total)} sub={`A ${mw(m.itKw.hallA)} · B ${mw(m.itKw.hallB)}`} />
        <Stat label="PUE" value={m.pue.toFixed(2)} sub="industry avg 1.56" tone={m.pue < 1.3 ? "text-emerald-300" : "text-amber-300"} />
        <Stat
          label="Avg inlet"
          value={`${m.avgInletC.toFixed(1)} °C`}
          sub={`max ${m.maxInletC.toFixed(1)} °C`}
          tone={m.maxInletC > ASHRAE_MAX_INLET_C ? "text-amber-300" : "text-slate-50"}
        />
        <Stat label="Fabric traffic" value={`${m.fabricTbps.toFixed(0)} Tb/s`} sub={`Internet ${m.internetGbps.toFixed(0)} Gb/s`} />
        <Stat label="Alerts" value={String(alerts)} sub={`${FAULTED_SERVERS} crit · ${WARNING_SERVERS + hotRacks} warn`} tone={alerts ? "text-amber-300" : "text-emerald-300"} />
      </div>
      <div className="mt-2 flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] ring-1 ring-white/5">
        <span className="text-slate-400">Power source</span>
        <span className={`font-semibold ${source.tone}`}>{source.label}</span>
      </div>
      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[10px] text-slate-400">
          <span>Overhead on top of IT: {mw(overhead)}</span>
          <span>Free cooling {Math.round(m.freeCoolingFraction * 100)}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          {parts.map((p) => (
            <div key={p.label} className={p.color} style={{ width: `${(p.kw / Math.max(overhead, 1)) * 100}%` }} title={`${p.label}: ${mw(p.kw)}`} />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-slate-400">
          {parts.map((p) => (
            <span key={p.label} className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${p.color}`} />
              {p.label} {mw(p.kw)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
