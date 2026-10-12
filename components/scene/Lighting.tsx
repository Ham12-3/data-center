import { Cloud, Clouds, Environment, Sky } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useRef } from "react";
import { suspend } from "suspend-react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";

/** South-west afternoon sun: side-lights the default south-east camera views so shadows read. */
const SUN: [number, number, number] = [-150, 160, 95];

// CC0 assets bundled as base64 modules (@pmndrs/assets), loaded lazily so
// they are split out of the main bundle and never hit a CDN at runtime.
const skyHdri = import("@pmndrs/assets/hdri/sky.exr");
const cloudTexture = import("@pmndrs/assets/textures/cloud.webp");

/** Horizon colour of the Sky shader; fog must match it or distant ground ends in a visible band. */
const HAZE = "#c6d3e0";

/** Cloud clusters: [x, y, z, seed, size]. High and spread out, like fair-weather cumulus. */
const CLOUDS: [number, number, number, number, number][] = [
  [-420, 210, -380, 1, 1.2],
  [-120, 240, -520, 2, 1.5],
  [260, 220, -460, 3, 1.1],
  [520, 250, -160, 4, 1.4],
  [-560, 230, 120, 5, 1.3],
  [380, 200, 380, 6, 1.0],
  [-260, 260, 520, 7, 1.4],
  [80, 280, -900, 8, 2.0],
  [-900, 260, -300, 9, 1.8],
  [900, 270, 200, 10, 1.8],
];

function SkyClouds(): ReactNode {
  const texture = suspend(() => cloudTexture, ["cloud-texture"]).default;
  return (
    <Clouds material={THREE.MeshLambertMaterial} texture={texture} limit={260} frustumCulled={false}>
      {CLOUDS.map(([x, y, z, seed, s]) => (
        <Cloud
          key={seed}
          seed={seed}
          position={[x, y, z]}
          segments={22}
          bounds={[70 * s, 10 * s, 45 * s]}
          volume={55 * s}
          smallestVolume={0.35}
          growth={4}
          speed={0.05}
          fade={0}
          opacity={0.9}
          color="#ffffff"
        />
      ))}
    </Clouds>
  );
}

/**
 * Daylight for the campus:
 * - physical sky dome with volumetric-looking cumulus clouds
 * - exponential haze matched to the horizon colour (reads as real aerial perspective)
 * - image-based lighting from a real outdoor HDR capture, for natural reflections and fill
 * - a low hemisphere fill (most fill comes from the HDRI)
 * - one soft-shadowed sun; its shadow frustum tightens around the building when
 *   the camera is inside, trading coverage for ~4x sharper shadows
 */
export function Lighting({ intensity = 1 }: { intensity?: number }): ReactNode {
  const sun = useRef<THREE.DirectionalLight>(null);
  const inside = useStore((s) => s.cameraInside);
  const cutaway = useStore((s) => s.cutaway);
  const level = useStore((s) => s.qualityLevel);
  const get = useThree((s) => s.get);

  // Shadow map resolution follows quality: 4096² (High/Balanced) or 2048² (Low).
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    const size = level === "low" ? 2048 : 4096;
    if (light.shadow.mapSize.x === size) return;
    light.shadow.mapSize.set(size, size);
    light.shadow.map?.dispose();
    light.shadow.map = null;
    get().gl.shadowMap.needsUpdate = true;
  }, [level, get]);

  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    const cam = light.shadow.camera;
    const tight = inside || cutaway;
    const [hx, hz] = tight ? [52, 36] : [135, 110];
    cam.left = -hx;
    cam.right = hx;
    cam.top = hz;
    cam.bottom = -hz;
    cam.updateProjectionMatrix();
    get().gl.shadowMap.needsUpdate = true;
  }, [inside, cutaway, get]);

  return (
    <>
      <Sky sunPosition={SUN} turbidity={4} rayleigh={1} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <fogExp2 attach="fog" args={[HAZE, 0.0008]} />
      <SkyClouds />
      <Environment files={suspend(() => skyHdri, ["sky-hdri"]).default} environmentIntensity={0.42 * intensity} />
      <hemisphereLight args={["#dfe9ff", "#55604a", 0.22 * intensity]} />
      <directionalLight
        ref={sun}
        position={SUN}
        intensity={5.2 * intensity}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-radius={4}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      >
        <orthographicCamera attach="shadow-camera" args={[-135, 135, 110, -110, 20, 600]} />
      </directionalLight>
    </>
  );
}

/**
 * The scene is mostly static, so shadows are re-rendered only when something
 * that casts them changes (cutaway, visible layers, newly loaded interiors),
 * rather than every frame. This roughly halves the per-frame draw calls.
 */
export function ShadowController(): null {
  const get = useThree((s) => s.get);
  const cutaway = useStore((s) => s.cutaway);
  const inside = useStore((s) => s.cameraInside);
  const layers = useStore((s) => s.layers);

  useEffect(() => {
    const { gl } = get();
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    // Refresh a few more times while lazily-built geometry settles.
    const timers = [300, 1200, 3000].map((ms) =>
      window.setTimeout(() => {
        get().gl.shadowMap.needsUpdate = true;
      }, ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [get, cutaway, inside, layers]);

  return null;
}
