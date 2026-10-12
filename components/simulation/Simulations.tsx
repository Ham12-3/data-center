import type { ReactNode } from "react";
import { useInteriorVisible, useStore } from "@/store/useStore";
import { Airflow } from "./Airflow";
import { HeatMap } from "./HeatMap";
import { PacketFlow } from "./PacketFlow";
import { PowerFlow } from "./PowerFlow";
import { ScenarioVisuals } from "./ScenarioVisuals";

/**
 * Simulation overlays, each toggled from the simulation panel. Airflow and the
 * heat map live inside the halls, so they are only mounted when the interior
 * is visible.
 */
export function Simulations(): ReactNode {
  const layers = useStore((s) => s.sim.layers);
  const interior = useInteriorVisible();
  return (
    <group>
      {layers.data && <PacketFlow />}
      {layers.power && <PowerFlow />}
      {layers.airflow && interior && <Airflow />}
      {layers.heatmap && interior && <HeatMap />}
      <ScenarioVisuals />
    </group>
  );
}
