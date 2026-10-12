import { describe, expect, it } from "vitest";
import { NORMAL_EFFECTS, SCENARIOS, currentStepIndex, scenarioEffects } from "./scenarios";

describe("scenarios", () => {
  it("every scenario has ordered steps starting at t=0 within its duration", () => {
    for (const s of SCENARIOS) {
      expect(s.steps[0].at).toBe(0);
      const times = s.steps.map((st) => st.at);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(times[times.length - 1]).toBeLessThan(s.duration);
    }
  });

  it("utility loss: UPS bridges the gap and generators carry the load within 10 s", () => {
    const at = (t: number) => scenarioEffects("utility-loss", t);
    expect(at(0.5).onBattery).toBe(true);
    expect(at(0.5).gridUp).toBe(false);
    expect(at(10).onGenerator).toBe(true);
    expect(at(10).onBattery).toBe(false);
    expect(at(10).generatorRpm).toBe(1);
    // Batteries drained a little, never empty.
    expect(at(10).batterySoc).toBeGreaterThan(0.9);
    expect(at(10).batterySoc).toBeLessThan(1);
    // Grid back and load retransferred.
    expect(at(70).gridUp).toBe(true);
    expect(at(70).onGenerator).toBe(false);
    expect(at(90).generatorRpm).toBe(0);
  });

  it("CRAH failure develops over time, then recovers after repair", () => {
    const sev = (t: number) => scenarioEffects("crah-failure", t).crahFailure?.severity ?? 0;
    expect(sev(1)).toBe(0);
    expect(sev(10)).toBeLessThan(sev(40));
    expect(sev(145)).toBeLessThan(sev(100));
  });

  it("fire: countdown during the pre-discharge alarm, then gas", () => {
    const f = (t: number) => scenarioEffects("fire", t).fire;
    expect(f(5).stage).toBe("alert");
    expect(f(30).stage).toBe("fire2");
    expect(f(30).countdown).toBeCloseTo(22, 6);
    expect(f(30).gas).toBe(0);
    expect(f(63).gas).toBe(1);
    expect(f(63).stage).toBe("extinguished");
  });

  it("network failures drop packets only briefly before rerouting", () => {
    for (const id of ["server-failure", "switch-failure", "fiber-cut"] as const) {
      const failoverEnd = SCENARIOS.find((s) => s.id === id)?.steps.find((s) => s.severity === "ok" && s.at > 3)?.at ?? 0;
      expect(scenarioEffects(id, failoverEnd + 0.01).rerouted).toBe(true);
      expect(scenarioEffects(id, failoverEnd + 0.01).dropping).toBe(false);
      expect(failoverEnd - 3).toBeLessThanOrEqual(3);
    }
  });

  it("steps advance with time and everything is normal before an incident", () => {
    const def = SCENARIOS.find((s) => s.id === "fire");
    if (!def) throw new Error("missing");
    expect(currentStepIndex(def, 0)).toBe(0);
    expect(currentStepIndex(def, 60)).toBe(5);
    expect(scenarioEffects("server-failure", 1)).toEqual(NORMAL_EFFECTS);
  });
});
