"use client";

import { useEffect, useState } from "react";
import { live } from "@/lib/sim/live";
import type { FacilityMetrics } from "@/lib/sim/model";

/** Poll the live facility metrics for 2D UI (cheaper than per-frame React updates). */
export function useLiveMetrics(intervalMs = 300): FacilityMetrics {
  const [metrics, setMetrics] = useState(live.metrics);
  useEffect(() => {
    let seen = live.version;
    const id = window.setInterval(() => {
      if (live.version !== seen) {
        seen = live.version;
        setMetrics(live.metrics);
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return metrics;
}
