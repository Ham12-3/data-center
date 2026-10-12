"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

const FACTS = [
  "1U is 44.45 mm (1.75 in): the standard height of a rack slot.",
  "A GB200 NVL72 rack holds 72 GPUs and draws around 120-132 kW.",
  "Generators must carry the load within 10 seconds of a power cut (NFPA 110).",
  "The industry-average PUE is about 1.56; the best hyperscale sites run near 1.1.",
  "Water carries roughly 3,500 times more heat than the same volume of air.",
  "Clean-agent gas puts out a fire in about 10 seconds without harming servers.",
  "Light in fibre covers about 200 m per microsecond.",
];

const STAGES = {
  engine: { label: "Loading the 3D engine…", from: 0, to: 30 },
  assets: { label: "Loading environment and textures…", from: 30, to: 75 },
  shaders: { label: "Compiling shaders…", from: 75, to: 98 },
  ready: { label: "Ready", from: 100, to: 100 },
} as const;

/**
 * Full-screen loader shown until the scene has loaded its assets and
 * pre-compiled its shaders, then fades out. Asset progress comes from three's
 * loading manager (drei useProgress); the other stages are reported by the scene.
 */
export default function LoadingScreen() {
  const stage = useStore((s) => s.loadStage);
  const { progress, active } = useProgress();
  // Creeping progress within the current stage; keyed by stage so it restarts at 0 for each.
  const [creep, setCreep] = useState<{ stage: string; value: number }>({ stage, value: 0 });
  const [fact, setFact] = useState(0);
  const [gone, setGone] = useState(false);

  // Indeterminate stages creep forward so the bar never looks frozen.
  useEffect(() => {
    if (stage === "ready") return;
    const id = window.setInterval(
      () => setCreep((c) => (c.stage === stage ? { stage, value: Math.min(0.95, c.value + (1 - c.value) * 0.04) } : { stage, value: 0 })),
      200,
    );
    return () => window.clearInterval(id);
  }, [stage]);
  useEffect(() => {
    const id = window.setInterval(() => setFact((f) => (f + 1) % FACTS.length), 4500);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (stage !== "ready") return;
    const t = window.setTimeout(() => setGone(true), 700);
    return () => window.clearTimeout(t);
  }, [stage]);

  if (gone) return null;
  const s = STAGES[stage];
  const crept = creep.stage === stage ? creep.value : 0;
  const within = stage === "assets" && active ? progress / 100 : crept;
  const pct = Math.round(s.from + (s.to - s.from) * within);

  return (
    <div
      className={`pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-[#070a0f] transition-opacity duration-700 ${
        stage === "ready" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-[min(28rem,90vw)] text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-400/30">
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="h-2 w-2 animate-pulse rounded-sm bg-emerald-400" style={{ animationDelay: `${(i * 137) % 900}ms` }} />
            ))}
          </div>
        </div>
        <h1 className="text-xl font-semibold tracking-wide text-slate-50">Data Center Explorer</h1>
        <p className="mt-1 text-sm text-slate-400">{s.label}</p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-right font-mono text-[11px] text-slate-500">{pct}%</div>
        <p className="mt-6 min-h-[2.5rem] text-[13px] leading-relaxed text-slate-300">
          <span className="text-sky-300">Did you know? </span>
          {FACTS[fact]}
        </p>
      </div>
    </div>
  );
}
