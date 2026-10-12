import { describe, expect, it } from "vitest";
import { dataRoute, roundTripMs } from "./dataPaths";

describe("data routes", () => {
  it.each(["web", "video", "database", "ai"] as const)("%s route visits every hop in order", (scenario) => {
    const r = dataRoute(scenario);
    expect(r.hops.map((h) => h.name).slice(0, 5)).toEqual(["Internet user", "Fibre entry A", "Entrance cabinet", "Cross-connect", "Border router"]);
    const idx = r.hops.map((h) => h.point);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(idx[idx.length - 1]).toBe(r.points.length - 1);
  });

  it("round trip is dominated by the internet and server, not the in-building hops", () => {
    const r = dataRoute("web");
    const inBuilding = r.hops.slice(1, -1).reduce((s, h) => s + h.latencyMs, 0);
    expect(inBuilding).toBeLessThan(0.1);
    expect(roundTripMs(r)).toBeGreaterThan(30);
  });

  it("AI inference is the slowest request (model execution time)", () => {
    expect(roundTripMs(dataRoute("ai"))).toBeGreaterThan(roundTripMs(dataRoute("web")));
  });
});
