import { describe, expect, it } from "vitest";
import { DEMO_RACK_SLOTS } from "@/data/layout";
import { RACK_UNITS } from "@/lib/units";
import { resolveRackLayout } from "./layout";

describe("rack layout", () => {
  it("fills every open front position with blanking panels", () => {
    const items = resolveRackLayout("R", DEMO_RACK_SLOTS);
    const front = new Set<number>();
    for (const it of items) {
      const blocksFront = it.face === "front" || it.kind === "server-1u" || it.kind === "server-2u";
      if (blocksFront) for (let u = it.uStart; u < it.uStart + it.heightU; u++) front.add(u);
    }
    expect(front.size).toBe(RACK_UNITS);
  });

  it("rejects overlapping devices", () => {
    expect(() =>
      resolveRackLayout("R", [
        { kind: "server-2u", u: 1 },
        { kind: "server-1u", u: 2 },
      ]),
    ).toThrow(/overlaps/);
  });

  it("allows a shallow rear switch behind a front blanking position", () => {
    const items = resolveRackLayout("R", [{ kind: "tor-switch", u: 42 }]);
    expect(items.find((i) => i.kind === "blanking-panel" && i.uStart <= 42 && i.uStart + i.heightU > 42)).toBeDefined();
  });

  it("rejects devices outside U1-U42", () => {
    expect(() => resolveRackLayout("R", [{ kind: "server-2u", u: 42 }])).toThrow(/does not fit/);
  });
});
