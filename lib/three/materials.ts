import * as THREE from "three";
import type { CableKind } from "@/lib/rack/cabling";
import type { BlinkMode, PartMaterialKey } from "@/lib/rack/parts";
import { CABLE_COLORS, FEED_COLORS, HARDWARE_COLORS } from "@/lib/rack/palette";
import { PERFORATION_TILE, perforatedAlphaTexture } from "./textures";

/**
 * Shared materials, created once and reused by every mesh. Instanced parts use
 * a white base colour so the per-instance colour comes through unchanged.
 */

export const partMaterials: Record<PartMaterialKey, THREE.MeshStandardMaterial> = {
  metal: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 1, roughness: 0.42 }),
  plastic: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0, roughness: 0.55 }),
  port: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0, roughness: 0.8 }),
};

export const rackMaterials = {
  frame: new THREE.MeshStandardMaterial({ color: HARDWARE_COLORS.rackFrame, metalness: 0, roughness: 0.5 }),
  sidePanel: new THREE.MeshStandardMaterial({ color: "#363a42", metalness: 0, roughness: 0.48 }),
  rail: new THREE.MeshStandardMaterial({ color: HARDWARE_COLORS.rail, metalness: 1, roughness: 0.4 }),
  handle: new THREE.MeshStandardMaterial({ color: "#c9ced6", metalness: 1, roughness: 0.25 }),
};

let perforatedDoor: THREE.MeshStandardMaterial | null = null;

/**
 * Perforated steel door. Uses alpha blending rather than alpha testing so that
 * at a distance, where mipmapping averages holes and steel, the door fades to a
 * see-through tint instead of vanishing or shimmering.
 */
export function getPerforatedDoorMaterial(doorWidth: number, doorHeight: number): THREE.MeshStandardMaterial {
  if (!perforatedDoor) {
    const alpha = perforatedAlphaTexture();
    alpha.repeat.set(doorWidth / PERFORATION_TILE, doorHeight / PERFORATION_TILE);
    perforatedDoor = new THREE.MeshStandardMaterial({
      color: "#2a2e35",
      metalness: 0,
      roughness: 0.5,
      alphaMap: alpha,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  return perforatedDoor;
}

export const pduMaterials = {
  body: new THREE.MeshStandardMaterial({ color: HARDWARE_COLORS.pduBody, metalness: 0, roughness: 0.5 }),
  outlet: new THREE.MeshStandardMaterial({ color: HARDWARE_COLORS.outletC13, metalness: 0, roughness: 0.8 }),
  display: new THREE.MeshBasicMaterial({ color: "#67e8f9", toneMapped: false }),
  feedA: new THREE.MeshStandardMaterial({ color: FEED_COLORS.A, roughness: 0.5 }),
  feedB: new THREE.MeshStandardMaterial({ color: FEED_COLORS.B, roughness: 0.5 }),
};

export const cableMaterials: Record<CableKind, THREE.MeshStandardMaterial> = {
  powerA: new THREE.MeshStandardMaterial({ color: CABLE_COLORS.powerA, roughness: 0.6 }),
  powerB: new THREE.MeshStandardMaterial({ color: CABLE_COLORS.powerB, roughness: 0.6 }),
  copper: new THREE.MeshStandardMaterial({ color: CABLE_COLORS.copper, roughness: 0.55 }),
  fiber: new THREE.MeshStandardMaterial({ color: CABLE_COLORS.fiber, roughness: 0.5 }),
};

export const roomMaterials = {
  wall: new THREE.MeshStandardMaterial({ color: "#d4d8de", roughness: 0.92 }),
  ceiling: new THREE.MeshStandardMaterial({ color: "#3a3f47", roughness: 0.95 }),
  fixture: new THREE.MeshBasicMaterial({ color: "#f2f6ff", toneMapped: false }),
};

// ---------------------------------------------------------------------------
// Status LEDs
// ---------------------------------------------------------------------------

/** Blink modes are passed to the shader as a float per instance. */
export const BLINK_MODE_INDEX: Record<BlinkMode, number> = { off: 0, solid: 1, blink: 2, activity: 3 };

/** Shared uniforms: updating `uTime` once animates every LED in the scene. */
export const ledUniforms = {
  uTime: { value: 0 },
  /** Separate clock for activity flicker; advances faster at higher load. */
  uActTime: { value: 0 },
  /** > 1 pushes LEDs above the bloom threshold once post-processing is on. */
  uLedBrightness: { value: 3.0 },
};

/**
 * Unlit LED material. Blinking is computed on the GPU from a per-instance
 * `aBlink` attribute (mode, rate, phase), so thousands of LEDs animate with no
 * per-frame CPU work beyond updating one uniform.
 *
 * Patterns (t = time * rate + phase):
 *   off      -> dim lens
 *   solid    -> always on
 *   blink    -> square wave, on for the first half of each cycle
 *   activity -> each time slot floor(t) gets a pseudo-random on/off, which reads
 *               as the irregular flicker of disk or network activity
 */
export const ledMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });

ledMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = ledUniforms.uTime;
  shader.uniforms.uActTime = ledUniforms.uActTime;
  shader.uniforms.uLedBrightness = ledUniforms.uLedBrightness;

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      /* glsl */ `#include <common>
      attribute vec3 aBlink;
      uniform float uTime;
      uniform float uActTime;
      varying float vLedIntensity;
      float ledHash(float n) { return fract(sin(n) * 43758.5453123); }`,
    )
    .replace(
      "#include <begin_vertex>",
      /* glsl */ `#include <begin_vertex>
      {
        float mode = aBlink.x;
        float t = uTime * aBlink.y + aBlink.z;
        if (mode < 0.5) {
          vLedIntensity = 0.05;
        } else if (mode < 1.5) {
          vLedIntensity = 1.0;
        } else if (mode < 2.5) {
          vLedIntensity = fract(t) < 0.5 ? 1.0 : 0.05;
        } else {
          float ta = uActTime * aBlink.y + aBlink.z;
          vLedIntensity = ledHash(floor(ta) * 12.9898 + aBlink.z * 78.233) > 0.4 ? 1.0 : 0.1;
        }
      }`,
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      /* glsl */ `#include <common>
      uniform float uLedBrightness;
      varying float vLedIntensity;`,
    )
    .replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
      diffuseColor.rgb *= vLedIntensity * uLedBrightness;`,
    );
};
ledMaterial.customProgramCacheKey = () => "status-led-v2";
