import { type ReactNode, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { LedPart } from "@/lib/rack/parts";
import { unitBox } from "@/lib/three/geometries";
import { BLINK_MODE_INDEX, ledMaterial } from "@/lib/three/materials";

/**
 * Each LED list gets its own geometry (a clone of the unit box) because it
 * carries the per-instance blink attribute, which can't live on the shared
 * geometry. Cached per list, so racks sharing a model share the geometry.
 */
const geometryCache = new WeakMap<readonly LedPart[], THREE.BufferGeometry>();

function ledGeometry(leds: readonly LedPart[]): THREE.BufferGeometry {
  let g = geometryCache.get(leds);
  if (!g) {
    g = unitBox.clone();
    const blink = new Float32Array(leds.length * 3);
    leds.forEach((led, i) => {
      blink[i * 3] = BLINK_MODE_INDEX[led.mode];
      blink[i * 3 + 1] = led.rate;
      blink[i * 3 + 2] = led.phase;
    });
    g.setAttribute("aBlink", new THREE.InstancedBufferAttribute(blink, 3));
    geometryCache.set(leds, g);
  }
  return g;
}

/**
 * All status LEDs of a rack in one InstancedMesh. Colour comes from the
 * built-in instanceColor; the blink pattern from a per-instance `aBlink`
 * attribute evaluated on the GPU (see ledMaterial). The LED clocks are
 * advanced by SimDriver, so blinking follows the simulation.
 */
export function StatusLEDs({ leds, hidden = null }: { leds: readonly LedPart[]; hidden?: number | null }): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);

  const geometry = ledGeometry(leds);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    leds.forEach((led, i) => {
      if (led.owner === hidden) scale.set(0, 0, 0);
      else scale.set(...led.size);
      matrix.compose(position.set(...led.pos), rotation, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(led.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [leds, geometry, hidden]);

  return <instancedMesh key={leds.length} ref={ref} args={[geometry, ledMaterial, leds.length]} />;
}
