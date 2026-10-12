"use client";

import type { ReactNode } from "react";
import { getSoundEngine } from "@/lib/audio/soundEngine";
import { type CameraMode, type LayerVisibility, type QualitySetting, useStore } from "@/store/useStore";
import { ScenarioMenu } from "./ScenarioPanel";

function ToggleButton({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/50"
          : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

const LAYERS: { key: keyof LayerVisibility; label: string; title: string }[] = [
  { key: "cables", label: "Cables", title: "Show cables inside racks and in overhead trays" },
  { key: "pipes", label: "Pipes", title: "Show chilled-water and coolant pipework" },
  { key: "floorTiles", label: "Floor tiles", title: "Lift the raised-floor tiles to see the plenum underneath" },
  { key: "ceiling", label: "Ceiling", title: "Show ceilings and light fixtures when inside" },
];

const MODES: { key: CameraMode; label: string; title: string }[] = [
  { key: "orbit", label: "Orbit", title: "Fly freely: drag to orbit, scroll to zoom" },
  { key: "walk", label: "Walk", title: "First-person: walk the building at eye height" },
  { key: "tour", label: "Tour", title: "Guided tour of the whole facility" },
];

/** Orbit / Walk / Tour switch. */
function ModeSwitch() {
  const mode = useStore((s) => s.cameraMode);
  const setMode = useStore((s) => s.setCameraMode);
  const setCutaway = useStore((s) => s.setCutaway);
  const select = useStore((s) => s.select);
  const startTour = useStore((s) => s.startTour);
  const exitTour = useStore((s) => s.exitTour);
  const choose = (m: CameraMode) => {
    if (m === mode) return;
    if (mode === "tour") exitTour();
    if (m === "tour") startTour();
    else if (m === "walk") {
      // Walk with the roof on, like being there.
      setCutaway(false);
      select(null);
      setMode("walk");
    } else setMode("orbit");
  };
  return (
    <div className="flex overflow-hidden rounded-md ring-1 ring-white/10">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          title={m.title}
          aria-pressed={mode === m.key}
          onClick={() => choose(m.key)}
          className={`px-2.5 py-1.5 text-xs font-medium ${mode === m.key ? "bg-sky-500/25 text-sky-100" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Sound on/off. The audio engine is created inside the click, as browsers require. */
function SoundToggle() {
  const on = useStore((s) => s.soundOn);
  const setOn = useStore((s) => s.setSoundOn);
  return (
    <ToggleButton
      active={on}
      title="Ambient sound: server hum, fans, generators and alarms"
      onClick={() => {
        if (!on) void getSoundEngine().resume();
        setOn(!on);
      }}
    >
      {on ? "🔊 Sound" : "🔇 Sound"}
    </ToggleButton>
  );
}

const QUALITY_LABEL: Record<QualitySetting, string> = { auto: "Auto", high: "High", balanced: "Balanced", low: "Low" };

/** Rendering quality; Auto adapts to the measured frame rate. */
function QualitySelect() {
  const quality = useStore((s) => s.quality);
  const level = useStore((s) => s.qualityLevel);
  const setQuality = useStore((s) => s.setQuality);
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400" title="High: ambient occlusion + full post-processing. Balanced: no AO. Low: no post-processing, smaller shadows, no grass tufts.">
      Quality
      <select
        value={quality}
        onChange={(e) => setQuality(e.target.value as QualitySetting)}
        className="rounded-md bg-white/5 px-1.5 py-1 text-xs text-slate-200 ring-1 ring-white/10 focus:outline-none"
      >
        {(Object.keys(QUALITY_LABEL) as QualitySetting[]).map((q) => (
          <option key={q} value={q} className="bg-slate-900">
            {q === "auto" ? `Auto (${QUALITY_LABEL[level]})` : QUALITY_LABEL[q]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Top toolbar: title, camera mode, scenarios, X-ray view, rack doors and layer toggles. */
export default function Toolbar() {
  const cutaway = useStore((s) => s.cutaway);
  const setCutaway = useStore((s) => s.setCutaway);
  const doorsOpen = useStore((s) => s.rackDoorsOpen);
  const toggleDoors = useStore((s) => s.toggleRackDoors);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-3 p-3">
      <div className="pointer-events-auto flex w-64 items-center gap-3 rounded-lg bg-slate-900/85 px-4 py-2 ring-1 ring-white/10 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
        <h1 className="text-sm font-semibold tracking-wide text-slate-100">Data Center Explorer</h1>
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-900/85 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur">
        <ModeSwitch />
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ScenarioMenu />
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ToggleButton active={cutaway} onClick={() => setCutaway(!cutaway)} title="Remove the roof and walls to see every room">
          X-ray
        </ToggleButton>
        <ToggleButton active={doorsOpen} onClick={toggleDoors} title="Open the doors of nearby racks">
          Rack doors
        </ToggleButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        {LAYERS.map((l) => (
          <ToggleButton key={l.key} active={layers[l.key]} onClick={() => toggleLayer(l.key)} title={l.title}>
            {l.label}
          </ToggleButton>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        <SoundToggle />
        <QualitySelect />
      </div>

      <p className="ml-auto hidden rounded-lg bg-slate-900/60 px-3 py-2 text-xs text-slate-400 ring-1 ring-white/10 xl:block">
        Drag to orbit · Scroll to zoom · Right-drag to pan · Click anything to learn about it
      </p>
    </header>
  );
}
