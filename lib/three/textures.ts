import * as THREE from "three";
import { hash01 } from "@/lib/random";

/**
 * Procedural canvas textures. Created lazily on first use (they need a DOM
 * canvas) and cached, so every material that uses one shares the same GPU copy.
 */

const cache = new Map<string, THREE.Texture>();

function cached(key: string, create: () => THREE.Texture): THREE.Texture {
  let tex = cache.get(key);
  if (!tex) {
    tex = create();
    cache.set(key, tex);
  }
  return tex;
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement("canvas");
  el.width = el.height = size;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return [el, ctx];
}

/** Physical size of one tile of the perforated-door pattern, metres. */
export const PERFORATION_TILE = 0.028;

/**
 * Alpha map for perforated rack doors: white = steel, black = hole.
 * A 4 x 4 grid of holes with every other row offset by half a pitch, giving
 * the hexagonal pattern used on real doors (~40% open area at this scale).
 */
export function perforatedAlphaTexture(): THREE.Texture {
  return cached("perforated", () => {
    const size = 128;
    const pitch = size / 4;
    const [el, ctx] = canvas(size);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : pitch / 2;
      // Draw one extra hole per row so the offset rows wrap seamlessly.
      for (let col = -1; col < 5; col++) {
        ctx.beginPath();
        ctx.arc(col * pitch + offset + pitch / 2, row * pitch + pitch / 2, pitch * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  });
}

/** Physical size of one raised-floor tile (600 mm / 24 in is the industry standard). */
export const FLOOR_TILE = 0.6;

/** Light grey floor tile with darker seams and a little speckle. One texture = one tile. */
export function floorTileTexture(): THREE.Texture {
  return cached("floorTile", () => {
    const size = 256;
    const [el, ctx] = canvas(size);
    ctx.fillStyle = "#c3c8cf";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const shade = 180 + Math.floor(hash01("floor", i) * 30);
      ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`;
      ctx.fillRect(hash01("fx", i) * size, hash01("fy", i) * size, 2, 2);
    }
    // Bevelled edge: light on top-left, dark seam on bottom-right.
    ctx.fillStyle = "#d8dce2";
    ctx.fillRect(0, 0, size, 3);
    ctx.fillRect(0, 0, 3, size);
    ctx.fillStyle = "#8a919b";
    ctx.fillRect(0, size - 4, size, 4);
    ctx.fillRect(size - 4, 0, 4, size);
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** Physical width of one facade cladding panel. */
export const CLADDING_PANEL = 1.2;

/**
 * Insulated metal facade panels: vertical seams every panel with a subtle
 * horizontal rib, the typical look of a modern data centre shell.
 */
export function claddingTexture(): THREE.Texture {
  return cached("cladding", () => {
    const size = 128;
    const [el, ctx] = canvas(size);
    ctx.fillStyle = "#d4d8dd";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#c5c9cf";
    for (let y = 0; y < size; y += 16) ctx.fillRect(0, y, size, 2);
    ctx.fillStyle = "#9aa1aa";
    ctx.fillRect(0, 0, 3, size);
    ctx.fillStyle = "#f4f6f8";
    ctx.fillRect(3, 0, 2, size);
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** Gentle noise for large ground surfaces so grass and asphalt don't look flat. */
export function noiseTexture(base: string, spread: number, key: string): THREE.Texture {
  return cached(`noise-${key}`, () => {
    const size = 256;
    const [el, ctx] = canvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 6000; i++) {
      const v = (hash01(key, i) - 0.5) * spread;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      ctx.fillRect(hash01(key + "x", i) * size, hash01(key + "y", i) * size, 3, 3);
    }
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/**
 * Perforated raised-floor tile (~25% open area): a grid of holes that lets
 * cold air from the under-floor plenum rise in front of the racks.
 */
export function perforatedTileTexture(): THREE.Texture {
  return cached("perfTile", () => {
    const size = 256;
    const [el, ctx] = canvas(size);
    ctx.fillStyle = "#c9ced4";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#3a3f46";
    const n = 16;
    const pitch = (size - 24) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.beginPath();
        ctx.arc(12 + pitch * (i + 0.5), 12 + pitch * (j + 0.5), pitch * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#8a919b";
    ctx.fillRect(0, size - 4, size, 4);
    ctx.fillRect(size - 4, 0, 4, size);
    const tex = new THREE.CanvasTexture(el);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** Solid raised-floor tile: light laminate with a dark edge trim. */
export function solidTileTexture(): THREE.Texture {
  return cached("solidTile", () => {
    const size = 128;
    const [el, ctx] = canvas(size);
    ctx.fillStyle = "#d7dbe0";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 300; i++) {
      const v = 200 + Math.floor(hash01("st", i) * 25);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      ctx.fillRect(hash01("sx", i) * size, hash01("sy", i) * size, 2, 2);
    }
    ctx.fillStyle = "#7d848d";
    ctx.fillRect(0, size - 3, size, 3);
    ctx.fillRect(size - 3, 0, 3, size);
    const tex = new THREE.CanvasTexture(el);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}
