"use client";

import { useEffect, useState } from "react";
import { BUILDING, ROOMS } from "@/data/site";
import { cameraTracker } from "@/lib/cameraTracker";
import { useStore } from "@/store/useStore";

/** Name of the room (or outdoor area) at a point. */
function placeName(x: number, z: number): string {
  const room = ROOMS.find((r) => x > r.rect.x0 && x < r.rect.x1 && z > r.rect.z0 && z < r.rect.z1);
  if (room) return room.name;
  const F = BUILDING.footprint;
  return x > F.x0 && x < F.x1 && z > F.z0 && z < F.z1 ? "Building" : "Outside · campus";
}

/**
 * Walk-mode overlay: a crosshair, the "click to look around" prompt (the
 * button id `walk-lock` is what PointerLockControls listens to) and a compact
 * key guide with the current location.
 */
export default function WalkOverlay() {
  const mode = useStore((s) => s.cameraMode);
  const locked = useStore((s) => s.walkLocked);
  const hovered = useStore((s) => s.hovered);
  const [place, setPlace] = useState("");

  useEffect(() => {
    if (mode !== "walk") return;
    const id = window.setInterval(() => setPlace(placeName(cameraTracker.x, cameraTracker.z)), 400);
    return () => window.clearInterval(id);
  }, [mode]);

  if (mode !== "walk") return null;

  return (
    <>
      {/* Crosshair: what's under it can be clicked. */}
      <div className="pointer-events-none fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
        <div className={`h-5 w-5 rounded-full border-2 ${hovered ? "border-sky-300" : "border-white/70"}`} />
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      </div>
      {locked && hovered && (
        <div className="pointer-events-none fixed left-1/2 top-[calc(50%+22px)] z-40 -translate-x-1/2 rounded bg-slate-950/85 px-2 py-0.5 text-xs text-slate-100 ring-1 ring-sky-400/40">
          {hovered.label} · click to inspect
        </div>
      )}

      {!locked && (
        <div className="pointer-events-auto fixed left-1/2 top-1/2 z-40 w-80 -translate-x-1/2 translate-y-10 rounded-lg bg-slate-900/92 p-4 text-center ring-1 ring-white/15 backdrop-blur">
          <div className="text-sm font-semibold text-slate-50">Walk mode</div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
            Walk around at eye height. You can&apos;t pass through walls or racks, so use the doorways.
          </p>
          <button
            id="walk-lock"
            type="button"
            className="mt-3 w-full rounded-md bg-sky-500/25 px-3 py-2 text-[13px] font-medium text-sky-50 ring-1 ring-sky-400/50 hover:bg-sky-500/35"
          >
            Click to look around
          </button>
          <div className="mt-3 grid grid-cols-2 gap-1 text-left text-[11px] text-slate-400">
            <span><kbd className="text-slate-200">W A S D</kbd> move</span>
            <span><kbd className="text-slate-200">Shift</kbd> run</span>
            <span><kbd className="text-slate-200">Mouse</kbd> look</span>
            <span><kbd className="text-slate-200">Click</kbd> inspect</span>
            <span className="col-span-2"><kbd className="text-slate-200">Esc</kbd> free the mouse (to use the panels)</span>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-[13.5rem] left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
        📍 {place} {locked && <span className="text-slate-400">· WASD move · Shift run · Esc free mouse</span>}
      </div>
    </>
  );
}
