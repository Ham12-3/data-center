import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDING } from "@/data/site";
import { ENTRANCE, buildCollisionWorld, floorHeightAt, resolveMove } from "@/lib/walk/collision";
import { useStore } from "@/store/useStore";

/** Eye height above the floor, m. */
export const EYE_HEIGHT = 1.7;
const WALK_SPEED = 1.6;
const RUN_SPEED = 4.2;
const PLAYER_RADIUS = 0.3;
/** How quickly eye height follows a floor change (steps onto the raised floor), 1/s. */
const STEP_RATE = 10;
/** Scratch vectors reused every frame (there is only ever one walker). */
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};

/**
 * First-person walk mode. Mouse look uses pointer lock (started from the
 * "Click to look around" button, id `walk-lock`); WASD / arrow keys move in
 * the direction you're looking, Shift runs. Movement is resolved against the
 * collision world (walls, racks, equipment) so you slide along obstacles, and
 * eye height follows the floor, stepping up onto Data Hall A's raised floor.
 * While locked, drei centres pointer events, so clicking selects whatever is
 * under the crosshair.
 */
export function WalkControls(): ReactNode {
  const world = useMemo(() => buildCollisionWorld(), []);
  const keys = useRef(new Set<string>());
  const get = useThree((s) => s.get);
  const setLocked = useStore((s) => s.setWalkLocked);

  // Place the walker: keep the current spot if already inside the building at
  // walking height, otherwise start outside the main entrance facing in.
  useEffect(() => {
    const { camera } = get();
    const F = BUILDING.footprint;
    const p = camera.position;
    const inside = p.x > F.x0 && p.x < F.x1 && p.z > F.z0 && p.z < F.z1 && p.y < BUILDING.partitionHeight;
    if (inside) {
      p.y = floorHeightAt(p.x, p.z) + EYE_HEIGHT;
      const dir = camera.getWorldDirection(new THREE.Vector3());
      camera.lookAt(p.x + dir.x, p.y, p.z + dir.z);
    } else {
      const x = (ENTRANCE.x0 + ENTRANCE.x1) / 2;
      p.set(x, EYE_HEIGHT, F.z1 + 7);
      camera.lookAt(x, EYE_HEIGHT, F.z1 - 10);
    }
  }, [get]);

  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (!typing(e)) keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useFrame((_, frameDelta) => {
    const { camera } = get();
    const dt = Math.min(frameDelta, 0.1);
    let f = 0;
    let r = 0;
    for (const k of keys.current) {
      const m = MOVE_KEYS[k];
      if (m) {
        f += m[0];
        r += m[1];
      }
    }
    const p = camera.position;
    if (f !== 0 || r !== 0) {
      // Move in the horizontal plane relative to where the camera is looking.
      camera.getWorldDirection(FWD);
      FWD.y = 0;
      FWD.normalize();
      RIGHT.crossVectors(FWD, UP).normalize();
      const run = keys.current.has("ShiftLeft") || keys.current.has("ShiftRight");
      const speed = (run ? RUN_SPEED : WALK_SPEED) * dt;
      const len = Math.hypot(f, r);
      const dx = ((FWD.x * f + RIGHT.x * r) / len) * speed;
      const dz = ((FWD.z * f + RIGHT.z * r) / len) * speed;
      const next = resolveMove({ x: p.x, z: p.z }, { x: dx, z: dz }, PLAYER_RADIUS, world);
      p.x = next.x;
      p.z = next.z;
    }
    const targetY = floorHeightAt(p.x, p.z) + EYE_HEIGHT;
    p.y += (targetY - p.y) * (1 - Math.exp(-STEP_RATE * dt));
  });

  return <PointerLockControls selector="#walk-lock" makeDefault onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />;
}
