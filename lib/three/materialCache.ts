import * as THREE from "three";
import { type DetailOptions, applySurfaceDetail } from "./surfaceDetail";

/**
 * Cached material factories. Calling `std("#888")` twice returns the same
 * material instance, so procedurally built equipment never duplicates GPU
 * programs or uniforms for identical surfaces.
 */

export interface StdOptions {
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  doubleSide?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  depthWrite?: boolean;
  /** World-space procedural surface detail (variation, relief, grime). */
  detail?: DetailOptions;
}

const cache = new Map<string, THREE.Material>();

/** Emissive gain so glowing parts read as light sources after tone mapping. */
const GLOW_GAIN = 2.2;

export function std(color: string, opts: StdOptions = {}): THREE.MeshStandardMaterial {
  const key = `std|${color}|${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    // Physically, a surface is either metal or not: painted and plastic parts
    // are dielectrics (0), bare metal is 1. In-between values read as fake.
    metalness: (opts.metalness ?? 0) >= 0.5 ? 1 : 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    depthWrite: opts.depthWrite ?? !(opts.transparent ?? false),
  });
  if (opts.detail) applySurfaceDetail(m, opts.detail);
  cache.set(key, m);
  return m;
}

/**
 * Unlit emitter for light sources, screens and indicators. Colours are pushed
 * above 1.0 so they survive AgX tone mapping and cross the bloom threshold.
 */
export function glow(color: string, intensity = 1): THREE.MeshBasicMaterial {
  const key = `glow|${color}|${intensity}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshBasicMaterial;
  const c = new THREE.Color(color).multiplyScalar(intensity * GLOW_GAIN);
  const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  cache.set(key, m);
  return m;
}

/** Shared palette for building services, used consistently across the facility. */
export const PAL = {
  chwSupply: "#2f7de1", // chilled water supply: blue
  chwReturn: "#e0453a", // chilled water return: red
  condenser: "#2fb39a", // condenser water to cooling towers
  fireRed: "#c8262b",
  fiberYellow: "#facc15",
  wireBasket: "#9aa3ad",
  busway: "#b9c0c8",
  steel: "#8d959e",
  darkSteel: "#3b4048",
  concrete: "#a7a9ab",
  cladding: "#d9dde2",
  claddingDark: "#7d858f",
  roof: "#9ea3a8",
  asphalt: "#3c3f44",
  grass: "#5d7f45",
  glass: "#9ec9e8",
  cabinetGrey: "#d3d6da",
  cabinetDark: "#2c3036",
  safetyYellow: "#f2c230",
  genset: "#e9ebee",
} as const;
