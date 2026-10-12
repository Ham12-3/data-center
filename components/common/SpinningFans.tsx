import { useFrame } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import { simClock } from "@/lib/sim/clock";
import { live } from "@/lib/sim/live";
import { std } from "@/lib/three/materialCache";

export interface FanSpec {
  readonly position: readonly [number, number, number];
  readonly radius: number;
  /** Axis the rotor spins about. Rooftop fans spin about Y (blowing up). */
  readonly axis?: "x" | "y" | "z";
  /** Radians per second at 100% speed. */
  readonly speed?: number;
  readonly blades?: number;
}

/** Unit blade spanning x ∈ [0, 1], so scaling X sets blade length from the hub. */
const bladeGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0);
const bladeMaterial = std("#2a2d31", { roughness: 0.5, metalness: 0.3 });

const AXIS_QUAT: Record<"x" | "y" | "z", THREE.Quaternion> = {
  y: new THREE.Quaternion(),
  x: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  z: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
};

const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
/** Blade pitch: a small twist about the blade's long axis. */
const PITCH = new THREE.Quaternion().setFromAxisAngle(X, 0.35);

/**
 * Every fan rotor of a group in one InstancedMesh, animated per frame.
 * Rotation of blade k = axisOrientation · spin(angle + k·2π/n) · pitch.
 */
interface SpinningFansProps {
  fans: readonly FanSpec[];
  speedFactor?: number;
  /**
   * Per-frame speed (0..1) for fans driven by something other than the
   * cooling load, e.g. generator radiators that only turn while engines run.
   */
  speedSource?: () => number;
}

export function SpinningFans({ fans, speedFactor = 1, speedSource }: SpinningFansProps): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = useMemo(() => fans.reduce((n, f) => n + (f.blades ?? 5), 0), [fans]);
  // Per-fan phase offset so neighbouring fans don't turn in sync.
  const phases = useMemo(() => fans.map((_, i) => (i * 1.618) % (Math.PI * 2)), [fans]);
  const angles = useRef<number[]>([]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), spin: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  );

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { m, q, spin, p, s } = tmp;
    // Fans follow the simulation clock and speed up with load (CRAH / dry-cooler fan speed).
    const delta = simClock.delta * (speedSource ? speedSource() : live.metrics.fanSpeed * 1.4);
    let i = 0;
    fans.forEach((fan, f) => {
      const n = fan.blades ?? 5;
      const a = (angles.current[f] ?? phases[f]) + delta * (fan.speed ?? 8) * speedFactor;
      angles.current[f] = a % (Math.PI * 2);
      p.set(...fan.position);
      s.set(fan.radius * 0.94, Math.max(0.01, fan.radius * 0.02), fan.radius * 0.32);
      for (let k = 0; k < n; k++) {
        spin.setFromAxisAngle(Y, a + (k * Math.PI * 2) / n);
        q.copy(AXIS_QUAT[fan.axis ?? "y"]).multiply(spin).multiply(PITCH);
        mesh.setMatrixAt(i++, m.compose(p, q, s));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh key={count} ref={ref} args={[bladeGeometry, bladeMaterial, count]} frustumCulled={false} />;
}
