"use client";

import { useState } from "react";
import { ZONES, type Zone } from "@/data/zones";
import { useStore } from "@/store/useStore";
import Minimap from "./Minimap";

const GROUPS: Zone["group"][] = ["Site", "Building", "Close-ups"];

/** Left-hand panel: minimap plus a list of camera destinations grouped by area. */
export default function ZoneNavigator() {
  const flyTo = useStore((s) => s.flyTo);
  const active = useStore((s) => s.activeZone);
  const [open, setOpen] = useState(true);

  return (
    <aside className="pointer-events-auto absolute left-3 top-16 bottom-3 z-30 flex w-64 flex-col gap-2">
      <Minimap />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-slate-900/85 ring-1 ring-white/10 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
        >
          Explore
          <span>{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {GROUPS.map((g) => (
              <div key={g} className="mb-2">
                <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g}</div>
                {ZONES.filter((z) => z.group === g).map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => flyTo(z.shot, z.id)}
                    className={`mb-0.5 block w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                      active === z.id ? "bg-sky-500/20 ring-1 ring-sky-400/40" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="text-[13px] font-medium text-slate-100">{z.name}</div>
                    <div className="text-[11px] leading-snug text-slate-400">{z.blurb}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
