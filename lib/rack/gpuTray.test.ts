import { describe, expect, it } from "vitest";
import { TRAY, parseGpuDeviceId, trayCoolantLoops, trayParts } from "./gpuTray";

describe("GB200 compute tray", () => {
  const parts = trayParts();
  const count = (kind: string) => parts.filter((p) => p.kind === kind).length;

  it("holds 4 Blackwell GPUs and 2 Grace CPUs, each under a cold plate", () => {
    expect(count("gpu")).toBe(4);
    expect(count("cpu")).toBe(2);
    expect(count("coldplate")).toBe(6);
    expect(count("hbm")).toBe(32); // 8 HBM3e stacks per GPU
  });

  it("has one 400G NIC per GPU plus two DPUs", () => {
    expect(count("nic")).toBe(4);
    expect(count("dpu")).toBe(2);
  });

  it("blind-mate couplings sit at the rear, behind the tray body", () => {
    for (const p of parts.filter((x) => x.kind === "qd" || x.kind === "nvlink" || x.kind === "busbar")) {
      expect(p.pos[2]).toBeLessThan(-TRAY.depth / 2);
      expect(p.explode).toBe(0);
    }
  });

  it("coolant loops start and end at the rear couplings", () => {
    const { supply, ret } = trayCoolantLoops();
    expect(supply[0][0][2]).toBeCloseTo(-TRAY.depth / 2, 6);
    const last = ret[ret.length - 1];
    expect(last[last.length - 1][2]).toBeCloseTo(-TRAY.depth / 2, 6);
  });

  it("parses tray device ids", () => {
    expect(parseGpuDeviceId("B03-05/U14")).toEqual({ rackId: "B03-05", uStart: 14 });
    expect(parseGpuDeviceId("not-a-tray")).toBeNull();
  });
});
