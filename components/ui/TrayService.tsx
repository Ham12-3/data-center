"use client";

import { HALL_B_LAYOUT } from "@/data/halls";
import { GPU_RACK, gpuRackItems } from "@/lib/rack/gpuRack";
import { TRAY, parseGpuDeviceId } from "@/lib/rack/gpuTray";
import { rackLocalToWorld } from "@/lib/rack/transform";
import { type CameraShot, type SelectionInfo, useStore } from "@/store/useStore";

/** Camera shots for servicing a tray: at the rack front, or over the service cart. */
function trayShot(rackId: string, uStart: number, onCart: boolean): CameraShot | null {
  const rack = HALL_B_LAYOUT.racks.find((r) => r.id === rackId);
  const item = gpuRackItems().find((i) => i.uStart === uStart);
  if (!rack || !item) return null;
  const at = (p: [number, number, number]) => rackLocalToWorld(rack.position, rack.rotationY, p);
  if (onCart) {
    const z = GPU_RACK.frontZ + 1.25;
    return { position: at([0.75, 1.85, z + 0.95]), target: at([0, 1.05, z]), cutaway: true };
  }
  return { position: at([0.8, item.yCenter + 0.8, GPU_RACK.frontZ + 1.9]), target: at([0, item.yCenter, GPU_RACK.frontZ + 0.25]), cutaway: true };
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2 text-[12px]">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <span>
        <span className="text-slate-100">{label}</span>
        <span className="text-slate-400"> · {detail}</span>
      </span>
    </li>
  );
}

/**
 * Service controls for a GPU compute tray: pull it out (or drag its handle),
 * watch the blind-mate couplings separate, lift it onto the service cart,
 * explode it, and put it back.
 */
export default function TrayService({ selected }: { selected: SelectionInfo | null }) {
  const service = useStore((s) => s.trayService);
  const openTray = useStore((s) => s.openTray);
  const setExtension = useStore((s) => s.setTrayExtension);
  const setRemoved = useStore((s) => s.setTrayRemoved);
  const setExploded = useStore((s) => s.setTrayExploded);
  const closeTray = useStore((s) => s.closeTray);
  const flyTo = useStore((s) => s.flyTo);

  if (!service) {
    if (selected?.type !== "gpu-compute-tray") return null;
    const parsed = parseGpuDeviceId(selected.id);
    if (!parsed) return null;
    return (
      <button
        type="button"
        onClick={() => {
          openTray(parsed.rackId, parsed.uStart);
          const shot = trayShot(parsed.rackId, parsed.uStart, false);
          if (shot) flyTo(shot);
        }}
        className="w-full rounded-md bg-emerald-500/15 px-3 py-2 text-left text-[13px] font-medium text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/25"
      >
        🔧 Pull out &amp; service this tray
        <span className="block text-[11px] font-normal text-emerald-200/70">Slide it out on its rails, decouple it, and look inside.</span>
      </button>
    );
  }

  const decoupled = service.removed || service.extension > TRAY.decoupleAt;
  const fullyOut = service.extension >= TRAY.travel - 0.005;
  const mmOut = Math.round(service.extension * 1000);

  return (
    <section className="rounded-md bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-400/25">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Tray service · {service.rackId} U{service.uStart}</h3>
        <button
          type="button"
          onClick={() => closeTray()}
          className="rounded px-1.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-100"
          title="Snap the tray back into the rack"
        >
          Done
        </button>
      </div>

      <ul className="mb-2 space-y-1">
        <Check ok={!decoupled} label="Coolant" detail={decoupled ? "quick disconnects closed (dry-break, no drips)" : "connected to the rack manifolds"} />
        <Check ok={!decoupled} label="NVLink" detail={decoupled ? "blind-mate connectors separated" : "mated to the rear NVLink spine"} />
        <Check ok={!decoupled} label="Power" detail={decoupled ? "busbar clip disconnected" : "48 V busbar connected"} />
        <Check
          ok={!service.removed && service.extension === 0}
          label="Position"
          detail={service.removed ? "on the service cart" : service.extension === 0 ? "seated in the rack" : `${mmOut} mm out on its rails`}
        />
      </ul>

      {!service.removed ? (
        <>
          <label className="block text-[11px] text-slate-400">
            <span className="flex justify-between">
              <span>Slide on rails (or drag the tray&apos;s front handle)</span>
              <span className="font-mono text-slate-200">{mmOut} mm</span>
            </span>
            <input
              type="range"
              min={0}
              max={Math.round(TRAY.travel * 1000)}
              value={mmOut}
              onChange={(e) => setExtension(Number(e.target.value) / 1000)}
              className="mt-1 w-full accent-emerald-400"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setExtension(TRAY.travel)} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-white/10 hover:bg-white/10">
              Pull fully out
            </button>
            <button type="button" onClick={() => setExtension(0)} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-white/10 hover:bg-white/10">
              Push in &amp; reconnect
            </button>
            <button
              type="button"
              disabled={!fullyOut}
              onClick={() => {
                setRemoved(true);
                const shot = trayShot(service.rackId, service.uStart, true);
                if (shot) flyTo(shot);
              }}
              className="rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-40"
              title={fullyOut ? "Lift the tray onto the service cart" : "Pull the tray fully out first"}
            >
              Remove from rails
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setExploded(!service.exploded)}
            className="rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30"
          >
            {service.exploded ? "Collapse" : "Exploded view"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRemoved(false);
              const shot = trayShot(service.rackId, service.uStart, false);
              if (shot) flyTo(shot);
            }}
            className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
          >
            Put back on rails
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        {service.exploded
          ? "Click any part (GPU, Grace CPU, cold plate, coupling, NIC) to learn about it."
          : "Because everything at the rear blind-mates, a tray can be swapped in minutes without draining the coolant loop or touching a cable."}
      </p>
    </section>
  );
}
