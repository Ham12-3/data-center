import { type ReactNode, useMemo } from "react";
import { PipeRuns } from "@/components/common/Pipes";
import { Block, Box, Cyl, type V3 } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { PAL, glow, std } from "@/lib/three/materialCache";
import { useStore } from "@/store/useStore";

const shellPaint = std("#3d6f9e", { roughness: 0.45, metalness: 0.3 });
const motorPaint = std("#2f5d8a", { roughness: 0.4, metalness: 0.4 });
const frame = std("#3b4048", { metalness: 0.5, roughness: 0.5 });

/**
 * Water-cooled centrifugal chiller: refrigerant boils in the evaporator shell,
 * taking heat out of the chilled water; the compressor raises its pressure and
 * the condenser shell rejects that heat into condenser water, which is pumped
 * up to the rooftop cooling towers.
 */
function Chiller({ id, position }: { id: string; position: V3 }): ReactNode {
  const L = 5.2;
  return (
    <Selectable id={id} type="chiller" label={`Water-cooled chiller ${id}`} position={position}>
      <Block size={[L + 0.4, 0.25, 2.2]} material={frame} />
      {/* Evaporator (lower, chilled water) and condenser (upper, condenser water) shells. */}
      <Cyl radius={0.5} height={L} position={[0, 0.85, -0.45]} rotation={[0, 0, Math.PI / 2]} material={shellPaint} />
      <Cyl radius={0.45} height={L} position={[0, 0.8, 0.55]} rotation={[0, 0, Math.PI / 2]} material={shellPaint} />
      {/* Water boxes at the ends. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cyl radius={0.55} height={0.25} position={[s * (L / 2 + 0.12), 0.85, -0.45]} rotation={[0, 0, Math.PI / 2]} material={frame} />
          <Cyl radius={0.5} height={0.25} position={[s * (L / 2 + 0.12), 0.8, 0.55]} rotation={[0, 0, Math.PI / 2]} material={frame} />
        </group>
      ))}
      {/* Centrifugal compressor and motor on top, suction elbow, starter/VFD and control panel. */}
      <Cyl radius={0.42} height={1.4} position={[0.6, 1.9, 0]} rotation={[0, 0, Math.PI / 2]} material={motorPaint} />
      <Cyl radius={0.55} height={0.5} position={[-0.35, 1.9, 0]} rotation={[0, 0, Math.PI / 2]} material={motorPaint} />
      <Cyl radius={0.22} height={0.9} position={[-0.9, 1.5, -0.3]} material={shellPaint} />
      <Block size={[0.9, 1.9, 0.6]} position={[L / 2 - 0.2, 0.25, 1.35]} material={std(PAL.cabinetGrey, { roughness: 0.45 })} />
      <Box size={[0.3, 0.22, 0.01]} position={[L / 2 - 0.2, 1.6, 1.66]} material={glow("#38bdf8", 1)} cast={false} />
    </Selectable>
  );
}

/** End-suction pump on a base frame, motor coupled to a volute casing. */
function Pump({ id, position, label, color }: { id: string; position: V3; label: string; color: string }): ReactNode {
  return (
    <Selectable id={id} type="pump" label={label} position={position}>
      <Block size={[1.6, 0.25, 0.7]} material={std(PAL.concrete)} />
      <Block size={[1.4, 0.1, 0.5]} position={[0, 0.25, 0]} material={frame} />
      <Cyl radius={0.22} height={0.75} position={[-0.3, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} material={std("#2a5d9a", { metalness: 0.4, roughness: 0.4 })} />
      <Cyl radius={0.28} height={0.22} position={[0.25, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} material={std(color, { roughness: 0.45 })} />
      <Cyl radius={0.1} height={0.45} position={[0.25, 1.05, 0]} material={std(color, { roughness: 0.45 })} />
      <Cyl radius={0.1} height={0.35} position={[0.55, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} material={std(color, { roughness: 0.45 })} />
    </Selectable>
  );
}

const CHILLERS: { id: string; z: number }[] = [
  { id: "CH-1", z: 11.2 },
  { id: "CH-2", z: 15.2 },
  { id: "CH-3", z: 19.2 },
];
const CHILLER_X = -35.5;
const PUMP_X = -27.2;

/**
 * Cooling plant: 3 chillers (N+1), chilled-water and condenser-water pumps,
 * a plate heat exchanger for free cooling (when it is cold outside, the dry
 * coolers can chill the water without running compressors), a buffer tank and
 * the headers that carry chilled water out to the data halls.
 */
export function CoolingPlant(): ReactNode {
  const showPipes = useStore((s) => s.layers.pipes);
  const pipes = useMemo(() => {
    const supply: V3[][] = [];
    const ret: V3[][] = [];
    const cond: V3[][] = [];
    const yS = 3.6;
    const yR = 4.1;
    const yC = 4.7;
    // Chilled water headers along the east side of the plant, out through the corridor.
    supply.push([[PUMP_X + 1.6, yS, 10], [PUMP_X + 1.6, yS, 22.5]]);
    ret.push([[PUMP_X + 2.1, yR, 10], [PUMP_X + 2.1, yR, 22.5]]);
    supply.push([[PUMP_X + 1.6, yS, 10], [PUMP_X + 1.6, yS, 5.4], [40, yS, 5.4]]);
    ret.push([[PUMP_X + 2.1, yR, 10], [PUMP_X + 2.1, yR, 6.2], [40, yR, 6.2]]);
    // Branches into the halls: down into Hall A's raised floor and up into Hall B.
    supply.push([[-7.5, yS, 5.4], [-7.5, 0.18, 5.4]]);
    ret.push([[-7.9, yR, 6.2], [-7.9, 0.4, 6.2]]);
    for (const c of CHILLERS) {
      // Evaporator connections → pumps → headers.
      supply.push([[CHILLER_X + 2.75, 0.85, c.z - 0.45], [CHILLER_X + 3.4, 0.85, c.z - 0.45], [CHILLER_X + 3.4, yS, c.z - 0.45], [PUMP_X + 1.6, yS, c.z - 0.45]]);
      ret.push([[CHILLER_X - 2.75, 0.85, c.z - 0.45], [CHILLER_X - 3.2, 0.85, c.z - 0.45], [CHILLER_X - 3.2, yR, c.z - 0.45], [PUMP_X + 2.1, yR, c.z - 0.45]]);
      // Condenser connections up to the cooling towers.
      cond.push([[CHILLER_X + 2.75, 0.8, c.z + 0.55], [CHILLER_X + 3.0, 0.8, c.z + 0.55], [CHILLER_X + 3.0, yC, c.z + 0.55], [-31.9, yC, c.z + 0.55]]);
    }
    cond.push([[-31.9, yC, 11.75], [-31.9, yC, 21], [-31.9, 7, 21]]);
    cond.push([[-31.9, yC, 11.75], [-32.3, yC, 11.5], [-32.3, 7, 11.5]]);
    return { supply, ret, cond };
  }, []);

  return (
    <group>
      {CHILLERS.map((c) => (
        <Chiller key={c.id} id={c.id} position={[CHILLER_X, 0, c.z]} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Pump key={`chw${i}`} id={`CHWP-${i + 1}`} label={`Chilled-water pump CHWP-${i + 1}`} color={PAL.chwSupply} position={[PUMP_X, 0, 10.6 + i * 1.6]} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Pump key={`cw${i}`} id={`CWP-${i + 1}`} label={`Condenser-water pump CWP-${i + 1}`} color={PAL.condenser} position={[PUMP_X, 0, 17.8 + i * 1.6]} />
      ))}
      {/* Plate heat exchanger (free cooling), buffer tank and expansion vessel. */}
      <Selectable id="PHX-1" type="chiller" label="Free-cooling plate heat exchanger">
        <Block size={[0.9, 2.0, 2.4]} position={[-24.4, 0, 22.5]} material={std("#7f8a93", { metalness: 0.5, roughness: 0.4 })} />
        {Array.from({ length: 10 }, (_, i) => (
          <Box key={i} size={[0.92, 1.7, 0.02]} position={[-24.4, 1.0, 21.45 + i * 0.22]} material={std("#a7b0b8", { metalness: 0.6 })} cast={false} />
        ))}
      </Selectable>
      <Selectable id="BT-1" type="chilled-water-pipe" label="Chilled-water buffer tank">
        <Cyl radius={0.9} height={3.4} position={[-39.8, 1.7, 24]} material={std("#c9ced3", { metalness: 0.5, roughness: 0.4 })} />
        <Cyl radius={0.35} height={1.0} position={[-38, 0.5, 24.6]} material={std("#d13b30", { roughness: 0.45 })} />
      </Selectable>
      {showPipes && (
        <Selectable id="plant-pipes" type="chilled-water-pipe" label="Chilled water (blue/red) and condenser water (green) headers">
          <PipeRuns runs={pipes.supply} radius={0.16} material={std(PAL.chwSupply, { roughness: 0.4 })} />
          <PipeRuns runs={pipes.ret} radius={0.16} material={std(PAL.chwReturn, { roughness: 0.4 })} />
          <PipeRuns runs={pipes.cond} radius={0.18} material={std(PAL.condenser, { roughness: 0.4 })} />
        </Selectable>
      )}
    </group>
  );
}
