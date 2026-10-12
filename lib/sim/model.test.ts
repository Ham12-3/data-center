import { describe, expect, it } from "vitest";
import { facilityAt } from "./facility";
import { ASHRAE_MAX_INLET_C, freeCoolingFraction, heatColor, rackPowerKw } from "./model";

describe("facility model", () => {
  it("lands in a realistic operating range at 60% load", () => {
    const m = facilityAt(0.6, 18, 0);
    expect(m.itKw.total).toBeGreaterThan(5000);
    expect(m.itKw.total).toBeLessThan(10000);
    expect(m.pue).toBeGreaterThan(1.08);
    expect(m.pue).toBeLessThan(1.5);
    expect(m.avgInletC).toBeLessThan(ASHRAE_MAX_INLET_C);
  });

  it("total power is IT plus every overhead", () => {
    const m = facilityAt(0.5, 20, 0);
    const sum = m.itKw.total + m.upsLossKw + m.distributionLossKw + m.coolingKw.total + m.otherKw;
    expect(m.totalKw).toBeCloseTo(sum, 6);
    expect(m.pue).toBeCloseTo(m.totalKw / m.itKw.total, 6);
  });

  it("more load means more power, heat and traffic", () => {
    const low = facilityAt(0.2, 18, 0);
    const high = facilityAt(0.9, 18, 0);
    expect(high.itKw.total).toBeGreaterThan(low.itKw.total);
    expect(high.coolingKw.total).toBeGreaterThan(low.coolingKw.total);
    expect(high.avgInletC).toBeGreaterThan(low.avgInletC);
    expect(high.fabricTbps).toBeGreaterThan(low.fabricTbps);
    expect(high.fanSpeed).toBeGreaterThan(low.fanSpeed);
  });

  it("hot weather costs efficiency (less free cooling)", () => {
    expect(freeCoolingFraction(5)).toBe(1);
    expect(freeCoolingFraction(30)).toBe(0);
    expect(facilityAt(0.6, 32, 0).pue).toBeGreaterThan(facilityAt(0.6, 8, 0).pue);
  });

  it("2N feeds share the load equally", () => {
    const m = facilityAt(0.6, 18, 0);
    expect(m.feedKw.A).toBeCloseTo(m.feedKw.B, 6);
  });

  it("a failed CRAH heats the racks near it far more than distant ones", () => {
    const ok = facilityAt(0.6, 18, 0);
    const failed = facilityAt(0.6, 18, 0, { crahFailure: { index: 3, severity: 1, recovery: 0 } });
    expect(failed.maxInletC).toBeGreaterThan(ok.maxInletC + 2);
    const rise = (id: string) => (failed.racks.get(id)?.inletC ?? 0) - (ok.racks.get(id)?.inletC ?? 0);
    // CRAH-A4 is on the north wall near pods 2-3; row A10 at the far east end is barely affected.
    expect(rise("A06-01")).toBeGreaterThan(rise("A10-20") + 2);
    const recovered = facilityAt(0.6, 18, 0, { crahFailure: { index: 3, severity: 1, recovery: 1 } });
    expect(recovered.maxInletC).toBeLessThan(failed.maxInletC);
  });

  it("cooling stops while mechanical plant has no power", () => {
    const down = facilityAt(0.6, 18, 0, { mechanicalDown: true });
    expect(down.coolingKw.chillers).toBe(0);
    expect(down.coolingKw.crahFans).toBe(0);
  });

  it("a GPU rack draws ~120-132 kW at full load and a faulted server draws nothing", () => {
    expect(rackPowerKw({ id: "g", hall: "B", kind: "gpu", rowPosition: 0.5 }, 1)).toBeCloseTo(132, 6);
    const healthy = rackPowerKw({ id: "c", hall: "A", kind: "compute", rowPosition: 0.5, slots: [{ kind: "server-1u", u: 1 }] }, 1);
    const faulted = rackPowerKw({ id: "c", hall: "A", kind: "compute", rowPosition: 0.5, slots: [{ kind: "server-1u", u: 1, status: "fault" }] }, 1);
    expect(healthy).toBeGreaterThan(0);
    expect(faulted).toBe(0);
  });

  it("heat colours run from blue (cool) to red (hot)", () => {
    const [rc, , bc] = heatColor(18);
    const [rh, , bh] = heatColor(32);
    expect(bc).toBeGreaterThan(rc);
    expect(rh).toBeGreaterThan(bh);
  });
});

describe("part-load efficiency", () => {
  it("PUE is worse at low load because fixed losses dominate", () => {
    expect(facilityAt(0.1, 18, 0).pue).toBeGreaterThan(facilityAt(0.8, 18, 0).pue);
  });
});
