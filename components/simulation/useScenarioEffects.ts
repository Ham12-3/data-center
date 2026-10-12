"use client";

import { useEffect, useRef, useState } from "react";
import { live } from "@/lib/sim/live";
import type { ScenarioEffects } from "@/lib/sim/scenarios";

/**
 * Subscribe a component to part of the scenario state. The selector runs a
 * few times per second and the component re-renders only when the selected
 * value changes (compared structurally), so discrete changes such as "the
 * generators are running" cost nothing per frame.
 */
export function useScenarioEffect<T>(select: (fx: ScenarioEffects) => T, intervalMs = 200): T {
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });
  const [value, setValue] = useState<T>(() => select(live.effects));
  useEffect(() => {
    let last = JSON.stringify(selectRef.current(live.effects));
    const id = window.setInterval(() => {
      const next = selectRef.current(live.effects);
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setValue(next);
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return value;
}
