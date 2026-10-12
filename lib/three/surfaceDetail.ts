import type * as THREE from "three";

/**
 * Procedural, world-space surface detail injected into MeshStandardMaterial.
 *
 * Flat albedo and constant roughness are the biggest "CG" giveaways on large
 * procedural surfaces. Because everything here is built from scaled unit
 * boxes, ordinary UV textures would stretch, so the detail is computed from
 * the *world position* in the shader instead:
 *
 * - albedo variation: low-frequency fBm tints the colour by ±colorVar
 * - roughness variation: a second fBm octave set scales roughness by ±roughVar
 * - relief: the fBm height is turned into a bump by screen-space derivatives
 *   (the same maths as three's perturbNormalArb), giving concrete, grass and
 *   painted metal a tactile surface without any normal-map texture
 * - grime: surfaces darken slightly towards the ground, like real buildings
 */
export interface DetailOptions {
  /** Noise frequency in cycles per metre. */
  scale?: number;
  colorVar?: number;
  roughVar?: number;
  /** Bump strength (0 disables relief). */
  bump?: number;
  /** Frequency of the relief noise, cycles per metre. */
  bumpScale?: number;
  /** Darkening at ground level (0..1) fading out by `grimeHeight` metres. */
  grime?: number;
  grimeHeight?: number;
}

const NOISE_GLSL = /* glsl */ `
  varying vec3 vDetailWorld;
  float dHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float dNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float dFbm(vec3 p) {
    return 0.5 * dNoise(p) + 0.25 * dNoise(p * 2.03) + 0.125 * dNoise(p * 4.01) + 0.0625 * dNoise(p * 8.07);
  }
`;

export function applySurfaceDetail(mat: THREE.MeshStandardMaterial, opts: DetailOptions): void {
  const o = {
    scale: opts.scale ?? 0.5,
    colorVar: opts.colorVar ?? 0.12,
    roughVar: opts.roughVar ?? 0.3,
    bump: opts.bump ?? 0,
    bumpScale: opts.bumpScale ?? 6,
    grime: opts.grime ?? 0,
    grimeHeight: opts.grimeHeight ?? 0.6,
  };
  const f = (n: number) => n.toFixed(4);

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vDetailWorld;")
      .replace(
        "#include <project_vertex>",
        /* glsl */ `#include <project_vertex>
        {
          vec4 dp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            dp = instanceMatrix * dp;
          #endif
          vDetailWorld = (modelMatrix * dp).xyz;
        }`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${NOISE_GLSL}`)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float dTone = dFbm(vDetailWorld * ${f(o.scale)});
        diffuseColor.rgb *= 1.0 + (dTone - 0.5) * ${f(o.colorVar * 2)};
        diffuseColor.rgb *= mix(${f(1 - o.grime)}, 1.0, smoothstep(0.0, ${f(o.grimeHeight)}, vDetailWorld.y));`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        float dRough = dFbm(vDetailWorld * ${f(o.scale * 3.1)} + 17.0);
        roughnessFactor = clamp(roughnessFactor * (1.0 + (dRough - 0.5) * ${f(o.roughVar * 2)}), 0.04, 1.0);`,
      );

    if (o.bump > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
        {
          // Bump from procedural height via screen-space derivatives (perturbNormalArb).
          float hgt = dFbm(vDetailWorld * ${f(o.bumpScale)});
          vec2 dHdxy = vec2(dFdx(hgt), dFdy(hgt)) * ${f(o.bump)};
          vec3 vSigmaX = dFdx(-vViewPosition);
          vec3 vSigmaY = dFdy(-vViewPosition);
          vec3 R1 = cross(vSigmaY, normal);
          vec3 R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDirection;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          normal = normalize(abs(fDet) * normal - vGrad);
        }`,
      );
    }
  };
  mat.customProgramCacheKey = () => `detail-${JSON.stringify(o)}`;
}
