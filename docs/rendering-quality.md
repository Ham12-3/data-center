# Rendering Quality Plan: Data Center Explorer

Target stack (checked against `node_modules`): three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, @react-three/postprocessing 3.2.0, postprocessing 6.39.5, n8ao 2.0.1, three-mesh-bvh 0.8.3.

## What the current setup gets wrong

1. **Nothing is tone mapped right now.** `<EffectComposer>` in @react-three/postprocessing 3.2 sets `gl.toneMapping = NoToneMapping` while it is mounted (`dist/index.js`, `toneMappingGuard`). postprocessing's `EffectPass` does not tone map on its own. `Scene.tsx` has only Outline and Bloom, so HDR values from the Sky, the sun and the IBL are clipped straight to sRGB. That gives the harsh, flat, "CG" look. The Leva `exposure` slider does nothing for the same reason.
2. **Per-material `envMapIntensity` is ignored.** In r186, `WebGLRenderer.js` (around line 2736) writes `scene.environmentIntensity` into the uniform whenever `material.envMap === null && scene.environment !== null`.
3. **Metalness values of 0.3 to 0.55** (`lib/three/materials.ts`) are physically meaningless. They read as half plastic, half chrome.
4. **Wasted anti-aliasing.** `gl={{ antialias: true }}` does nothing once a composer renders offscreen. `multisampling={4}` conflicts with screen-space AO.

## Top 10 changes, ranked by visual impact per frame cost

| # | Change | Impact | Cost (rough, laptop iGPU at 1080p) |
|---|---|---|---|
| 1 | AgX `<ToneMapping>` in the composer, and exposure | Very high | about 0 ms (merged into an existing pass) |
| 2 | An IBL that matches the sky, plus the intensity fix | High | one-time PMREM bake |
| 3 | Physically plausible materials (metalness 0 or 1) | High | 0 |
| 4 | N8AO ambient occlusion | Very high | 1 to 3 ms (half-res) |
| 5 | Roughness and normal micro-detail | Medium to high | a few texture fetches |
| 6 | Bevels on large and instanced boxes | Medium | vertex only (about 300 tris per box) |
| 7 | Soft, tightly fitted shadows | Medium to high | about 0 (shadow map is not auto-updated) |
| 8 | Post stack: SMAA, grading, vignette | Medium | about 0.5 to 1 ms |
| 9 | Atmosphere: sky, matched fog, haze | Medium | 0 |
| 10 | Variation and grime (instance jitter, ground dirt, decals) | Medium | 0 |

These costs are estimates. Measure on the target laptop with drei `<StatsGl />` (included) or N8AO's `renderMode`.

---

## 1. Tone mapping and color management

How it works:
- R3F's Canvas sets `ACESFilmicToneMapping` by default; the `flat` prop gives `NoToneMapping`. That setting only applies when the renderer draws straight to the screen.
- With a composer, tone mapping must be an effect. `ToneMappingEffect` uses three's own `tonemapping_pars_fragment`. The renderer sets its `toneMappingExposure` uniform from `gl.toneMappingExposure`, so the existing Leva exposure control starts working once the effect is added.
- The default `mode` in postprocessing 6.39 is already AGX. `ToneMappingMode` includes `AGX` and `NEUTRAL`.

Choosing a mode:
- **AgX** (recommended): handles very bright sky, sun and emissive values gracefully, and desaturates highlights the way a camera would. It looks slightly low in contrast, so add `BrightnessContrast` of about 0.05 to 0.1.
- **ACESFilmic**: punchy and contrasty, but saturated blues and oranges shift hue and the image gets darker. Use about 0.8 to 0.9 exposure if you prefer it.
- **Neutral** (Khronos PBR Neutral): keeps base colors exact. Pick it if the UI's color coding (feed A/B colors, status colors) must match swatches exactly.

```tsx
import { EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

<Canvas
  shadows="percentage"
  dpr={[1, 1.5]}
  gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
  camera={{ fov: 45, near: 0.1, far: 2000 }}
>
  {/* ...scene... */}
  <EffectComposer multisampling={0}>
    {/* other effects (section 8) */}
    <ToneMapping mode={ToneMappingMode.AGX} />
  </EffectComposer>
</Canvas>
```

Color rules (R3F already enables `ColorManagement` and sets `outputColorSpace = SRGBColorSpace`):
- Hex and CSS colors on materials are treated as sRGB.
- Canvas textures used as `map` need `colorSpace = SRGBColorSpace`. Roughness, normal and alpha maps stay `NoColorSpace`. `textures.ts` already gets this right.
- `toneMapped: false` on LEDs and fixtures has **no effect** on a post-process `ToneMapping` effect. To keep them bright and blooming, drive the color above 1, for example `material.color.set("#67e8f9").multiplyScalar(4)`. The composer's default HalfFloat buffer keeps values above 1.

## 2. Image-based lighting that matches the sky

- **drei `preset`s come from a CDN.** `useEnvironment.js` loads them from `raw.githack.com/pmndrs/drei-assets/...`, and the drei docs say presets are "not meant to be used in production".
- **Self-hosted option A:** download a 1k `.hdr` from Poly Haven (CC0) into `public/hdri/` and pass `files="/hdri/<name>_1k.hdr"`. A clear-sky "puresky" HDRI matches the procedural Sky best.
- **Self-hosted option B:** use `@pmndrs/assets` (v1.7.0). It ships 512px EXR HDRIs (DWAB-compressed, about 130 to 420 kB) as base64 modules, imported like `@pmndrs/assets/hdri/sky.exr`.
  - Names: apartment, bridge, city, dawn, esplanade, forest, hall, lab, lobby, night, park, sky, studio, sunrise, sunset, venice, warehouse, workshop.
  - drei detects `data:application/exr` URLs automatically.

```tsx
// npm i @pmndrs/assets suspend-react
import { Environment, Lightformer, Sky } from "@react-three/drei";
import { suspend } from "suspend-react";

const skyHdri = import("@pmndrs/assets/hdri/sky.exr"); // lazy, split out of the main bundle

export function Ibl({ intensity = 1 }: { intensity?: number }) {
  return (
    <Environment files={suspend(skyHdri).default} environmentIntensity={0.6 * intensity} background={false} />
  );
}

// Option C: keep it procedural, but bake the SAME sky into the env map so reflections match the backdrop.
// (Verify visually: the Sky sun disc creates a hot spot, so keep environmentIntensity low, about 0.3 to 0.5.)
export function ProceduralIbl() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.45}>
      <Sky sunPosition={[140, 170, 110]} turbidity={4} rayleigh={1} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <Lightformer form="rect" intensity={0.8} color="#b9c7d6" position={[0, 6, -60]} scale={[120, 12, 1]} />
    </Environment>
  );
}
```

**The envMapIntensity gotcha in r186.** `material.envMapIntensity` only counts when the material has its **own** `envMap`. Otherwise `scene.environmentIntensity` (drei's `environmentIntensity`) wins. For glass or chrome that needs stronger reflections, assign the map explicitly:

```tsx
import { useEnvironment } from "@react-three/drei";
const env = useEnvironment({ files: "/hdri/sky_1k.hdr" }); // cached, same texture as <Environment files=...>
useEffect(() => { glass.envMap = env; glass.envMapIntensity = 1.6; glass.needsUpdate = true; }, [env]);
```

Once IBL is in place, drop `hemisphereLight` to about 0.25. Two ambient terms flatten form. `backgroundBlurriness` (0 to 1) only matters if the HDRI is also the background; here the Sky is the background.

## 3. Physically plausible materials

Rule: **metalness is 0 or 1.** Painted, powder-coated or plastic parts are dielectrics (0). Bare metal is 1. Realism comes from roughness and its variation, not from in-between metalness.

| Surface | Color (sRGB hex) | metalness | roughness | Notes |
|---|---|---|---|---|
| Powder-coated rack or cabinet steel | `#2b2f36` (dark) / `#d9dcdf` (light) | 0 | 0.45 to 0.6 | Optional `clearcoat` 0.2, `clearcoatRoughness` 0.4 |
| Painted generator or transformer housing | brand color | 0 | 0.35 to 0.5 | `MeshPhysicalMaterial` clearcoat 0.5, clearcoatRoughness 0.25 |
| Galvanized steel (fences, trays, pipes) | `#b9bec2` | 1 | 0.35 to 0.55 | Needs a blotchy roughness map |
| Brushed aluminum or stainless | `#c8ccd0` | 1 | 0.25 to 0.4 | `MeshPhysicalMaterial.anisotropy` 0.6 |
| Concrete (slab, walls) | `#a7a7a2` | 0 | 0.85 to 0.95 | Linear albedo about 0.5 (physicallybased.info) |
| Asphalt | fresh `#3a3a39` / aged `#5a5a58` | 0 | 0.9 to 1.0 | Fresh linear albedo about 0.04 |
| ABS plastic (bezels, outlets) | as designed | 0 | 0.4 to 0.6 | |
| Rubber or cable jacket | `#1d1d1d` | 0 | 0.7 to 0.85 | |
| Window glass | `#1e2a33` tint | 0 | 0.03 to 0.08 | See the cost note below |

```ts
export const steelPainted = new THREE.MeshStandardMaterial({ color: "#2b2f36", metalness: 0, roughness: 0.5 });
export const galvanized   = new THREE.MeshStandardMaterial({ color: "#b9bec2", metalness: 1, roughness: 0.45 });
export const housing = new THREE.MeshPhysicalMaterial({
  color: "#e9e4d8", metalness: 0, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25,
});
// Cheap glass: no transmission pass. Reflections come from IBL (give it its own envMap, see section 2).
export const glass = new THREE.MeshPhysicalMaterial({
  color: "#1e2a33", metalness: 0, roughness: 0.05, ior: 1.5, transparent: true, opacity: 0.35, depthWrite: false,
});
```

**Avoid `transmission > 0` for windows.** Any transmissive material makes three render all opaque objects again into a transmission render target every frame. For hundreds of objects, that roughly doubles draw calls. Clearcoat adds a second specular lobe: modest per-pixel cost, fine for a handful of materials. Also avoid pure `#ffffff` albedos; keep base colors at about `#f0f0f0` or below.

## 4. Ambient occlusion with N8AO

- `<N8AO>` wraps `N8AOPostPass`. It rebuilds normals from depth, so it needs **no** `enableNormalPass`.
- `SSAO` needs `enableNormalPass`, which re-renders the whole scene for normals (double draw calls) and is noisier. Prefer N8AO.

```tsx
const inside = useStore((s) => s.cameraInside);

<N8AO
  halfRes                       // 2 to 4x faster (README); depth-aware upsampling about 1 ms fixed
  aoSamples={16} denoiseSamples={4} denoiseRadius={12}   // explicit instead of `quality`, see gotcha 3
  aoRadius={inside ? 1.0 : 6}   // world units: 1 to 2 orders of magnitude below scene scale
  distanceFalloff={inside ? 0.5 : 1}
  intensity={inside ? 2.5 : 1.6}
  color="#0a0d12"               // sRGB; slightly cool, not pure black
/>
```

Gotchas:
1. **World-scale radius.** The README says the radius should be one to two orders of magnitude below scene scale: about 3 to 30 for the 300 m campus, about 0.3 to 3 inside a hall. Changing `aoRadius`, `intensity` or `distanceFalloff` only updates uniforms, so switching on `cameraInside` is free. For mixed aerial and close-up views, try `screenSpaceRadius` with `aoRadius` around 32 to 64 px and `distanceFalloff` around 0.2.
2. **MSAA.** The N8AO README says hardware anti-aliasing "does NOT work with ambient occlusion". Use `multisampling={0}` and add `<SMAA />` after it. There is also a known console-spam issue with `halfRes` plus multisampling.
3. **`quality` versus explicit sample props.** The R3F wrapper (`dist/index.js` around line 2788) re-applies `aoSamples`, `denoiseSamples` and `denoiseRadius` (defaults 16/4/12) whenever *any* prop changes. That silently undoes a `quality` preset when `aoRadius` toggles. Changing samples or quality also recompiles the shader. Set explicit samples once and leave them.
4. **Depth precision.** `near: 0.05` with `far: 2500` wastes depth bits, which causes AO haloing and shadow acne at distance. Use near 0.1 to 0.25 (or switch near by `cameraInside`).
5. N8AO sets `gammaCorrection` automatically (off unless it is the last pass), which is correct when ToneMapping follows.

## 5. Micro-surface detail (roughness and normal maps)

Flat roughness is the main "CG" giveaway on large surfaces. Generate maps once, share them across all instances, and keep them at 512 to 1024 px.

```ts
// lib/three/surfaceMaps.ts: tileable value noise -> roughness map + normal map (Sobel)
export function makeSurfaceMaps(size = 512, { scale = 8, streak = 0, base = 0.5, spread = 0.25 } = {}) {
  const h = new Float32Array(size * size);
  const rnd = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x: number, y: number, p: number) => {           // periodic for seamless tiling
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const r = (a: number, b: number) => rnd(((a % p) + p) % p, ((b % p) + p) % p);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0, amp = 0.5, f = scale;
    for (let o = 0; o < 4; o++) { n += amp * noise((x / size) * f, (y / size) * f * (streak ? 1 / (1 + streak) : 1), f); f *= 2; amp *= 0.5; }
    if (streak) n = n * 0.4 + 0.6 * rnd(0, y);                   // horizontal lines = brushed metal
    h[y * size + x] = n;
  }
  const rough = new Uint8Array(size * size * 4), nrm = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, r = Math.min(1, Math.max(0, base + (h[y * size + x] - 0.5) * 2 * spread));
    rough[i] = rough[i + 1] = rough[i + 2] = r * 255; rough[i + 3] = 255;   // three reads roughness from G
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2, dy = (at(x, y + 1) - at(x, y - 1)) * 2;
    const l = Math.hypot(dx, dy, 1);
    nrm[i] = (-dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const mk = (d: Uint8Array) => { const t = new THREE.DataTexture(d, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; t.needsUpdate = true; return t; };
  return { roughnessMap: mk(rough), normalMap: mk(nrm) };          // NoColorSpace by default: correct for data maps
}
// usage
const concrete = makeSurfaceMaps(512, { scale: 6, base: 0.9, spread: 0.08 });
slab.roughnessMap = concrete.roughnessMap; slab.normalMap = concrete.normalMap; slab.normalScale.set(0.3, 0.3);
const brushed = makeSurfaceMaps(512, { scale: 4, streak: 30, base: 0.32, spread: 0.1 });
```

**Photo textures.** ambientCG and Poly Haven are both CC0: free for commercial use, no attribution needed. Put 1K JPG or PNG sets in `public/textures/` and load them with drei `useTexture` (it suspends and caches). Set `colorSpace = SRGBColorSpace` on the color map only, and set `wrapS/wrapT` plus `repeat`. If the set grows past about 10 maps, convert to KTX2 and load with `useKTX2`, which uses much less VRAM. Keep 1K: at aerial distances 2K is invisible and costs memory.

**Stretching caveat.** Textures stretch on non-uniformly scaled instances. Bake geometry at real size, or use a world-space (triplanar) lookup via `onBeforeCompile` for walls and slabs.

## 6. Bevels: edges that catch light

Real objects never have perfectly sharp edges. A 1 to 2 cm bevel picks up a specular line from the IBL, and that alone makes boxes read as "manufactured". Do this **after** #2, because bevels show nothing without reflections.

```tsx
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// (width, height, depth, segments, radius). segments=2 -> 300 triangles vs 12 for BoxGeometry
const rackGeo = useMemo(() => new RoundedBoxGeometry(0.6, 2.0, 1.2, 2, 0.012), []);
<instancedMesh args={[rackGeo, steelPainted, count]} castShadow receiveShadow />
```

- Instancing cost: 1,000 racks at 300 triangles is 300k triangles, which is fine on laptop GPUs. Draw calls do not change.
- **Do not scale instances non-uniformly**, because the bevel radius stretches. Build one geometry per distinct size; there are usually only a few.
- Use radius 0.01 to 0.02 m for equipment and 0.05 to 0.1 m for parapets and building corners. Skip tiny parts (ports, LEDs).
- drei `<RoundedBox radius smoothness>` is built on `ExtrudeGeometry` (more triangles, different UVs). It is fine for one-off hero meshes (generator housings, tanks), but prefer `RoundedBoxGeometry` for instancing. drei also exports a `<RoundedBoxGeometry>` element.

## 7. Shadows

- **PCFSoftShadowMap is gone.** The r182 migration guide deprecated it ("Use PCFShadowMap which is now soft as well"). r186 removed it: `WebGLShadowMap` warns and falls back to PCF.
  - R3F's boolean `shadows` still maps to PCFSoft, so keep `shadows="percentage"`, as the project already does.
  - r186's PCF uses 5 Vogel-disk taps with hardware comparison, and `shadow.radius` is honoured (in texels).
- **VSM** gives blurrable shadows but light bleeding on thin geometry like rack frames. Skip it.

```tsx
<directionalLight
  position={SUN} intensity={2.3} color="#fff1dc" castShadow
  shadow-mapSize={[4096, 4096]} shadow-radius={4}       // softness for PCF in r186
  shadow-bias={-0.0002} shadow-normalBias={0.04}       // normalBias ~ 0.5 to 1 shadow texel in world units
/>
```

**Fit the frustum to what is visible.** This is the biggest shadow-quality win for free. 270 m across 4096 px is about 6.6 cm per texel, which blurs racks. Inside a hall, shrink the ortho camera to the hall (about 60 x 40 m, roughly 1.5 cm per texel):

```tsx
function ShadowFit({ light }: { light: React.RefObject<THREE.DirectionalLight | null> }) {
  const inside = useStore((s) => s.cameraInside);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const cam = light.current!.shadow.camera as THREE.OrthographicCamera;
    const [hx, hz] = inside ? [35, 25] : [135, 110];
    Object.assign(cam, { left: -hx, right: hx, top: hz, bottom: -hz });
    cam.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;   // works with the existing autoUpdate=false controller
  }, [inside, gl, light]);
  return null;
}
```

Other options:
- **Cascaded shadows: `SunLight` (new in r186 addons, works in WebGLRenderer).**
  - It uses 2 cascades fitted to the view frustum and texel-snapped. `shadow.mapSize` is per cascade (default 1024). Range is `min(shadow.camera.far, camera.far)`.
  - Usage: `import { SunLight } from "three/examples/jsm/lights/SunLight.js"; extend({ SunLight });` then `<sunLight position={SUN} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-far={400} />`. Types ship in @types/three 0.186.
  - Trade-off: cascades must re-render whenever the camera moves, which conflicts with `shadowMap.autoUpdate = false`. Use it only if the frustum-fit approach is not enough.
  - The older `three/examples/jsm/csm/CSM.js` (patches materials) still exists.
- **drei `<SoftShadows size={25} samples={10} focus={0} />` (PCSS)** gives contact-hardening shadows.
  - In 10.7.9 it patches `shadowmap_pars_fragment`, switches the renderer to `BasicShadowMap` and recompiles every material.
  - Cost is roughly 2 x `samples` taps per lit pixel. Use it only with FPS headroom, at 8 to 12 samples, and never together with SunLight.
- **`<ContactShadows frames={1} />`** renders once, so it is static and free afterwards. Good under generators and transformers on flat pads.
- **`<AccumulativeShadows>` + `<RandomizedLight>`** gives the most beautiful result, but only on a planar Y-up catcher. It accumulates over `frames` (default 40) and then costs nothing. `frames={Infinity}` with `limit` supports scenes that change occasionally. Use it for flat yard pads, not the whole terrain.

## 8. Post-processing stack and order

```tsx
import { EffectComposer, N8AO, SMAA, Outline, Bloom, ToneMapping, BrightnessContrast, HueSaturation, Vignette, Noise } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";

<EffectComposer multisampling={0} autoClear={false}>          {/* HalfFloat buffer is the default */}
  <N8AO halfRes aoSamples={16} denoiseSamples={4} denoiseRadius={12} aoRadius={aoR} intensity={aoI} distanceFalloff={aoF} />
  <SMAA />
  <Outline visibleEdgeColor={0x7dd3fc} hiddenEdgeColor={0x1e3a5f} edgeStrength={4} blur xRay />
  <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.5} />
  <ToneMapping mode={ToneMappingMode.AGX} />
  <BrightnessContrast contrast={0.06} />
  <HueSaturation saturation={0.05} />
  <Vignette offset={0.3} darkness={0.45} />
  <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.03} />   {/* optional film grain */}
</EffectComposer>
```

Why this order:
- **N8AO** is a `Pass` and must run first, on scene color and depth, before bloom adds light.
- **SMAA** comes right after N8AO, as the N8AO README recommends. It is a *convolution* effect: in a merged `EffectPass` it reads the pass input buffer directly. That is why it goes **first** among the merged effects; placed after ToneMapping in the same pass, it would discard the tone-mapped result. `mergeMode="auto"` allows at most one convolution effect per pass.
- **Bloom** works on HDR. `luminanceThreshold={1}` means only emissive values above 1 (LEDs, fixtures) bloom.
- **ToneMapping** goes before the LDR grading effects (contrast, saturation, vignette, grain).
- After N8AO, `mergeMode="auto"` folds everything into about 1 to 2 fullscreen passes, so the grading effects are nearly free.

**SMAA versus MSAA.** MSAA 4x on a HalfFloat target at dpr 1.5 to 1.75 is costly in bandwidth and breaks AO, so set `multisampling={0}` and use SMAA (about 0.3 to 0.6 ms). Also set `antialias: false` on the Canvas, since its default framebuffer is not used for the scene.

## 9. Atmosphere

```tsx
<Sky sunPosition={[140, 170, 110]} turbidity={4} rayleigh={1} mieCoefficient={0.004} mieDirectionalG={0.8} />
<fogExp2 attach="fog" args={["#c9d5e1", 0.0009]} />   {/* about 7% haze at 300 m, about 55% at 1 km */}
```

- **Sun elevation.** Keep the sun 30 to 45 degrees high for readable form. Noon lighting is flat. Current `SUN` is about 42 degrees, which is good.
- **Sky parameters.**
  - Clear day: turbidity 2 to 5, rayleigh 0.5 to 1.5, mieCoefficient about 0.003 to 0.005, mieDirectionalG 0.7 to 0.8.
  - Hazy day: turbidity 8 to 10, rayleigh 2 to 3. These are three's `webgl_shaders_sky` defaults, which use exposure about 0.5.
  - The Sky outputs HDR. It only looks right with tone mapping (#1).
- **Fog.**
  - Sky's material ignores fog, so **the fog color must match the sky's horizon color**. Otherwise distant terrain ends in a visible band. Pick it from a screenshot at the horizon.
  - `FogExp2` reads as real aerial haze. Linear fog starting at 320 m looks like a wall.
  - Keep camera `far` only a little beyond full fog density.

## 10. Variation, grime and other industrial quick wins

- **Instance color jitter.** Hundreds of identical racks, panels and pavers look procedural. Add ±3 to 5% HSL variation where `setColorAt` is already called: `c.set(base).offsetHSL(0, 0, (rand(i) - 0.5) * 0.06)`. Combine with per-instance roughness variation (roughness map plus jitter).
- **Ground grime.** A world-space darkening near the floor on walls, cabinets and fences sells "used" instantly, for free:

```ts
export function addGroundGrime(mat: THREE.MeshStandardMaterial, height = 0.5, strength = 0.22) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vGrimeY;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 gp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gp = instanceMatrix * gp;
        #endif
        vGrimeY = (modelMatrix * gp).y;`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGrimeY;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        diffuseColor.rgb *= mix(${(1 - strength).toFixed(3)}, 1.0, smoothstep(0.0, ${height.toFixed(3)}, vGrimeY));`);
  };
  mat.customProgramCacheKey = () => `grime-${height}-${strength}`;
}
```

- **Decals.** Use drei `<Decal>` for hazard stripes, signage and stains on (non-instanced) walls. Floor markings are cheaper as thin planes with `polygonOffset`.
- **Emissive fixtures.** Push colors above 1 (section 1). Bloom plus AgX gives believable light sources with no real lights. Do not add point lights per fixture; each shadowed light multiplies shadow cost.
- **Floor reflections.** `MeshReflectorMaterial` renders the scene again from a mirrored camera every frame, plus blur. With hundreds of objects that is close to double the cost. If you want it, mount it only when the interior is visible, with `resolution={512}` and `mixBlur`. The cheaper and usually better choice is roughness about 0.2 plus a roughness map plus IBL.
- **Light baking.** Lightmaps need an external bake (Blender), which conflicts with procedural generation. Use `ContactShadows frames={1}` and `AccumulativeShadows` for the baked look on flat pads instead.

## Performance guardrails (keep about 60 FPS)

```tsx
import { PerformanceMonitor } from "@react-three/drei";
const [dpr, setDpr] = useState(1.5);
const [aoHalf, setAoHalf] = useState(true);

<Canvas dpr={dpr} /* ... */>
  <PerformanceMonitor
    bounds={(hz) => (hz > 90 ? [50, 90] : [50, 58])}
    flipflops={3}
    onChange={({ factor }) => setDpr(Math.round((1 + 0.5 * factor) * 4) / 4)}   // 1.0 to 1.5
    onDecline={() => setAoHalf(true)}
    onFallback={() => setDpr(1)}
  />
  {/* pass aoHalf to <N8AO halfRes={aoHalf} /> */}
</Canvas>
```

- **DPR.** Cap at 1.5. Beyond that, a laptop pays for pixels you cannot see once SMAA and grain are on.
- **Prefer `PerformanceMonitor` (coarse steps) over `AdaptiveDpr`.** `AdaptiveDpr` needs `performance={{ min: 0.5 }}` on the Canvas and something calling `regress()`. It changes dpr constantly while moving, and every change makes the composer `setSize` and reallocate all render targets.
- **`shadowMap.autoUpdate = false`.** Already in place via `ShadowController`. Keep it; also set `needsUpdate` after the frustum fit (section 7).
- **Instancing.** Instance every repeated part.
  - Merge static, non-interactive decor per material with `BufferGeometryUtils.mergeGeometries` to cut draw calls.
  - After writing instance matrices, call `mesh.computeBoundingSphere()` so frustum culling works.
- **Raycasting.**
  - drei `<Bvh>` only patches meshes whose `raycast === Mesh.prototype.raycast` (verified in `core/Bvh.js`), so **InstancedMesh is skipped**. BVH mainly helps high-poly meshes.
  - With hundreds of 12-triangle boxes, the cost is object count. Put `raycast={() => null}` on decorative meshes. Wrap only interactive groups in `<Bvh firstHitOnly>`.
- **Camera range.** Use near 0.1 or more and far 2000 or less. This helps AO, shadows and z-fighting.

## Sources

- three.js color management: https://threejs.org/manual/#en/color-management
- three.js tone mapping example: https://threejs.org/examples/#webgl_tonemapping
- three.js r182 migration guide (PCFSoftShadowMap deprecated): https://github.com/mrdoob/three.js/wiki/Migration-Guide
- three.js releases (r186: PCFSoftShadowMap removed, SunLight with CSM): https://github.com/mrdoob/three.js/releases
- three.js sky example: https://threejs.org/examples/#webgl_shaders_sky
- three.js CSM example: https://threejs.org/examples/#webgl_shadowmap_csm
- N8AO README (radius, quality modes, MSAA, half-res): https://github.com/N8python/n8ao
- react-postprocessing N8AO: https://react-postprocessing.docs.pmnd.rs/passes/n8ao
- react-postprocessing EffectComposer (multisampling, mergeMode): https://react-postprocessing.docs.pmnd.rs/effect-composer
- react-postprocessing SMAA: https://react-postprocessing.docs.pmnd.rs/effects/smaa
- react-postprocessing ToneMapping: https://react-postprocessing.docs.pmnd.rs/effects/tone-mapping
- drei Environment (presets on CDN, @pmndrs/assets): https://drei.docs.pmnd.rs/staging/environment
- drei AccumulativeShadows: https://drei.docs.pmnd.rs/staging/accumulative-shadows
- @pmndrs/assets: https://github.com/pmndrs/assets and the file list at https://app.unpkg.com/@pmndrs/assets/files/hdri
- Forum thread on N8AO plus anti-aliasing: https://discourse.threejs.org/t/how-to-solve-the-anlias-after-n8ao-pass-i-used-smaa-but-not-work-well/60104
- Physically based material values: https://physicallybased.info/
- Poly Haven license (CC0): https://polyhaven.com/license
- ambientCG license (CC0): https://docs.ambientcg.com/license/
- Three.js Journey, "Realistic render" lesson: https://threejs-journey.com/lessons/realistic-render
- Local source checks: `node_modules/@react-three/postprocessing/dist/index.js` (tone mapping guard, N8AO wrapper, merge rules), `node_modules/three/src/renderers/WebGLRenderer.js` (environmentIntensity override), `node_modules/three/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js` (PCF Vogel and radius), `node_modules/@react-three/drei/core/{useEnvironment,SoftShadows,Bvh}.js`, `node_modules/three/examples/jsm/lights/SunLight*.js`.
