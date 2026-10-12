import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { simClock } from "@/lib/sim/clock";
import { facilityAt } from "@/lib/sim/facility";
import { live } from "@/lib/sim/live";
import { NORMAL_EFFECTS, currentStepIndex, scenarioById, scenarioEffects } from "@/lib/sim/scenarios";
import { ledUniforms } from "@/lib/three/materials";
import { useStore } from "@/store/useStore";

/** How often the facility model is recomputed, in real seconds. */
const METRICS_INTERVAL = 0.25;
/** Large frame gaps (tab in background) are clamped so animations don't jump; slow GPUs still keep near real time. */
const MAX_FRAME = 0.25;

/**
 * Advances the simulation clock once per frame, before anything else
 * (negative priority), and refreshes the live facility metrics. LED blink and
 * activity timers live here too, so LEDs pause with the simulation and disk /
 * network activity flickers faster as load rises.
 */
export function SimDriver(): null {
  const sinceMetrics = useRef(METRICS_INTERVAL);

  useFrame((_, frameDelta) => {
    const { sim } = useStore.getState();
    const dt = Math.min(frameDelta, MAX_FRAME);
    simClock.delta = sim.playing ? dt * sim.speed : 0;
    simClock.time += simClock.delta;

    ledUniforms.uTime.value = (ledUniforms.uTime.value + simClock.delta) % 600;
    ledUniforms.uActTime.value = (ledUniforms.uActTime.value + simClock.delta * (0.25 + 1.5 * sim.load)) % 600;

    // Scenario timeline: effects are evaluated every frame (lights flicker, countdowns).
    const { scenario, stopScenario } = useStore.getState();
    if (scenario) {
      const def = scenarioById(scenario.id);
      const t = simClock.time - scenario.startedAt;
      if (t > def.duration) {
        stopScenario();
        live.effects = NORMAL_EFFECTS;
        live.scenario = null;
      } else {
        live.effects = scenarioEffects(scenario.id, t);
        live.scenario = { id: scenario.id, time: t, step: currentStepIndex(def, t) };
      }
    } else if (live.scenario) {
      live.effects = NORMAL_EFFECTS;
      live.scenario = null;
    }

    sinceMetrics.current += dt;
    if (sinceMetrics.current >= METRICS_INTERVAL) {
      sinceMetrics.current = 0;
      const fx = live.effects;
      live.metrics = facilityAt(sim.load, sim.outsideC, simClock.time, {
        crahFailure: fx.crahFailure,
        mechanicalDown: !fx.gridUp && !fx.onGenerator,
      });
      live.version++;
    }
  }, -1);

  return null;
}
