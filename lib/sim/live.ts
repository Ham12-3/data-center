import { facilityAt } from "./facility";
import type { FacilityMetrics } from "./model";
import { NORMAL_EFFECTS, type ScenarioEffects, type ScenarioId } from "./scenarios";

/**
 * Latest simulation state, written by SimDriver and read by 3D components
 * (per frame) and polled by the 2D UI. A plain mutable object keeps per-frame
 * updates out of React state.
 */
export const live: {
  metrics: FacilityMetrics;
  version: number;
  /** Effects of the running scenario (or normal operation). */
  effects: ScenarioEffects;
  scenario: { id: ScenarioId; time: number; step: number } | null;
} = {
  metrics: facilityAt(0.6, 18, 0),
  version: 0,
  effects: NORMAL_EFFECTS,
  scenario: null,
};
