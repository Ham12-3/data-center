import { useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { simClock } from "@/lib/sim/clock";

type P3 = readonly [number, number, number];

interface FlowLineProps {
  points: readonly P3[];
  color: string;
  radius?: number;
  /** Pulse travel speed, m/s of simulation time (negative reverses). */
  speed?: number;
  /** Distance between pulses, m. */
  spacing?: number;
  /** Base visibility of the line between pulses, 0..1. */
  opacity?: number;
  /** Overall brightness; values above 1 bloom. */
  intensity?: number;
}

/**
 * A polyline drawn as a thin tube with bright pulses travelling along it, used
 * for power and data flows. The tube's U texture coordinate runs 0..1 along
 * its length, so in the shader `vUv.x * length` is the distance from the start;
 * subtracting `time * speed` makes a repeating pulse pattern move along the path.
 */
export function FlowLine({ points, color, radius = 0.06, speed = 8, spacing = 3, opacity = 0.25, intensity = 2.5 }: FlowLineProps): ReactNode {
  const { geometry, length } = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < points.length; i++) {
      path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    }
    const length = path.getLength();
    const segments = Math.min(2000, Math.max(16, Math.ceil(length / 0.25)));
    return { geometry: new THREE.TubeGeometry(path, segments, radius, 6, false), length };
  }, [points, radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uLength: { value: length },
          uSpeed: { value: speed },
          uSpacing: { value: spacing },
          uBase: { value: opacity },
          uIntensity: { value: intensity },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uLength, uSpeed, uSpacing, uBase, uIntensity;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float d = vUv.x * uLength - uTime * uSpeed;
            float f = fract(d / uSpacing);
            // Short bright head with a soft tail behind it.
            float pulse = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.08, 0.45, f));
            float a = uBase + (1.0 - uBase) * pulse;
            gl_FragColor = vec4(uColor * (0.6 + uIntensity * pulse), a);
          }`,
        transparent: true,
        depthWrite: false,
      }),
    [color, length, speed, spacing, opacity, intensity],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const meshRef = useRef<THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>>(null);
  useFrame(() => {
    const mat = meshRef.current?.material;
    if (mat) mat.uniforms.uTime.value += simClock.delta;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />;
}
