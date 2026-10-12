import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { live } from "@/lib/sim/live";
import { refreshScreens } from "@/lib/three/screenTextures";

/** Redraws the NOC and security screens from the live simulation once a second. */
export function ScreenRefresher(): null {
  const since = useRef(1);
  useFrame((_, dt) => {
    since.current += dt;
    if (since.current < 1) return;
    since.current = 0;
    refreshScreens(live.metrics);
  });
  return null;
}
