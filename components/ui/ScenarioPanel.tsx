"use client";

import { useEffect, useRef, useState } from "react";
import { live } from "@/lib/sim/live";
import { SCENARIOS, type ScenarioEffects, type ScenarioStep, scenarioById } from "@/lib/sim/scenarios";
import { useStore } from "@/store/useStore";

const SEVERITY: Record<ScenarioStep["severity"], { dot: string; text: string }> = {
  info: { dot: "bg-sky-400", text: "text-sky-200" },
  warning: { dot: "bg-amber-400", text: "text-amber-200" },
  critical: { dot: "bg-red-500", text: "text-red-200" },
  ok: { dot: "bg-emerald-400", text: "text-emerald-200" },
};

/** Toolbar dropdown listing the failure scenarios. */
export function ScenarioMenu() {
  const [open, setOpen] = useState(false);
  const start = useStore((s) => s.startScenario);
  const active = useStore((s) => s.scenario?.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
          active ? "bg-red-500/20 text-red-100 ring-red-400/50" : "bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10"
        }`}
      >
        ⚠ Scenarios ▾
      </button>
      {open && (
        <div className="absolute left-0 top-9 w-80 rounded-lg bg-slate-900/95 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                start(s.id);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2.5 py-2 text-left hover:bg-white/5 ${active === s.id ? "bg-red-500/10" : ""}`}
            >
              <div className="text-[13px] font-medium text-slate-100">{s.name}</div>
              <div className="text-[11px] leading-snug text-slate-400">{s.summary}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" | "idle" }) {
  const cls = {
    ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    warn: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    bad: "bg-red-500/15 text-red-200 ring-red-400/30",
    idle: "bg-white/5 text-slate-300 ring-white/10",
  }[tone];
  return (
    <div className={`rounded-md px-2 py-1 text-[10px] ring-1 ${cls}`}>
      <div className="uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[12px] font-semibold">{value}</div>
    </div>
  );
}

/** Live state of the power chain during a utility outage. */
function PowerStatus({ fx }: { fx: ScenarioEffects }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5">
      <StatusChip label="Grid" value={fx.gridUp ? "Online" : "OUTAGE"} tone={fx.gridUp ? "ok" : "bad"} />
      <StatusChip label="UPS" value={fx.onBattery ? "On battery" : "Online"} tone={fx.onBattery ? "warn" : "ok"} />
      <StatusChip label="Battery" value={`${Math.round(fx.batterySoc * 100)}%`} tone={fx.batterySoc > 0.97 ? "ok" : "warn"} />
      <StatusChip
        label="Generators"
        value={fx.onGenerator ? "Carrying load" : fx.generatorRpm > 0 ? `Starting ${Math.round(fx.generatorRpm * 100)}%` : "Standby"}
        tone={fx.onGenerator ? "ok" : fx.generatorRpm > 0 ? "warn" : "idle"}
      />
    </div>
  );
}

/**
 * Narration for the running scenario: what is happening and why, step by
 * step, with a progress bar, countdown (fire) and live power status (outage).
 */
export default function ScenarioPanel() {
  const scenario = useStore((s) => s.scenario);
  const stop = useStore((s) => s.stopScenario);
  const start = useStore((s) => s.startScenario);
  const [state, setState] = useState<{ id: string | null; t: number; step: number; fx: ScenarioEffects }>(() => ({
    id: null,
    t: 0,
    step: 0,
    fx: live.effects,
  }));

  useEffect(() => {
    if (!scenario) return;
    const id = window.setInterval(() => {
      const sc = live.scenario;
      setState({ id: sc?.id ?? null, t: sc?.time ?? 0, step: sc?.step ?? 0, fx: live.effects });
    }, 150);
    return () => window.clearInterval(id);
  }, [scenario]);

  if (!scenario) return null;
  const def = scenarioById(scenario.id);
  // Until the driver reports on this scenario (e.g. right after switching), show its first step.
  const fresh = state.id === def.id;
  const stepIdx = fresh ? Math.min(state.step, def.steps.length - 1) : 0;
  const t = fresh ? state.t : 0;
  const current = def.steps[stepIdx];
  const sev = SEVERITY[current.severity];

  return (
    <section className="pointer-events-auto absolute left-[17.5rem] top-16 z-30 w-[30rem] max-w-[calc(100vw-36rem)] rounded-lg bg-slate-900/92 p-3 ring-1 ring-white/10 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-300">Scenario</div>
          <h2 className="text-sm font-semibold text-slate-50">{def.name}</h2>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => start(def.id)} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-white/10 hover:bg-white/10">
            Restart
          </button>
          <button type="button" onClick={stop} className="rounded-md bg-red-500/15 px-2 py-1 text-[11px] text-red-100 ring-1 ring-red-400/40 hover:bg-red-500/25">
            Stop
          </button>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-sky-400 transition-[width] duration-150" style={{ width: `${Math.min(100, (t / def.duration) * 100)}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
        <span>t = {t.toFixed(1)} s</span>
        <span>{def.duration} s</span>
      </div>

      <div className="mt-2 rounded-md bg-white/[0.04] p-2.5 ring-1 ring-white/5">
        <div className={`flex items-center gap-2 text-[13px] font-semibold ${sev.text}`}>
          <span className={`h-2 w-2 rounded-full ${sev.dot} ${current.severity === "critical" ? "animate-pulse" : ""}`} />
          {current.title}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-200">{current.text}</p>
        {state.fx.fire.countdown !== null && (
          <div className="mt-2 rounded bg-red-500/15 px-2 py-1 text-center text-sm font-bold text-red-100 ring-1 ring-red-400/40">
            Gas release in {Math.ceil(state.fx.fire.countdown)} s
          </div>
        )}
        {def.id === "utility-loss" && <PowerStatus fx={state.fx} />}
      </div>

      <ol className="mt-2 max-h-40 space-y-0.5 overflow-y-auto pr-1">
        {def.steps.map((s, i) => (
          <li key={s.at} className={`flex gap-2 text-[11px] ${i === stepIdx ? "text-slate-100" : i < stepIdx ? "text-slate-500" : "text-slate-600"}`}>
            <span className="w-10 shrink-0 font-mono text-slate-500">{s.at.toFixed(s.at % 1 ? 1 : 0)}s</span>
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${i <= stepIdx ? SEVERITY[s.severity].dot : "bg-white/15"}`} />
            <span className={i === stepIdx ? "font-medium" : ""}>{s.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
