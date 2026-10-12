"use client";

import { useEffect, useState } from "react";
import { BUILDING, ROOMS, type RoomId, rectCenter } from "@/data/site";
import { ZONES } from "@/data/zones";
import { cameraTracker } from "@/lib/cameraTracker";
import { useStore } from "@/store/useStore";

/** Map from room to the zone the camera flies to when it is clicked. */
const ROOM_ZONE: Partial<Record<RoomId, string>> = {
  hallA: "hallA",
  hallB: "hallB",
  mmr: "mmr",
  core: "core",
  fire: "fire",
  cooling: "cooling",
  lobby: "lobby",
  noc: "noc",
  battery: "battery",
  elecA: "elec",
  elecB: "elec",
};

const ROOM_FILL: Partial<Record<RoomId, string>> = {
  hallA: "#1e3a5f",
  hallB: "#3b2a5f",
  cooling: "#164e63",
  elecA: "#5f4b1e",
  elecB: "#5f4b1e",
  battery: "#4d3a17",
  noc: "#1f3b2d",
  lobby: "#334155",
  mmr: "#3f3a12",
  core: "#3f3a12",
  fire: "#5f1e1e",
};

const fly = (zoneId: string) => {
  const zone = ZONES.find((z) => z.id === zoneId);
  if (zone) useStore.getState().flyTo(zone.shot, zone.id);
};

/**
 * Top-down SVG plan of the building. Rooms are clickable; the dot shows the
 * camera's position. SVG x = world X, SVG y = world Z (north up).
 */
export default function Minimap() {
  const [cam, setCam] = useState<{ x: number; z: number } | null>(null);

  // Poll the camera position a few times a second; cheaper than per-frame React updates.
  useEffect(() => {
    const id = window.setInterval(() => {
      setCam({ x: cameraTracker.x, z: cameraTracker.z });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const F = BUILDING.footprint;
  const pad = 4;
  const view = `${F.x0 - pad} ${F.z0 - pad} ${F.x1 - F.x0 + 2 * pad} ${F.z1 - F.z0 + 2 * pad}`;
  const outside = cam && (cam.x < F.x0 || cam.x > F.x1 || cam.z < F.z0 || cam.z > F.z1);

  return (
    <div className="rounded-lg bg-slate-900/85 p-2 ring-1 ring-white/10 backdrop-blur">
      <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Floor plan</span>
        <button type="button" onClick={() => fly("campus")} className="text-sky-300 hover:text-sky-200">
          Site view
        </button>
      </div>
      <svg viewBox={view} className="w-full" role="img" aria-label="Building floor plan">
        <rect x={F.x0} y={F.z0} width={F.x1 - F.x0} height={F.z1 - F.z0} fill="#0f172a" stroke="#475569" strokeWidth={0.6} />
        {ROOMS.map((r) => {
          const zone = ROOM_ZONE[r.id];
          const [cx, cz] = rectCenter(r.rect);
          return (
            <g key={r.id} onClick={zone ? () => fly(zone) : undefined} className={zone ? "cursor-pointer" : undefined}>
              <rect
                x={r.rect.x0}
                y={r.rect.z0}
                width={r.rect.x1 - r.rect.x0}
                height={r.rect.z1 - r.rect.z0}
                fill={ROOM_FILL[r.id] ?? "#1e293b"}
                stroke="#64748b"
                strokeWidth={0.3}
                className={zone ? "hover:brightness-150" : undefined}
              />
              {r.id !== "corridor" && (
                <text x={cx} y={cz} fontSize={2.3} fill="#cbd5e1" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
                  {r.name.split(" ·")[0].replace("Network Operations Center", "NOC").replace("Electrical Room", "Elec")}
                </text>
              )}
            </g>
          );
        })}
        {cam && !outside && <circle cx={cam.x} cy={cam.z} r={1.4} fill="#f472b6" stroke="#fff" strokeWidth={0.4} />}
      </svg>
      {outside && <div className="px-1 text-[10px] text-slate-500">Camera is outside the building</div>}
    </div>
  );
}
