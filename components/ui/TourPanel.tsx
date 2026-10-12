"use client";

import { useEffect, useRef, useState } from "react";
import { TOUR } from "@/data/tour";
import { useStore } from "@/store/useStore";

const TICK_MS = 100;

/**
 * Guided-tour narration: where we are, what to look at and why, with
 * Previous / Play-Pause / Next. While playing, each stop advances after its
 * duration; the timer restarts on every step and pauses with the tour.
 */
export default function TourPanel() {
  const mode = useStore((s) => s.cameraMode);
  const tour = useStore((s) => s.tour);
  const go = useStore((s) => s.goToTourStep);
  const setPlaying = useStore((s) => s.setTourPlaying);
  const exit = useStore((s) => s.exitTour);
  // Timer lives in a ref (advanced by the interval); state only drives the progress bar.
  const timer = useRef({ index: tour.index, elapsed: 0 });
  const [progressState, setProgressState] = useState({ index: tour.index, value: 0 });

  const step = TOUR[tour.index];

  useEffect(() => {
    if (mode !== "tour" || !tour.playing) return;
    const id = window.setInterval(() => {
      const t = timer.current;
      const idx = useStore.getState().tour.index;
      // A new step (manual or automatic) restarts the timer.
      if (t.index !== idx) {
        t.index = idx;
        t.elapsed = 0;
      }
      t.elapsed += TICK_MS / 1000;
      if (t.elapsed >= TOUR[idx].duration) {
        t.elapsed = 0;
        if (idx < TOUR.length - 1) go(idx + 1);
        else setPlaying(false);
      }
      setProgressState({ index: t.index, value: t.elapsed / TOUR[t.index].duration });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [mode, tour.playing, go, setPlaying]);

  if (mode !== "tour") return null;
  const progress = progressState.index === tour.index ? Math.min(1, progressState.value) : 0;

  return (
    <section className="pointer-events-auto absolute bottom-3 left-[17.5rem] z-30 w-[34rem] max-w-[calc(100vw-36rem)] rounded-lg bg-slate-900/92 p-4 ring-1 ring-white/10 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          Guided tour · {step.section} · {tour.index + 1} / {TOUR.length}
        </div>
        <button type="button" onClick={exit} className="rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-100">
          Exit tour
        </button>
      </div>
      <h2 className="mt-1 text-base font-semibold text-slate-50">{step.title}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-200">{step.narration}</p>

      <div className="mt-3 flex gap-1">
        {TOUR.map((s, i) => (
          <button
            key={s.id}
            type="button"
            title={s.title}
            onClick={() => go(i)}
            className={`h-1.5 flex-1 overflow-hidden rounded-full ${i < tour.index ? "bg-sky-400/70" : "bg-white/10"}`}
          >
            {i === tour.index && <span className="block h-full bg-sky-400" style={{ width: `${(tour.playing ? progress : 1) * 100}%` }} />}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          disabled={tour.index === 0}
          onClick={() => go(tour.index - 1)}
          className="rounded-md bg-white/5 px-3 py-1.5 text-[12px] text-slate-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={() => setPlaying(!tour.playing)}
          className="rounded-md bg-sky-500/20 px-3 py-1.5 text-[12px] font-medium text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
        >
          {tour.playing ? "❚❚ Pause" : "▶ Auto-play"}
        </button>
        <button
          type="button"
          disabled={tour.index === TOUR.length - 1}
          onClick={() => go(tour.index + 1)}
          className="rounded-md bg-sky-500/20 px-3 py-1.5 text-[12px] font-medium text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </section>
  );
}
