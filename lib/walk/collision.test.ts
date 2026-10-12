import { describe, expect, it } from "vitest";
import { ENTRANCE, buildCollisionWorld, floorHeightAt, resolveMove } from "./collision";

const world = buildCollisionWorld();
const R = 0.3;

describe("walk collision", () => {
  it("stops the player at an exterior wall", () => {
    // Walk north into the south facade, away from the entrance.
    const p = resolveMove({ x: 20, z: 27.5 }, { x: 0, z: -3 }, R, world);
    expect(p.z).toBeGreaterThan(26 + R - 0.01);
  });

  it("lets the player walk in through the main entrance", () => {
    const x = (ENTRANCE.x0 + ENTRANCE.x1) / 2;
    const p = resolveMove({ x, z: 28 }, { x: 0, z: -5 }, R, world);
    expect(p.z).toBeLessThan(25.5);
  });

  it("slides along a wall instead of stopping dead", () => {
    const p = resolveMove({ x: 20, z: 26.5 }, { x: 1, z: -1 }, R, world);
    expect(p.x).toBeCloseTo(21, 1);
  });

  it("does not tunnel through a wall with a large step", () => {
    const p = resolveMove({ x: 20, z: 28 }, { x: 0, z: -20 }, R, world);
    expect(p.z).toBeGreaterThan(26);
  });

  it("racks block movement but aisles are open", () => {
    // Along a Hall A cold aisle (pod 1: x ≈ -34.5) is clear…
    const aisle = resolveMove({ x: -34.5, z: -18 }, { x: 0, z: 10 }, R, world);
    expect(aisle.z).toBeCloseTo(-8, 1);
    // …but walking sideways out of it runs into the rack row.
    const blocked = resolveMove({ x: -34.5, z: -11 }, { x: 3, z: 0 }, R, world);
    expect(blocked.x).toBeLessThan(-33.8);
  });

  it("Hall A has a raised floor", () => {
    expect(floorHeightAt(-24, -11)).toBeCloseTo(0.6, 6);
    expect(floorHeightAt(24, -11)).toBe(0);
  });
});
