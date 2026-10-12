/**
 * Failure scenarios: scripted timelines with narration, and a pure function
 * giving the facility's state at any moment of a scenario. Times are in
 * simulation seconds; real events (generator start, gas discharge) keep their
 * true durations, while slow phases (repairs, utility restoration) are
 * compressed so a scenario plays out in one to two minutes.
 */

export type ScenarioId = "utility-loss" | "crah-failure" | "server-failure" | "switch-failure" | "fire" | "fiber-cut";

export type FireStage = "none" | "alert" | "action" | "fire1" | "fire2" | "discharge" | "extinguished" | "ventilating";

export interface ScenarioStep {
  /** Scenario time at which this step begins, s. */
  readonly at: number;
  readonly title: string;
  readonly text: string;
  readonly severity: "info" | "warning" | "critical" | "ok";
}

export interface ScenarioDef {
  readonly id: ScenarioId;
  readonly name: string;
  readonly summary: string;
  readonly duration: number;
  /** Camera zone to fly to when the scenario starts. */
  readonly zone: string;
  /** Simulation overlays that help explain it. */
  readonly layers: readonly ("data" | "power" | "airflow" | "heatmap")[];
  readonly steps: readonly ScenarioStep[];
}

export interface ScenarioEffects {
  readonly gridUp: boolean;
  /** UPS running from batteries (no input power). */
  readonly onBattery: boolean;
  /** Battery state of charge, 0..1. */
  readonly batterySoc: number;
  /** Generator engine speed, 0 (stopped) .. 1 (rated). */
  readonly generatorRpm: number;
  /** The ATS has transferred the load to the generators. */
  readonly onGenerator: boolean;
  /** Interior lighting level, 0..1 (flicker, then emergency lighting). */
  readonly lightFactor: number;
  /** Failed CRAH: hall-A index, how bad the local heating is (0..1) and how far the others have ramped up (0..1). */
  readonly crahFailure: { readonly index: number; readonly severity: number; readonly recovery: number; readonly unitFailed: boolean } | null;
  readonly failedServer: boolean;
  readonly failedSpine: boolean;
  readonly fiberCut: boolean;
  /** Traffic has moved to the redundant server / switch / fibre path. */
  readonly rerouted: boolean;
  /** Packets are being lost during the failover window. */
  readonly dropping: boolean;
  readonly fire: {
    readonly stage: FireStage;
    /** Seconds until gas discharge during the pre-discharge alarm, otherwise null. */
    readonly countdown: number | null;
    readonly smoke: number;
    readonly gas: number;
  };
}

export const NORMAL_EFFECTS: ScenarioEffects = {
  gridUp: true,
  onBattery: false,
  batterySoc: 1,
  generatorRpm: 0,
  onGenerator: false,
  lightFactor: 1,
  crahFailure: null,
  failedServer: false,
  failedSpine: false,
  fiberCut: false,
  rerouted: false,
  dropping: false,
  fire: { stage: "none", countdown: null, smoke: 0, gas: 0 },
};

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: "utility-loss",
    name: "Utility power loss",
    summary: "The grid fails. Watch the UPS, batteries, generators and ATS keep the servers running.",
    duration: 95,
    zone: "overview-xray",
    layers: ["power"],
    steps: [
      { at: 0, severity: "critical", title: "Grid power lost", text: "A fault upstream drops the 132 kV supply. Lights not on emergency circuits go out and the mains-powered cooling pumps stop for a few seconds." },
      { at: 0.5, severity: "warning", title: "UPS on battery: zero interruption", text: "The double-conversion UPS was already powering the servers from its inverter, so they see no gap at all. The DC bus is now fed by the lithium-ion batteries instead of the rectifier." },
      { at: 1, severity: "info", title: "Generators commanded to start", text: "The ATS detects the loss and signals all generators to start. Engines are kept warm by jacket heaters so they start reliably." },
      { at: 2, severity: "info", title: "Engines cranking and running up", text: "Each 2.5 MW engine runs up to 1,500 rpm (50 Hz). The controller waits for stable voltage and frequency before accepting load." },
      { at: 9, severity: "info", title: "Generators synchronised and ready", text: "Voltage and frequency are stable. NFPA 110 Type 10 requires generators to carry the load within 10 seconds." },
      { at: 10, severity: "ok", title: "ATS transfers to generator", text: "The ATS switches the load to the generators. The UPS rectifiers pick up again and start recharging the batteries; lighting and cooling return to normal." },
      { at: 40, severity: "info", title: "Utility power returns", text: "The grid is back, but the ATS waits to be sure it is stable (normally several minutes; compressed here) before trusting it." },
      { at: 60, severity: "ok", title: "Retransfer to utility", text: "A closed-transition (make-before-break) retransfer moves the load back to the grid with no interruption." },
      { at: 62, severity: "info", title: "Generator cool-down", text: "The generators run unloaded for a few minutes to cool down evenly, then stop and return to standby." },
      { at: 85, severity: "ok", title: "Back to normal", text: "Batteries recharged, generators on standby, fuel levels logged. The event is reviewed and the generators' run hours recorded." },
    ],
  },
  {
    id: "crah-failure",
    name: "CRAH unit failure",
    summary: "A computer-room air handler trips. Nearby racks warm up until the redundant units compensate.",
    duration: 150,
    zone: "hallA",
    layers: ["heatmap", "airflow"],
    steps: [
      { at: 0, severity: "info", title: "Normal operation", text: "Twelve CRAHs share Hall A's cooling (N+2 redundancy). Watch the heat map around CRAH-A4 on the north wall." },
      { at: 3, severity: "critical", title: "CRAH-A4 fails", text: "A fan motor fault trips CRAH-A4. Its section of the raised floor loses pressure, so less cold air rises through the nearby perforated tiles." },
      { at: 12, severity: "warning", title: "Inlet temperatures rising nearby", text: "Racks closest to the failed unit warm first. Thermal mass in the room slows the rise, so there are minutes, not seconds, to respond." },
      { at: 25, severity: "warning", title: "BMS alarm in the NOC", text: "The building management system flags high inlet temperatures and the CRAH fault. Operators see it on the video wall and dispatch a technician." },
      { at: 30, severity: "info", title: "Other CRAHs ramp up", text: "The remaining units increase fan speed and chilled-water valve opening to re-pressurise the floor. This is exactly what the N+2 spare capacity is for." },
      { at: 55, severity: "ok", title: "Temperatures stabilise", text: "With the neighbours compensating, inlet temperatures settle, mostly back inside the ASHRAE recommended 18-27 °C range." },
      { at: 110, severity: "info", title: "Technician replaces the fan", text: "The EC fan module is hot-swapped and CRAH-A4 is restarted." },
      { at: 125, severity: "ok", title: "CRAH-A4 back online", text: "Airflow is restored and the other units ramp back down. Temperatures return to normal." },
    ],
  },
  {
    id: "server-failure",
    name: "Server failure",
    summary: "A web server dies. The load balancer detects it and moves traffic to healthy servers.",
    duration: 60,
    zone: "hallA",
    layers: ["data"],
    steps: [
      { at: 0, severity: "info", title: "Serving traffic", text: "Requests flow to a web server in rack A02-08, behind a load balancer that health-checks every server every few seconds." },
      { at: 3, severity: "critical", title: "Server fails", text: "A memory fault crashes the server. Its health LED turns red and in-flight requests to it are lost." },
      { at: 4, severity: "warning", title: "Health checks fail", text: "The load balancer's health checks time out (typically 2-3 consecutive failures)." },
      { at: 6, severity: "ok", title: "Traffic rerouted", text: "The server is removed from the pool and new requests go to healthy servers in another rack. Users at most saw one slow request." },
      { at: 40, severity: "info", title: "Hot-swap repair", text: "A technician replaces the failed DIMM. The server reboots and passes its health checks." },
      { at: 50, severity: "ok", title: "Back in the pool", text: "The server is gradually given traffic again (slow start)." },
    ],
  },
  {
    id: "switch-failure",
    name: "Switch failure",
    summary: "A spine switch fails. Traffic reroutes through the other spines in under a second.",
    duration: 60,
    zone: "core",
    layers: ["data"],
    steps: [
      { at: 0, severity: "info", title: "Leaf-spine fabric", text: "Every leaf connects to every spine, and traffic is spread across all spines with equal-cost multi-path (ECMP) routing." },
      { at: 3, severity: "critical", title: "Spine switch NC1-04 fails", text: "A power supply and supervisor failure take spine NC1-04 offline." },
      { at: 3.3, severity: "ok", title: "Rerouted in milliseconds", text: "Leaves detect the dead links (BFD in ~150 ms) and remove that spine from their ECMP groups. Flows hash onto the remaining spines; capacity drops slightly but nothing disconnects." },
      { at: 45, severity: "info", title: "Replacement installed", text: "The switch is replaced, configuration is pushed automatically, and links come back up." },
      { at: 50, severity: "ok", title: "Spine back in service", text: "ECMP adds the spine back and traffic rebalances." },
    ],
  },
  {
    id: "fire",
    name: "Fire detected",
    summary: "An overheating component starts to smoulder. Detection escalates and the hall is flooded with clean agent.",
    duration: 125,
    zone: "hallA",
    layers: [],
    steps: [
      { at: 0, severity: "info", title: "Component overheating", text: "A failing power supply in rack A05-10 begins to smoulder, releasing tiny amounts of smoke long before any flame." },
      { at: 3, severity: "warning", title: "VESDA Alert", text: "The aspirating detector senses smoke at very low concentration (~0.005% obs/m). Staff are notified to investigate." },
      { at: 10, severity: "warning", title: "VESDA Action", text: "Smoke concentration rises. Operators locate the rack using the VESDA sector and CCTV." },
      { at: 16, severity: "critical", title: "Fire 1: second detector confirms", text: "A second, independent detector confirms the fire (\"double knock\"). The fire panel starts the release sequence." },
      { at: 22, severity: "critical", title: "Fire 2: pre-discharge alarm", text: "Sounders and red strobes warn everyone to leave. HVAC dampers close and doors shut so the gas can reach design concentration. A hold/abort button can pause the countdown." },
      { at: 52, severity: "critical", title: "Clean agent discharged", text: "Agent floods the hall within 10 seconds (halocarbon). It absorbs heat and stops combustion without leaving residue or harming electronics." },
      { at: 62, severity: "ok", title: "Fire extinguished", text: "Concentration is held for at least 10 minutes (compressed here) so the fire cannot re-ignite. The sprinkler pipes stay dry: water is the last resort." },
      { at: 100, severity: "info", title: "Ventilation", text: "Once the fire service confirms it is safe, the agent is extracted and fresh air restored. The damaged power supply is replaced." },
    ],
  },
  {
    id: "fiber-cut",
    name: "Fibre cut",
    summary: "Road works cut fibre route A. Traffic moves to the diverse route B.",
    duration: 70,
    zone: "fiber",
    layers: ["data"],
    steps: [
      { at: 0, severity: "info", title: "Two diverse routes", text: "Carrier fibre enters on two physically separate routes: north (A) and west (B)." },
      { at: 3, severity: "critical", title: "Route A cut", text: "An excavator cuts the north duct. Light is lost on every fibre in it." },
      { at: 3.05, severity: "warning", title: "Loss of light detected", text: "Optical protection and the routers detect the failure within milliseconds." },
      { at: 3.5, severity: "ok", title: "Traffic on route B", text: "Protection switching (~50 ms) and BGP move traffic onto route B. It enters from the west and runs overhead to the Meet-Me Room. Users notice nothing." },
      { at: 30, severity: "info", title: "Carrier repair crew", text: "The carrier locates the cut with an OTDR and splices the damaged cables." },
      { at: 60, severity: "ok", title: "Route A restored", text: "Both paths are live again, restoring full diversity." },
    ],
  },
];

export const scenarioById = (id: ScenarioId): ScenarioDef => {
  const s = SCENARIOS.find((d) => d.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
};

/** The step active at time t (the last one whose start has passed). */
export function currentStepIndex(def: ScenarioDef, t: number): number {
  let idx = 0;
  def.steps.forEach((s, i) => {
    if (t >= s.at) idx = i;
  });
  return idx;
}

/** Deterministic flicker pattern for failing lights. */
function flicker(t: number): number {
  const slot = Math.floor(t * 14);
  const r = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
  return r > 0.45 ? 1 : 0.15;
}

const BATTERY_RUNTIME_S = 300; // ~5 minutes at full load
/** Utility loss → generators carrying the load: within 10 s (NFPA 110 Type 10). */
const TRANSFER_S = 10;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Facility state at time t into a scenario. */
export function scenarioEffects(id: ScenarioId, t: number): ScenarioEffects {
  switch (id) {
    case "utility-loss": {
      const gridUp = t >= 40;
      const onGenerator = t >= TRANSFER_S && t < 60;
      const onBattery = t < TRANSFER_S;
      // Batteries drain while carrying the load, then recharge (slower) once power returns.
      const drained = Math.min(t, TRANSFER_S) / BATTERY_RUNTIME_S;
      const recharged = t > TRANSFER_S ? (t - TRANSFER_S) / (BATTERY_RUNTIME_S * 1.5) : 0;
      const batterySoc = clamp01(1 - drained + recharged);
      let generatorRpm = 0;
      if (t >= 2 && t < 9) generatorRpm = (t - 2) / 7;
      else if (t >= 9 && t < 62) generatorRpm = 1;
      else if (t >= 62 && t < 84) generatorRpm = 0.7; // cool-down, unloaded
      else if (t >= 84 && t < 87) generatorRpm = 0.7 * (1 - (t - 84) / 3);
      const lightFactor = t < 1.2 ? flicker(t) : t < TRANSFER_S ? 0.3 : 1;
      return { ...NORMAL_EFFECTS, gridUp, onBattery, batterySoc, generatorRpm, onGenerator, lightFactor };
    }
    case "crah-failure": {
      if (t < 3) return NORMAL_EFFECTS;
      const since = t - 3;
      // Local heating grows with thermal inertia (~20 s time constant), then decays after the repair.
      const repaired = t >= 125;
      const severity = repaired ? Math.exp(-(t - 125) / 8) * (1 - Math.exp(-122 / 20)) : 1 - Math.exp(-since / 20);
      const recovery = repaired ? 0 : clamp01((t - 30) / 20);
      return { ...NORMAL_EFFECTS, crahFailure: { index: 3, severity, recovery, unitFailed: !repaired } };
    }
    case "server-failure": {
      const failed = t >= 3 && t < 50;
      return { ...NORMAL_EFFECTS, failedServer: failed, rerouted: t >= 6 && t < 50, dropping: t >= 3 && t < 6 };
    }
    case "switch-failure": {
      const failed = t >= 3 && t < 50;
      return { ...NORMAL_EFFECTS, failedSpine: failed, rerouted: t >= 3.3 && t < 50, dropping: t >= 3 && t < 3.3 };
    }
    case "fiber-cut": {
      const cut = t >= 3 && t < 60;
      return { ...NORMAL_EFFECTS, fiberCut: cut, rerouted: t >= 3.5 && t < 60, dropping: t >= 3 && t < 3.5 };
    }
    case "fire": {
      let stage: FireStage = "none";
      if (t >= 100) stage = "ventilating";
      else if (t >= 62) stage = "extinguished";
      else if (t >= 52) stage = "discharge";
      else if (t >= 22) stage = "fire2";
      else if (t >= 16) stage = "fire1";
      else if (t >= 10) stage = "action";
      else if (t >= 3) stage = "alert";
      const countdown = stage === "fire2" ? Math.max(0, 52 - t) : null;
      const smoke = t < 52 ? clamp01(t / 30) : clamp01(1 - (t - 52) / 12);
      // Halocarbon reaches design concentration within 10 s, held, then extracted.
      const gas = t < 52 ? 0 : t < 100 ? clamp01((t - 52) / 10) : clamp01(1 - (t - 100) / 18);
      return { ...NORMAL_EFFECTS, fire: { stage, countdown, smoke, gas } };
    }
  }
}
