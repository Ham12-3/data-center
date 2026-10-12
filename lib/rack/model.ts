import type { RackSlotConfig } from "@/types/equipment";
import { buildRackParts } from "./buildParts";
import { type CableRoute, buildCableRoutes } from "./cabling";
import { type GpuRackItem, buildGpuRackParts, gpuRackCoolant, gpuRackItems } from "./gpuRack";
import { type RackItem, resolveRackLayout } from "./layout";
import type { PartSink, Vec3 } from "./parts";

/**
 * Derived geometry for a rack configuration. Racks that share a slot list
 * share one model, so the hall's hundreds of racks only ever build a handful
 * of models, and swapping a rack between far and detailed views costs nothing.
 */
export interface RackModel {
  readonly items: readonly RackItem[];
  readonly parts: PartSink;
  readonly routes: readonly CableRoute[];
}

const cache = new WeakMap<readonly RackSlotConfig[], RackModel>();

export function getRackModel(slots: readonly RackSlotConfig[]): RackModel {
  let model = cache.get(slots);
  if (!model) {
    const items = resolveRackLayout("rack", slots);
    model = { items, parts: buildRackParts(items), routes: buildCableRoutes(items) };
    cache.set(slots, model);
  }
  return model;
}

export interface GpuRackModel {
  readonly items: readonly GpuRackItem[];
  readonly parts: PartSink;
  readonly coolant: { supply: Vec3[][]; ret: Vec3[][] };
}

let gpuModel: GpuRackModel | null = null;

/** All NVL72 racks are identical, so there is exactly one GPU rack model. */
export function getGpuRackModel(): GpuRackModel {
  if (!gpuModel) {
    const items = gpuRackItems();
    gpuModel = { items, parts: buildGpuRackParts(items, "nvl72"), coolant: gpuRackCoolant(items) };
  }
  return gpuModel;
}
