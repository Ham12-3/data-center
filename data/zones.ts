import type { CameraShot } from "@/store/useStore";

export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly group: "Site" | "Building" | "Close-ups";
  readonly blurb: string;
  readonly shot: CameraShot;
}

const out = (position: [number, number, number], target: [number, number, number]): CameraShot => ({ position, target, cutaway: false });
const inside = (position: [number, number, number], target: [number, number, number]): CameraShot => ({ position, target, cutaway: true });

/**
 * Camera destinations, ordered roughly as a visitor (and the electricity)
 * would encounter them: the site, then the building, then close-ups.
 */
export const ZONES: readonly Zone[] = [
  { id: "campus", name: "Campus overview", group: "Site", blurb: "The whole site from the air.", shot: out([150, 105, 175], [5, 0, 0]) },
  { id: "substation", name: "Utility substation", group: "Site", blurb: "Grid power arrives at 132 kV and is stepped down.", shot: out([128, 42, -12], [84, 3, -64]) },
  { id: "generators", name: "Generator yard", group: "Site", blurb: "Diesel generators and fuel for when the grid fails.", shot: out([112, 30, 34], [66, 2, -6]) },
  { id: "rooftop", name: "Rooftop cooling", group: "Site", blurb: "Cooling towers and dry coolers reject the heat.", shot: out([28, 48, 58], [-12, 11, -4]) },
  { id: "gate", name: "Security gate", group: "Site", blurb: "Fence, crash barriers and the guard house.", shot: out([-4, 16, 108], [-22, 1, 78]) },
  { id: "fiber", name: "Fibre entry points", group: "Site", blurb: "Two separate fibre routes enter the building.", shot: out([-70, 32, -70], [-28, 0, -32]) },

  { id: "overview-xray", name: "Building X-ray", group: "Building", blurb: "Roof removed: every room at once.", shot: inside([0, 85, 72], [0, 0, 0]) },
  { id: "lobby", name: "Lobby & security", group: "Building", blurb: "Mantrap, badge readers and biometrics.", shot: inside([-16, 13, 38], [-16, 0.5, 16]) },
  { id: "hallA", name: "Data Hall A", group: "Building", blurb: "Air-cooled racks on a raised floor.", shot: inside([-24, 26, 24], [-24, 0, -11]) },
  { id: "hallB", name: "Data Hall B (AI)", group: "Building", blurb: "Liquid-cooled GPU racks and CDUs.", shot: inside([24, 24, 22], [24, 0, -11]) },
  { id: "cooling", name: "Cooling plant", group: "Building", blurb: "Chillers, pumps and heat exchangers.", shot: inside([-32, 15, 38], [-32, 0.5, 16]) },
  { id: "elec", name: "Electrical rooms A & B", group: "Building", blurb: "Switchgear, transfer switches and UPS.", shot: inside([28, 17, 40], [28, 0.5, 16]) },
  { id: "battery", name: "Battery room", group: "Building", blurb: "Lithium-ion cabinets bridge the gap to generators.", shot: inside([9, 13, 37], [9, 0.5, 16]) },
  { id: "noc", name: "Network Operations Center", group: "Building", blurb: "Where operators watch everything 24/7.", shot: inside([-3.5, 4.5, 24], [-3.5, 2.2, 8.5]) },
  { id: "mmr", name: "Meet-Me Room", group: "Building", blurb: "Carriers hand off to the data centre here.", shot: inside([0, 14, -4], [0, 0.5, -20]) },
  { id: "core", name: "Network core", group: "Building", blurb: "Spine switches and border routers.", shot: inside([0, 11, 3], [0, 0.5, -10]) },
  { id: "fire", name: "Fire suppression", group: "Building", blurb: "Clean-agent gas cylinders and controls.", shot: inside([0, 9, 11], [0, 0.5, 0]) },

  { id: "cold-aisle", name: "Inside a cold aisle", group: "Close-ups", blurb: "Contained cold aisle between two rows of racks.", shot: inside([-34.5, 2.3, -21.5], [-34.5, 1.5, -6]) },
  { id: "gpu-rack", name: "GPU rack (NVL72)", group: "Close-ups", blurb: "72 GPUs in one liquid-cooled rack.", shot: inside([13.2, 1.75, -10.0], [15.2, 1.15, -11.5]) },
  { id: "gpu-rear", name: "GPU rack rear (manifolds)", group: "Close-ups", blurb: "Coolant manifolds, NVLink spine and busbar.", shot: inside([17.45, 1.7, -9.6], [16.1, 1.2, -11.5]) },
  { id: "cdu", name: "Coolant distribution unit", group: "Close-ups", blurb: "Pumps and heat exchanger for the liquid loop.", shot: inside([13.2, 2.0, -15.4], [15.3, 1.0, -13.4]) },
  { id: "crah", name: "CRAH units", group: "Close-ups", blurb: "Computer-room air handlers along the wall.", shot: inside([-27.3, 3.4, -18.5], [-27.3, 1.8, -24.8]) },
];
