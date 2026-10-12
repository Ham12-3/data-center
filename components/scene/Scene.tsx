"use client";

import { Stats } from "@react-three/drei";
import { Canvas, events as defaultEvents, useThree } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  Outline,
  SMAA,
  Selection,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { useControls } from "leva";
import { type ReactNode, Suspense, useEffect } from "react";
import { StaticBatch, PICK_LAYER } from "@/components/common/StaticBatch";
import { BuildingShell } from "@/components/building/BuildingShell";
import { Interior } from "@/components/building/Interior";
import { Rooftop } from "@/components/building/Rooftop";
import { Perimeter } from "@/components/site/Perimeter";
import { Terrain } from "@/components/site/Terrain";
import { FiberEntries, GeneratorYard, PadTransformers, PowerLine, Substation, WaterTank } from "@/components/site/Utilities";
import { SimDriver } from "@/components/simulation/SimDriver";
import { Simulations } from "@/components/simulation/Simulations";
import { Zones } from "@/components/zones/Zones";
import { ZONES } from "@/data/zones";
import { ledUniforms } from "@/lib/three/materials";
import { renderState } from "@/lib/three/renderState";
import { useInteriorVisible, useStore } from "@/store/useStore";
import { CameraRig } from "./CameraRig";
import { Lighting, ShadowController } from "./Lighting";

/** Dev-time render tuning through the Leva panel. */
function RenderSettings({ exposure, ledBrightness }: { exposure: number; ledBrightness: number }): null {
  // Read the renderer through `get` so it is mutated imperatively, outside React state.
  const get = useThree((s) => s.get);
  useEffect(() => {
    renderState.exposure = exposure;
    get().gl.toneMappingExposure = exposure;
  }, [get, exposure]);
  useEffect(() => {
    ledUniforms.uLedBrightness.value = ledBrightness;
  }, [ledBrightness]);
  // StaticBatch hides original meshes on PICK_LAYER; raycasts must still hit them.
  useEffect(() => {
    get().raycaster.layers.enable(PICK_LAYER);
  }, [get]);
  // Development-only handle for inspecting the renderer from the browser console.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") Object.assign(window, { __dcThree: get });
  }, [get]);
  return null;
}

/**
 * Mounted inside the Suspense boundary, so it runs once the environment and
 * textures have loaded. It pre-compiles every material's shader program
 * (in parallel where the GPU driver allows) before revealing the scene, so
 * the first seconds of interaction don't stutter, then hides the loader.
 */
function SceneReady(): null {
  const get = useThree((s) => s.get);
  const setLoadStage = useStore((s) => s.setLoadStage);
  useEffect(() => {
    let cancelled = false;
    setLoadStage("shaders");
    const { gl, scene, camera } = get();
    const reveal = () => {
      // Two frames so the first real render lands before the loader fades.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) setLoadStage("ready");
        }),
      );
    };
    // Some drivers never report parallel compile completion: reveal anyway after a while.
    const fallback = window.setTimeout(reveal, 20000);
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        window.clearTimeout(fallback);
        reveal();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [get, setLoadStage]);
  return null;
}

/** Everything outside the building, merged into a few draw calls by StaticBatch. */
function Site(): ReactNode {
  return (
    <StaticBatch>
      <Terrain />
      <Perimeter />
      <GeneratorYard />
      <PadTransformers />
      <Substation />
      <PowerLine />
      <FiberEntries />
      <WaterTank />
    </StaticBatch>
  );
}

/** Building envelope plus interiors, which are only mounted when visible. */
function Facility(): ReactNode {
  const interiorVisible = useInteriorVisible();
  const interiorLoaded = useStore((s) => s.interiorLoaded);
  const cutaway = useStore((s) => s.cutaway);
  return (
    <group>
      <StaticBatch>
        <BuildingShell />
      </StaticBatch>
      {/* Hidden, not unmounted, in cutaway: toggling X-ray must not rebuild the rooftop batch. */}
      <group visible={!cutaway}>
        <StaticBatch>
          <Rooftop />
        </StaticBatch>
      </group>
      {/* Built on first use, then only hidden: re-entering the building costs nothing. */}
      {interiorLoaded && (
        <group visible={interiorVisible}>
          <StaticBatch>
            <Interior>
              <Zones />
            </Interior>
          </StaticBatch>
        </group>
      )}
    </group>
  );
}

/**
 * Post-processing, in the order the effects must run:
 * ambient occlusion on the HDR scene → anti-aliasing → selection outline →
 * bloom (only values above 1, i.e. LEDs and lights) → AgX filmic tone mapping →
 * light colour grading in display space. Without the ToneMapping effect the
 * composer would clip HDR sky and sun values straight to the screen.
 */
function PostFx({ bloom, ao }: { bloom: boolean; ao: boolean }): ReactNode {
  const inside = useStore((s) => s.cameraInside);
  const level = useStore((s) => s.qualityLevel);
  // Low quality skips post-processing entirely (the renderer tone-maps directly).
  if (level === "low") return null;
  return (
    <EffectComposer multisampling={0} autoClear={false}>
      {/* AO radius is in world units: ~1 m inside rooms, a few metres for aerial views. Off below High. */}
      <N8AO
        // Disabled (not just zero intensity) below High, so its passes don't run at all.
        enabled={ao && level === "high"}
        halfRes
        aoSamples={16}
        denoiseSamples={4}
        denoiseRadius={12}
        aoRadius={inside ? 1.2 : 5}
        distanceFalloff={inside ? 0.5 : 1}
        intensity={ao && level === "high" ? (inside ? 2.6 : 1.8) : 0}
        color="#0a0d12"
      />
      <SMAA />
      <Outline visibleEdgeColor={0x7dd3fc} hiddenEdgeColor={0x1e3a5f} edgeStrength={4} blur xRay />
      <Bloom intensity={bloom ? 0.55 : 0} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <BrightnessContrast contrast={0.08} />
      <HueSaturation saturation={0.06} />
      <Vignette offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
}

/** True if the object and all its ancestors are visible. */
function visibleChain(o: THREE.Object3D | null): boolean {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

/** The 3D scene root. Loaded client-side only (see SceneLoader). */
export default function Scene(): ReactNode {
  const { exposure, lightIntensity, ledBrightness, bloom, ao, postprocessing, stats } = useControls("Render", {
    exposure: { value: 0.9, min: 0.3, max: 2, step: 0.05 },
    lightIntensity: { value: 1, min: 0, max: 2.5, step: 0.05 },
    ledBrightness: { value: 3, min: 0.5, max: 8, step: 0.1 },
    bloom: true,
    ao: true,
    postprocessing: true,
    stats: false,
  });
  const select = useStore((s) => s.select);
  const start = ZONES[0].shot;
  // Resolution follows the (fixed, user-chosen) quality level.
  const level = useStore((s) => s.qualityLevel);
  const setLoadStage = useStore((s) => s.setLoadStage);
  // This module has downloaded and the canvas exists: next, assets load inside Suspense.
  useEffect(() => {
    if (useStore.getState().loadStage === "engine") setLoadStage("assets");
  }, [setLoadStage]);
  // Balanced renders at 1× (CSS pixels): far less GPU work on high-DPI screens; SMAA keeps edges clean.
  const dpr = level === "high" ? 1.5 : 1;

  return (
    <Canvas
      shadows="percentage"
      dpr={dpr}
      camera={{ position: [...start.position], fov: 45, near: 0.1, far: 2200 }}
      // MSAA is unused once the composer renders offscreen (SMAA handles edges instead).
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }}
      // Without post-processing (Low quality) the renderer applies the same AgX tone mapping itself.
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping;
      }}
      onPointerMissed={() => select(null)}
      // Hidden (but still mounted) interiors must not catch clicks or hovers.
      events={(store) => ({ ...defaultEvents(store), filter: (items) => items.filter((i) => visibleChain(i.object)) })}
    >
      {stats && <Stats />}
      <SimDriver />
      <RenderSettings exposure={exposure} ledBrightness={ledBrightness} />
      <Selection>
        <Suspense fallback={null}>
          <Lighting intensity={lightIntensity} />
          <Site />
          <Facility />
          <Simulations />
          {/* Inside the Suspense boundary so these mount only once the scene has loaded. */}
          <ShadowController />
          <SceneReady />
        </Suspense>
        {postprocessing && <PostFx bloom={bloom} ao={ao} />}
      </Selection>
      <CameraRig />
    </Canvas>
  );
}
