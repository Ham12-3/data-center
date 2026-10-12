"use client";

import { useEffect, useRef } from "react";
import { BUILDING, GENERATORS, ROOMS, type RoomId } from "@/data/site";
import { type SoundParams, peekSoundEngine } from "@/lib/audio/soundEngine";
import { cameraTracker } from "@/lib/cameraTracker";
import { live } from "@/lib/sim/live";
import { scenarioById } from "@/lib/sim/scenarios";
import { useStore } from "@/store/useStore";

/** Ambience per room: [hall, hum, plant]. */
const ROOM_SOUND: Record<RoomId, [number, number, number]> = {
  hallA: [1, 0.2, 0],
  hallB: [0.9, 0.3, 0.15],
  mmr: [0.45, 0.15, 0],
  core: [0.55, 0.15, 0],
  fire: [0.15, 0.1, 0],
  corridor: [0.18, 0.05, 0.05],
  cooling: [0.1, 0.25, 1],
  lobby: [0.04, 0.02, 0],
  noc: [0.05, 0.03, 0],
  battery: [0.05, 0.6, 0],
  elecA: [0.08, 1, 0.1],
  elecB: [0.08, 1, 0.1],
};

const GEN_YARD = GENERATORS.reduce((a, g) => [a[0] + g.x / GENERATORS.length, a[1] + g.z / GENERATORS.length], [0, 0]);

/** Work out what should be audible from the camera's position and the simulation state. */
function soundParams(cutaway: boolean): SoundParams {
  const { x, y, z } = cameraTracker;
  const F = BUILDING.footprint;
  const insideFootprint = x > F.x0 && x < F.x1 && z > F.z0 && z < F.z1;
  const indoors = insideFootprint && y < BUILDING.partitionHeight && !cutaway;
  // Higher up, everything is further away: distance attenuation for aerial views.
  const altitude = Math.max(0, y - 2);
  const far = 1 / (1 + altitude / 25);

  let hall = 0;
  let hum = 0;
  let plant = 0;
  let outdoor = 0;
  if (indoors) {
    const room = ROOMS.find((r) => x > r.rect.x0 && x < r.rect.x1 && z > r.rect.z0 && z < r.rect.z1);
    [hall, hum, plant] = room ? ROOM_SOUND[room.id] : [0.1, 0.05, 0];
  } else {
    // Outside: wind, plus the building's rooftop plant and a whisper of the halls.
    const dx = Math.max(F.x0 - x, 0, x - F.x1);
    const dz = Math.max(F.z0 - z, 0, z - F.z1);
    const near = 1 / (1 + Math.hypot(dx, dz) / 20);
    outdoor = 0.5 + 0.5 * Math.min(1, altitude / 40);
    plant = 0.55 * near * far;
    hall = 0.06 * near * far;
  }

  const fx = live.effects;
  const gd = Math.hypot(x - GEN_YARD[0], z - GEN_YARD[1], y - 3);
  const generatorLevel = Math.max(0, 1 - gd / 220) ** 2 * (indoors ? 0.25 : 1);
  const fireStage = fx.fire.stage;
  return {
    hall,
    hum,
    plant,
    outdoor,
    fanSpeed: live.metrics.fanSpeed,
    generatorRpm: fx.generatorRpm,
    generatorLevel,
    fireAlarm: fireStage === "fire1" || fireStage === "fire2" || fireStage === "discharge",
    upsAlarm: fx.onBattery,
  };
}

/**
 * Drives the sound engine ten times a second while sound is on: ambience
 * follows where the camera is, fan noise follows load, generators follow
 * their engine speed, and alarms follow the running scenario. A chime plays
 * when a scenario reaches a critical step.
 */
export default function SoundController() {
  const soundOn = useStore((s) => s.soundOn);
  const lastStep = useRef<string | null>(null);

  useEffect(() => {
    const engine = peekSoundEngine();
    if (!engine) return;
    if (!soundOn) {
      void engine.suspend();
      return;
    }
    void engine.resume();
    const id = window.setInterval(() => {
      const { cutaway } = useStore.getState();
      engine.update(soundParams(cutaway));
      const sc = live.scenario;
      if (sc) {
        const def = scenarioById(sc.id);
        const step = def.steps[Math.min(sc.step, def.steps.length - 1)];
        const key = `${sc.id}:${step.at}`;
        if (key !== lastStep.current) {
          lastStep.current = key;
          if (step.severity === "critical") engine.chime();
        }
      } else lastStep.current = null;
    }, 100);
    return () => window.clearInterval(id);
  }, [soundOn]);

  return null;
}
