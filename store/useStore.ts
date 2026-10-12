import { create } from "zustand";
import type { EquipmentTypeId } from "@/types/equipment";
import { TOUR } from "@/data/tour";
import { ZONES } from "@/data/zones";
import { simClock } from "@/lib/sim/clock";
import { type ScenarioId, scenarioById } from "@/lib/sim/scenarios";

export type CameraMode = "orbit" | "walk" | "tour";

/**
 * Rendering quality. Fixed, chosen by the user: switching levels on the fly
 * from the frame rate rebuilt the post-processing chain and flashed black.
 */
export type QualitySetting = "high" | "balanced" | "low";
export type QualityLevel = QualitySetting;

export interface LayerVisibility {
  cables: boolean;
  pipes: boolean;
  floorTiles: boolean;
  ceiling: boolean;
}

/** Something the user clicked: a specific object instance of an equipment type. */
export interface SelectionInfo {
  /** Unique instance id, e.g. "A-R03-07" or "GEN-02". */
  readonly id: string;
  readonly type: EquipmentTypeId;
  /** Human-readable instance name, e.g. "Generator 2". */
  readonly label: string;
}

/** Request scenarios for the data-flow simulation. */
export type DataScenario = "web" | "video" | "database" | "ai";

export interface SimLayers {
  data: boolean;
  power: boolean;
  airflow: boolean;
  heatmap: boolean;
}

export interface SimSettings {
  playing: boolean;
  /** Simulation speed multiplier (1 = real time). */
  speed: number;
  /** Overall compute / traffic load, 0..1. */
  load: number;
  /** Outdoor air temperature, °C (drives free cooling and fan power). */
  outsideC: number;
  scenario: DataScenario;
  layers: SimLayers;
}

/** A camera destination: where to stand and where to look. */
export interface CameraShot {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  /** Hide the roof and facade so the interior is visible. */
  readonly cutaway: boolean;
}

interface AppState {
  cameraMode: CameraMode;
  selected: SelectionInfo | null;
  hovered: SelectionInfo | null;
  rackDoorsOpen: boolean;
  /** X-ray view: roof and facade removed so every room is visible. */
  cutaway: boolean;
  layers: LayerVisibility;
  /** Pending camera flight; CameraRig consumes it and clears it. */
  flight: CameraShot | null;
  /** Name of the zone the camera last flew to (for the navigator highlight). */
  activeZone: string | null;
  /** True while the camera is inside the building footprint and below the roof. */
  cameraInside: boolean;
  /**
   * Interiors (and ceilings) are built the first time they are needed and then
   * kept, only hidden, so later visits don't rebuild hundreds of meshes.
   */
  interiorLoaded: boolean;
  ceilingsLoaded: boolean;
  sim: SimSettings;
  /** Running failure scenario, with the simulation time it started at. */
  scenario: { readonly id: ScenarioId; readonly startedAt: number } | null;
  /** GPU compute tray being serviced: pulled out on its rails, removed, or exploded. */
  trayService: TrayService | null;
  /** Current guided-tour stop and whether it auto-advances. */
  tour: { readonly index: number; readonly playing: boolean };
  /** Walk mode: the mouse is captured for looking around. */
  walkLocked: boolean;
  quality: QualitySetting;
  /** Level in use (always equal to `quality`; kept as the name renderers read). */
  qualityLevel: QualityLevel;
  soundOn: boolean;
  /** Loading progress, for the loading screen. */
  loadStage: "engine" | "assets" | "shaders" | "ready";

  setCameraMode: (mode: CameraMode) => void;
  select: (s: SelectionInfo | null) => void;
  hover: (s: SelectionInfo | null) => void;
  toggleRackDoors: () => void;
  setCutaway: (on: boolean) => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  flyTo: (shot: CameraShot, zone?: string) => void;
  clearFlight: () => void;
  setCameraInside: (inside: boolean) => void;
  setSim: (patch: Partial<Omit<SimSettings, "layers">>) => void;
  toggleSimLayer: (layer: keyof SimLayers) => void;
  startScenario: (id: ScenarioId) => void;
  stopScenario: () => void;
  openTray: (rackId: string, uStart: number) => void;
  setTrayExtension: (extension: number) => void;
  setTrayRemoved: (removed: boolean) => void;
  setTrayExploded: (exploded: boolean) => void;
  closeTray: () => void;
  startTour: () => void;
  goToTourStep: (index: number) => void;
  setTourPlaying: (playing: boolean) => void;
  exitTour: () => void;
  setWalkLocked: (locked: boolean) => void;
  setQuality: (q: QualitySetting) => void;
  setSoundOn: (on: boolean) => void;
  setLoadStage: (stage: AppState["loadStage"]) => void;
}

export interface TrayService {
  readonly rackId: string;
  readonly uStart: number;
  /** How far the tray is pulled out on its rails, m. */
  readonly extension: number;
  /** Lifted off the rails onto the service cart. */
  readonly removed: boolean;
  /** Cover and components separated for inspection. */
  readonly exploded: boolean;
}

export const useStore = create<AppState>()((set) => ({
  cameraMode: "orbit",
  selected: null,
  hovered: null,
  rackDoorsOpen: false,
  cutaway: false,
  layers: { cables: true, pipes: true, floorTiles: true, ceiling: true },
  flight: null,
  activeZone: "campus",
  cameraInside: false,
  interiorLoaded: false,
  ceilingsLoaded: false,
  sim: {
    playing: true,
    speed: 1,
    load: 0.6,
    outsideC: 18,
    scenario: "web",
    layers: { data: false, power: false, airflow: false, heatmap: false },
  },
  scenario: null,
  trayService: null,
  tour: { index: 0, playing: true },
  walkLocked: false,
  quality: "balanced",
  qualityLevel: "balanced",
  soundOn: false,
  loadStage: "engine",

  setCameraMode: (cameraMode) => set({ cameraMode }),
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  toggleRackDoors: () => set((s) => ({ rackDoorsOpen: !s.rackDoorsOpen })),
  setCutaway: (cutaway) => set({ cutaway }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  // Flights need orbit controls, so a zone jump leaves walk mode.
  flyTo: (flight, zone) =>
    set((s) => ({ flight, cutaway: flight.cutaway, activeZone: zone ?? null, cameraMode: s.cameraMode === "walk" ? "orbit" : s.cameraMode })),
  clearFlight: () => set({ flight: null }),
  setCameraInside: (cameraInside) => set({ cameraInside }),
  setSim: (patch) => set((s) => ({ sim: { ...s.sim, ...patch } })),
  toggleSimLayer: (layer) => set((s) => ({ sim: { ...s.sim, layers: { ...s.sim.layers, [layer]: !s.sim.layers[layer] } } })),
  // Starting a scenario turns on the overlays that explain it and flies the camera to where it happens.
  startScenario: (id) =>
    set((s) => {
      const def = scenarioById(id);
      const layers = { ...s.sim.layers };
      for (const l of def.layers) layers[l] = true;
      const zone = ZONES.find((z) => z.id === def.zone);
      return {
        scenario: { id, startedAt: simClock.time },
        sim: { ...s.sim, playing: true, layers },
        ...(zone ? { flight: zone.shot, cutaway: zone.shot.cutaway, activeZone: zone.id } : {}),
      };
    }),
  stopScenario: () => set({ scenario: null }),
  openTray: (rackId, uStart) => set({ trayService: { rackId, uStart, extension: 0, removed: false, exploded: false } }),
  setTrayExtension: (extension) => set((s) => (s.trayService ? { trayService: { ...s.trayService, extension } } : {})),
  setTrayRemoved: (removed) => set((s) => (s.trayService ? { trayService: { ...s.trayService, removed, exploded: removed && s.trayService.exploded } } : {})),
  setTrayExploded: (exploded) => set((s) => (s.trayService ? { trayService: { ...s.trayService, exploded } } : {})),
  closeTray: () => set({ trayService: null }),
  startTour: () => {
    set({ cameraMode: "tour", tour: { index: 0, playing: true }, scenario: null, trayService: null });
    useStore.getState().goToTourStep(0);
  },
  // Each tour stop flies the camera, sets exactly the overlays it explains, and highlights one object.
  goToTourStep: (index) =>
    set((s) => {
      const i = Math.max(0, Math.min(TOUR.length - 1, index));
      const step = TOUR[i];
      const layers: SimLayers = { data: false, power: false, airflow: false, heatmap: false, ...step.layers };
      return {
        tour: { ...s.tour, index: i },
        flight: step.shot,
        cutaway: step.shot.cutaway,
        activeZone: null,
        sim: { ...s.sim, playing: true, layers },
        selected: step.highlight ?? null,
      };
    }),
  setTourPlaying: (playing) => set((s) => ({ tour: { ...s.tour, playing } })),
  exitTour: () => set({ cameraMode: "orbit", selected: null }),
  setWalkLocked: (walkLocked) => set({ walkLocked }),
  setQuality: (quality) => set({ quality, qualityLevel: quality }),
  setSoundOn: (soundOn) => set({ soundOn }),
  setLoadStage: (loadStage) => set({ loadStage }),
}));

// Latch the "loaded" flags the first time interiors / ceilings become visible.
useStore.subscribe((s) => {
  const patch: Partial<AppState> = {};
  if (!s.interiorLoaded && (s.cutaway || s.cameraInside)) patch.interiorLoaded = true;
  if (!s.ceilingsLoaded && s.cameraInside) patch.ceilingsLoaded = true;
  if (Object.keys(patch).length) useStore.setState(patch);
});

/** Interior detail is only worth rendering when it can actually be seen. */
export const useInteriorVisible = (): boolean => useStore((s) => s.cutaway || s.cameraInside);
