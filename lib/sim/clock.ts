/**
 * The simulation clock. Advanced once per frame by SimDriver; everything that
 * animates with the simulation (packets, airflow, fans, LED activity) reads
 * `delta` from here instead of the render delta, so play / pause / speed apply
 * uniformly. A plain mutable object keeps per-frame updates out of React state.
 */
export const simClock = {
  /** Simulation seconds elapsed. */
  time: 0,
  /** Simulation seconds advanced this frame (0 while paused). */
  delta: 0,
};
