"use client";

import { useState } from "react";
import { EQUIPMENT } from "@/data/equipment";
import type { EquipmentCategory, EquipmentTypeId } from "@/types/equipment";
import { useStore } from "@/store/useStore";
import TrayService from "./TrayService";

const CATEGORY_STYLE: Record<EquipmentCategory, string> = {
  compute: "bg-emerald-500/15 text-emerald-300",
  network: "bg-yellow-500/15 text-yellow-300",
  power: "bg-cyan-500/15 text-cyan-300",
  cooling: "bg-sky-500/15 text-sky-300",
  infrastructure: "bg-slate-500/20 text-slate-300",
  safety: "bg-red-500/15 text-red-300",
};

/** Right-hand panel describing the selected object. */
export default function InfoPanel() {
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const service = useStore((s) => s.trayService);
  const [showTech, setShowTech] = useState(true);

  const panelClass =
    "pointer-events-auto absolute right-3 top-16 z-30 bottom-[15.5rem] flex w-[22rem] flex-col overflow-hidden rounded-lg bg-slate-900/90 ring-1 ring-white/10 backdrop-blur";

  if (!selected) {
    // Nothing selected but a tray is out for service: keep its controls on screen.
    if (!service) return null;
    return (
      <aside className={panelClass}>
        <div className="overflow-y-auto p-4">
          <TrayService selected={null} />
        </div>
      </aside>
    );
  }
  const info = EQUIPMENT[selected.type];

  const jump = (type: EquipmentTypeId) => {
    const target = EQUIPMENT[type];
    if (target) select({ id: `type:${type}`, type, label: target.name });
  };

  return (
    <aside className={panelClass}>
      <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div>
          {info && (
            <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_STYLE[info.category]}`}>
              {info.category}
            </span>
          )}
          <h2 className="text-base font-semibold leading-tight text-slate-50">{info?.name ?? selected.label}</h2>
          {info && selected.label !== info.name && <p className="mt-0.5 text-xs text-slate-400">{selected.label}</p>}
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100">
          ✕
        </button>
      </header>

      {info ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <TrayService selected={selected} />
          <p className="leading-relaxed text-slate-200">{info.shortDescription}</p>

          <section>
            <button
              type="button"
              onClick={() => setShowTech((v) => !v)}
              className="mb-1 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
            >
              Technical details <span>{showTech ? "−" : "+"}</span>
            </button>
            {showTech && <p className="leading-relaxed text-slate-300">{info.technicalDetails}</p>}
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Typical specs</h3>
            <dl className="divide-y divide-white/5 rounded-md bg-white/[0.03] ring-1 ring-white/5">
              {info.typicalSpecs.map((s) => (
                <div key={s.label} className="flex justify-between gap-3 px-3 py-1.5">
                  <dt className="text-slate-400">{s.label}</dt>
                  <dd className="text-right font-medium text-slate-100">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {info.connectsTo.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Connects to</h3>
              <div className="flex flex-wrap gap-1.5">
                {info.connectsTo.map((id) => {
                  const target = EQUIPMENT[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!target}
                      onClick={() => jump(id)}
                      className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-sky-500/20 disabled:opacity-40"
                    >
                      {target?.name ?? id}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {info.funFact && (
            <section className="rounded-md bg-amber-500/10 p-3 ring-1 ring-amber-400/20">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-300">Did you know?</h3>
              <p className="leading-relaxed text-amber-100/90">{info.funFact}</p>
            </section>
          )}
        </div>
      ) : (
        <p className="p-4 text-sm text-slate-400">No description yet for this object.</p>
      )}
    </aside>
  );
}
