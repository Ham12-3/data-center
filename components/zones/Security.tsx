import type { ReactNode } from "react";
import { Block, Box, Cyl } from "@/components/common/Primitives";
import { Selectable } from "@/components/common/Selectable";
import { roomById } from "@/data/site";
import { unitPlane } from "@/lib/three/geometries";
import { PAL, glow, std } from "@/lib/three/materialCache";
import { screenMaterial } from "@/lib/three/screenTextures";

const room = roomById("lobby").rect;
const glass = std("#bfe3ff", { transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2, doubleSide: true });
const steel = std("#b9c0c8", { metalness: 0.85, roughness: 0.25 });

/** Wall- or post-mounted card reader with a status LED. */
function BadgeReader({ id, position }: { id: string; position: [number, number, number] }) {
  return (
    <Selectable id={id} type="badge-reader" label="Badge (card) reader" position={position}>
      <Box size={[0.09, 0.14, 0.03]} material={std("#1b1e22")} />
      <Box size={[0.03, 0.012, 0.005]} position={[0, 0.05, 0.017]} material={glow("#3dff6e", 1.5)} cast={false} />
    </Selectable>
  );
}

/** Ceiling dome camera. */
export function DomeCamera({ id, position, label = "CCTV dome camera" }: { id: string; position: [number, number, number]; label?: string }) {
  return (
    <Selectable id={id} type="cctv" label={label} position={position}>
      <Cyl radius={0.09} height={0.05} material={std("#f2f2f0")} />
      <mesh position={[0, -0.04, 0]} scale={[0.07, 0.06, 0.07]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#1a1d22" roughness={0.1} metalness={0.3} />
      </mesh>
    </Selectable>
  );
}

/**
 * Lobby and security: reception, a staffed security desk with CCTV monitors,
 * speed gates, and a mantrap (two interlocked doors that admit one person at
 * a time) guarding the corridor to the technical areas. Inside the mantrap a
 * biometric reader adds a second factor to the badge.
 */
export function Security(): ReactNode {
  const doorX = -16.5; // doorway in the corridor wall: x -18..-15
  return (
    <group>
      {/* Reception and security desk. */}
      <Selectable id="security-desk" type="guard-house" label="Security desk (24/7 guards)">
        <Block size={[4.2, 1.05, 0.9]} position={[-19.4, 0, 18.2]} material={std("#e9e5dd", { roughness: 0.4 })} />
        <Box size={[4.3, 0.04, 1.0]} position={[-19.4, 1.07, 18.2]} material={std("#3b3f45", { roughness: 0.3 })} />
        {[-20.6, -19.4, -18.2].map((x, i) => (
          <group key={x} position={[x, 1.35, 17.95]} rotation={[0, Math.PI, 0]}>
            <Box size={[0.64, 0.4, 0.04]} position={[0, 0, 0.025]} material={std("#0d0f12")} cast={false} />
            <mesh geometry={unitPlane} material={screenMaterial(i === 1 ? "alerts" : "cctv")} scale={[0.6, 0.36, 1]} />
          </group>
        ))}
      </Selectable>

      {/* Speed gates (optical turnstiles). */}
      <Selectable id="speed-gates" type="badge-reader" label="Speed gates with badge readers">
        {[-17.8, -16.6, -15.4, -14.2].map((x) => (
          <group key={x}>
            <Block size={[0.22, 1.0, 1.4]} position={[x, 0, 14]} material={steel} />
            <Box size={[0.18, 0.05, 1.3]} position={[x, 1.02, 14]} material={glow("#38bdf8", 0.9)} cast={false} />
          </group>
        ))}
        {[-17.2, -16.0, -14.8].map((x) => (
          <Box key={x} size={[0.95, 0.9, 0.012]} position={[x, 0.75, 14]} material={glass} cast={false} />
        ))}
      </Selectable>

      {/* Mantrap portal in front of the corridor doorway. */}
      <Selectable id="mantrap" type="mantrap" label="Mantrap (interlocked two-door portal)">
        <Block size={[1.8, 0.05, 1.8]} position={[doorX, 0, 9.3]} material={std("#4b5563")} />
        <Box size={[1.8, 2.5, 0.02]} position={[doorX - 0.9, 1.25, 9.3]} rotation={[0, Math.PI / 2, 0]} material={glass} cast={false} />
        <Box size={[1.8, 2.5, 0.02]} position={[doorX + 0.9, 1.25, 9.3]} rotation={[0, Math.PI / 2, 0]} material={glass} cast={false} />
        <Box size={[1.84, 0.12, 1.84]} position={[doorX, 2.56, 9.3]} material={steel} />
        {[8.4, 10.2].map((z) => (
          <group key={z}>
            <Box size={[1.4, 2.3, 0.03]} position={[doorX, 1.15, z]} material={glass} cast={false} />
            <Box size={[0.05, 2.5, 0.06]} position={[doorX - 0.9, 1.25, z]} material={steel} />
            <Box size={[0.05, 2.5, 0.06]} position={[doorX + 0.9, 1.25, z]} material={steel} />
          </group>
        ))}
        <Box size={[0.2, 0.06, 0.02]} position={[doorX, 2.4, 10.23]} material={glow("#ff3b30", 1.2)} cast={false} />
      </Selectable>
      <BadgeReader id="badge-mantrap-out" position={[doorX + 1.05, 1.2, 10.3]} />
      <BadgeReader id="badge-mantrap-in" position={[doorX + 0.8, 1.2, 9.3]} />
      <Selectable id="biometric" type="biometric-scanner" label="Biometric scanner (palm vein / iris)" position={[doorX - 0.8, 1.25, 9.6]}>
        <Box size={[0.16, 0.24, 0.08]} rotation={[0, Math.PI / 2, 0]} material={std("#20242a")} />
        <Box size={[0.01, 0.08, 0.1]} position={[0.045, 0.04, 0]} material={glow("#38bdf8", 1.2)} cast={false} />
      </Selectable>

      {/* Waiting area and greenery. */}
      {[-13.5, -12.2].map((x) => (
        <Block key={x} size={[1.0, 0.45, 0.8]} position={[x, 0, 21.5]} material={std("#3b4a5c", { roughness: 0.9 })} />
      ))}
      {[[-21, 24.5], [-11, 24.5]].map(([x, z]) => (
        <group key={x}>
          <Cyl radius={0.25} height={0.5} position={[x, 0.25, z]} material={std("#d6d3cc")} />
          <mesh position={[x, 1.0, z]} scale={[0.45, 0.7, 0.45]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#3f6b34" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <Box size={[6, 2.2, 0.06]} position={[(room.x0 + room.x1) / 2, 2.6, room.z0 + 0.15]} material={std("#1d3a5f")} cast={false} />
      <Box size={[5.4, 0.12, 0.02]} position={[(room.x0 + room.x1) / 2, 2.6, room.z0 + 0.19]} material={glow("#7dd3fc", 1.2)} cast={false} />

      <DomeCamera id="cctv-lobby-1" position={[-20, 6.9, 22]} />
      <DomeCamera id="cctv-lobby-2" position={[-12, 6.9, 12]} />
      <DomeCamera id="cctv-mantrap" position={[doorX, 2.55, 9.3]} label="CCTV camera inside the mantrap" />
      {/* Fire alarm call point by the entrance. */}
      <Box size={[0.12, 0.12, 0.04]} position={[-21.88, 1.4, 15]} rotation={[0, Math.PI / 2, 0]} material={std(PAL.fireRed)} cast={false} />
    </group>
  );
}
