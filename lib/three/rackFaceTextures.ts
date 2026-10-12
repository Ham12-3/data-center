import * as THREE from "three";
import { hash01 } from "@/lib/random";

/**
 * Canvas textures for the far-distance rack representation. A rack far from
 * the camera is a single instanced box whose front and rear faces carry a
 * painting of what the detailed rack looks like: rows of servers seen through
 * the perforated door, and an emissive layer of status LEDs that blooms.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  draw(ctx);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

const W = 128;
const H = 448;
/** 42U span within the 2.0 m face, in texture pixels. */
const U_TOP = Math.round(H * (1 - 1.947 / 2.0));
const U_PX = (H * (1.867 / 2.0)) / 42;

function frame(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = "#1c1f24";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fill;
  ctx.fillRect(6, 8, W - 12, H - 16);
}

/** 42U compute rack front: server bands through a dark mesh door. */
export function computeFrontMap(): THREE.CanvasTexture {
  return make("compute-front", W, H, (ctx) => {
    frame(ctx, "#2a2e34");
    for (let u = 0; u < 42; u++) {
      const y = U_TOP + u * U_PX;
      const blank = u < 3 || (u > 11 && u < 14) || hash01("cf", u) < 0.12;
      ctx.fillStyle = blank ? "#1a1c1f" : u % 2 === 0 ? "#3a3f47" : "#353a41";
      ctx.fillRect(14, y + 0.5, W - 28, U_PX - 1);
      if (!blank) {
        ctx.fillStyle = "#4b515a";
        for (let d = 0; d < 10; d++) ctx.fillRect(34 + d * 6.2, y + 1.2, 4.6, U_PX - 2.4);
      }
    }
    // Perforation shading.
    ctx.fillStyle = "rgba(10,12,14,0.35)";
    for (let y = 8; y < H - 8; y += 3) for (let x = 6 + ((y / 3) % 2) * 1.5; x < W - 6; x += 3) ctx.fillRect(x, y, 1.2, 1.2);
    ctx.fillStyle = "#9aa1aa";
    ctx.fillRect(W - 14, H / 2 - 30, 4, 60);
  });
}

/** Matching emissive layer: green LEDs (and the occasional amber) on black. */
export function computeFrontEmissive(): THREE.CanvasTexture {
  return make("compute-front-e", W, H, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (let u = 0; u < 42; u++) {
      const y = U_TOP + u * U_PX + U_PX / 2;
      if (u < 3 || (u > 11 && u < 14)) continue;
      ctx.fillStyle = hash01("led", u) < 0.06 ? "#ffb020" : "#3dff6e";
      ctx.fillRect(W - 24, y - 1, 3, 2);
      ctx.fillStyle = "#3dff6e";
      ctx.fillRect(20, y - 1, 3, 2);
      for (let d = 0; d < 10; d++) if (hash01("dled", u * 10 + d) > 0.55) ctx.fillRect(35 + d * 6.2, y - 2.5, 2, 1.5);
    }
  }, true);
}

/** Rear: PSUs, cable bundles and the blue/orange PDU stripes. */
export function computeRearMap(): THREE.CanvasTexture {
  return make("compute-rear", W, H, (ctx) => {
    frame(ctx, "#25282d");
    for (let u = 0; u < 42; u++) {
      const y = U_TOP + u * U_PX;
      ctx.fillStyle = "#30343a";
      ctx.fillRect(18, y + 0.5, W - 36, U_PX - 1);
      ctx.fillStyle = "#43484f";
      ctx.fillRect(26, y + 1, 9, U_PX - 2);
      ctx.fillRect(W - 35, y + 1, 9, U_PX - 2);
    }
    ctx.fillStyle = "#a78bfa";
    for (let i = 0; i < 6; i++) ctx.fillRect(48 + i * 2.5, 20, 1.6, H - 40);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(W - 14, 30, 3, H - 60);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(11, 30, 3, H - 60);
  });
}

export function computeRearEmissive(): THREE.CanvasTexture {
  return make("compute-rear-e", W, H, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3dff6e";
    for (let u = 0; u < 42; u++) {
      const y = U_TOP + u * U_PX + U_PX / 2;
      ctx.fillRect(37, y - 1, 2, 2);
      ctx.fillRect(W - 40, y - 1, 2, 2);
    }
    ctx.fillStyle = "#67e8f9";
    ctx.fillRect(14, 36, 4, 4);
    ctx.fillRect(W - 18, 36, 4, 4);
  });
}

/** GPU (NVL72) front: dense 1U trays with green accents, open front. */
export function gpuFrontMap(): THREE.CanvasTexture {
  return make("gpu-front", W, H, (ctx) => {
    frame(ctx, "#15171a");
    const u = (H * 0.955) / 48;
    const top = H * 0.03;
    for (let i = 0; i < 48; i++) {
      const y = top + i * u;
      const slot = 47 - i; // slot 0 = bottom
      const filled = slot >= 1 && slot <= 36;
      if (!filled) continue;
      const power = slot <= 4 || slot >= 33;
      ctx.fillStyle = power ? "#3a3f46" : "#23272d";
      ctx.fillRect(10, y + 0.4, W - 20, u - 0.8);
      if (!power) {
        ctx.fillStyle = "#76b900";
        ctx.fillRect(12, y + 1, 2, u - 2);
        ctx.fillStyle = "#b8bec6";
        for (let n = 0; n < 4; n++) ctx.fillRect(70 + n * 8, y + 2, 6, u - 4);
      } else {
        ctx.fillStyle = "#4b525b";
        for (let p = 0; p < 6; p++) ctx.fillRect(14 + p * 17, y + 1, 15, u - 2);
      }
    }
  });
}

export function gpuFrontEmissive(): THREE.CanvasTexture {
  return make("gpu-front-e", W, H, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const u = (H * 0.955) / 48;
    const top = H * 0.03;
    for (let i = 0; i < 48; i++) {
      const slot = 47 - i;
      if (slot < 1 || slot > 36) continue;
      const y = top + i * u + u / 2;
      ctx.fillStyle = slot >= 13 && slot <= 21 ? "#4aa3ff" : "#3dff6e";
      ctx.fillRect(17, y - 1, 2, 2);
      ctx.fillStyle = "#3dff6e";
      for (let n = 0; n < 4; n++) if (hash01("gled", i * 4 + n) > 0.35) ctx.fillRect(71 + n * 8, y - 3, 2, 1.5);
    }
  });
}

/** GPU rear: blue/red manifolds, copper NVLink spine and busbar. */
export function gpuRearMap(): THREE.CanvasTexture {
  return make("gpu-rear", W, H, (ctx) => {
    frame(ctx, "#1d2024");
    ctx.fillStyle = "#2f7de1";
    ctx.fillRect(10, 12, 7, H - 24);
    ctx.fillStyle = "#e0453a";
    ctx.fillRect(W - 17, 12, 7, H - 24);
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = "#2a2e34";
      ctx.fillRect(26 + c * 18, H * 0.27, 15, H * 0.56);
      ctx.fillStyle = "#b87333";
      for (let b = 0; b < 26; b++) ctx.fillRect(28 + c * 18, H * 0.28 + b * (H * 0.54) / 26, 11, 2);
    }
    ctx.fillStyle = "#c27a3a";
    ctx.fillRect(W - 32, 30, 6, H - 60);
  });
}

export function blackEmissive(): THREE.CanvasTexture {
  return make("black-e", 4, 4, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 4, 4);
  });
}
