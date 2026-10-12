import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, type ReactNode, useEffect, useRef } from "react";
import * as THREE from "three";
import { BUILDING } from "@/data/site";
import { ZONES } from "@/data/zones";
import { cameraTracker } from "@/lib/cameraTracker";
import { useStore } from "@/store/useStore";
import { WalkControls } from "./WalkControls";

const FLIGHT_SECONDS = 2.2;

/** Smooth start and stop: cubic ease-in-out. */
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Flight {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  arc: number;
}

const F = BUILDING.footprint;
const INITIAL = ZONES[0].shot;

/**
 * Owns the camera. Orbit controls for free exploration and the guided tour,
 * first-person controls in walk mode, plus scripted flights between zones. A flight interpolates position and look-at target together,
 * lifting the path into an arc when travelling far so the camera clears the
 * building instead of passing through walls.
 */
export function CameraRig(): ReactNode {
  const mode = useStore((s) => s.cameraMode);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const flight = useRef<Flight | null>(null);
  const get = useThree((s) => s.get);

  // Coming back from walk mode, orbit around a point a few metres ahead
  // instead of snapping to the default target.
  useEffect(() => {
    if (mode === "walk") return;
    const ctrl = controls.current;
    if (!ctrl) return;
    const { camera } = get();
    const ahead = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5).add(camera.position);
    ctrl.target.copy(ahead);
    ctrl.update();
  }, [mode, get]);

  useFrame((_, delta) => {
    const state = useStore.getState();
    const ctrl = controls.current;
    const { camera } = get();

    // Start a new flight when one is requested.
    if (state.flight && ctrl) {
      const to = state.flight;
      const fromPos = camera.position.clone();
      const toPos = new THREE.Vector3(...to.position);
      flight.current = {
        fromPos,
        fromTarget: ctrl.target.clone(),
        toPos,
        toTarget: new THREE.Vector3(...to.target),
        t: 0,
        // Arc height grows with distance travelled, capped.
        arc: Math.min(60, fromPos.distanceTo(toPos) * 0.25),
      };
      state.clearFlight();
      ctrl.enabled = false;
    }

    const f = flight.current;
    if (f && ctrl) {
      f.t = Math.min(1, f.t + delta / FLIGHT_SECONDS);
      const k = ease(f.t);
      camera.position.lerpVectors(f.fromPos, f.toPos, k);
      camera.position.y += Math.sin(Math.PI * k) * f.arc;
      ctrl.target.lerpVectors(f.fromTarget, f.toTarget, k);
      ctrl.update();
      if (f.t >= 1) {
        flight.current = null;
        ctrl.enabled = true;
      }
    }

    // Track whether the camera is inside the building envelope.
    const p = camera.position;
    cameraTracker.x = p.x;
    cameraTracker.y = p.y;
    cameraTracker.z = p.z;
    const inside = p.x > F.x0 && p.x < F.x1 && p.z > F.z0 && p.z < F.z1 && p.y < BUILDING.partitionHeight;
    if (inside !== state.cameraInside) state.setCameraInside(inside);
  });

  if (mode === "walk") return <WalkControls />;

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      target={INITIAL.target as [number, number, number]}
      minDistance={0.3}
      maxDistance={450}
      zoomToCursor
      screenSpacePanning
      // Stop just short of horizontal so the camera never dips below the ground.
      maxPolarAngle={Math.PI * 0.495}
    />
  );
}
