import type { EquipmentTypeId } from "@/types/equipment";
import type { CameraShot, SimLayers } from "@/store/useStore";
import { ZONES } from "./zones";

export interface TourStep {
  readonly id: string;
  readonly title: string;
  /** Section of the facility, shown as a breadcrumb. */
  readonly section: "Arrival" | "Power" | "Cooling" | "White space" | "Network" | "Operations";
  readonly narration: string;
  readonly shot: CameraShot;
  /** Simulation overlays shown at this stop (others are switched off). */
  readonly layers: Partial<SimLayers>;
  /** Object highlighted (and described in the info panel) at this stop. */
  readonly highlight?: { readonly id: string; readonly type: EquipmentTypeId; readonly label: string };
  /** Seconds before auto-advancing. */
  readonly duration: number;
}

const zone = (id: string): CameraShot => {
  const z = ZONES.find((x) => x.id === id);
  if (!z) throw new Error(`Unknown zone ${id}`);
  return z.shot;
};

/**
 * The guided tour follows the facility in the order a visitor (and the
 * electricity, cold water and data) would meet it: arrive at the site, follow
 * power from the grid to the UPS, follow heat from the racks to the roof, walk
 * the data halls, then the network and the people who watch over it all.
 */
export const TOUR: readonly TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to the campus",
    section: "Arrival",
    narration:
      "This is a ~9-10 MW data centre: one building with an air-cooled hall of about 200 racks and an AI hall of 60 liquid-cooled GPU racks. Everything around it exists to keep those racks powered, cooled, connected and secure, 24 hours a day.",
    shot: zone("campus"),
    layers: {},
    highlight: { id: "building", type: "building", label: "Data centre building" },
    duration: 14,
  },
  {
    id: "security",
    title: "Layers of security",
    section: "Arrival",
    narration:
      "Security works in layers from the outside in. First comes the anti-climb fence, then crash-rated barriers at the gate and a guard house staffed around the clock. Every layer slows an intruder and buys the security team time to respond.",
    shot: zone("gate"),
    layers: {},
    highlight: { id: "main-gate", type: "security-fence", label: "Main vehicle gate" },
    duration: 13,
  },
  {
    id: "substation",
    title: "Power arrives from the grid",
    section: "Power",
    narration:
      "Electricity arrives on a 132 kV overhead line. The substation steps it down to 33 kV, and underground cables carry it to transformers beside the building. Watch the cyan pulses: there are two completely separate paths, A and B.",
    shot: zone("substation"),
    layers: { power: true },
    highlight: { id: "substation", type: "substation", label: "Utility substation" },
    duration: 14,
  },
  {
    id: "generators",
    title: "Backup generators",
    section: "Power",
    narration:
      "If the grid fails, eight 2.5 MW diesel generators start automatically and take over within about 10 seconds. Each sits on its own fuel tank, and the bulk tanks hold enough diesel for a day or two of running.",
    shot: zone("generators"),
    layers: { power: true },
    highlight: { id: "GEN-01", type: "generator", label: "Diesel generator GEN-01" },
    duration: 13,
  },
  {
    id: "electrical",
    title: "Switchgear, ATS and UPS",
    section: "Power",
    narration:
      "Inside, each power path has its own electrical room. The automatic transfer switch picks utility or generator, the switchboard distributes the power, and double-conversion UPS modules clean it up. A and B never share a room, so one fire cannot take out both.",
    shot: zone("elec"),
    layers: { power: true },
    highlight: { id: "UPS-A1", type: "ups", label: "UPS module UPS-A1 (feed A)" },
    duration: 15,
  },
  {
    id: "batteries",
    title: "The battery bridge",
    section: "Power",
    narration:
      "Lithium-ion battery cabinets keep the UPS running for about five minutes. That's far longer than the seconds it takes the generators to start, so the servers never notice a power cut.",
    shot: zone("battery"),
    layers: { power: true },
    highlight: { id: "BAT-A1-07", type: "battery-cabinet", label: "Li-ion battery cabinet" },
    duration: 12,
  },
  {
    id: "lobby",
    title: "Entering the building",
    section: "Arrival",
    narration:
      "People enter through the lobby. Visitors are checked at the security desk, then pass speed gates and a mantrap, an airlock with two doors that never open together. A biometric scan adds a second factor to the badge.",
    shot: zone("lobby"),
    layers: {},
    highlight: { id: "mantrap", type: "mantrap", label: "Mantrap" },
    duration: 13,
  },
  {
    id: "hallA",
    title: "Data Hall A: air cooling",
    section: "White space",
    narration:
      "Racks stand in rows with their fronts facing each other across cold aisles. Air handlers along the walls push chilled air under the raised floor, and it rises through perforated tiles. The particles show it passing through the servers and returning hot.",
    shot: zone("hallA"),
    layers: { airflow: true },
    highlight: { id: "CRAH-A4", type: "crah", label: "CRAH unit CRAH-A4" },
    duration: 15,
  },
  {
    id: "cold-aisle",
    title: "Inside a contained cold aisle",
    section: "White space",
    narration:
      "Doors and a glass roof seal the cold aisle, so cold supply air can only go through the servers. Blanking panels fill empty slots for the same reason. Keeping hot and cold air apart lets the cooling run warmer and use far less energy.",
    shot: zone("cold-aisle"),
    layers: { airflow: true },
    highlight: { id: "hallA-cac-1", type: "cold-aisle-containment", label: "Cold aisle containment, pod 1" },
    duration: 13,
  },
  {
    id: "heat",
    title: "Where the heat goes",
    section: "Cooling",
    narration:
      "The heat map shows rack inlet and exhaust temperatures: blue cold aisles, warm hot aisles. Server inlets should stay within ASHRAE's recommended range of 18 to 27 °C. Racks at the ends of rows run a little warmer, where containment leaks most.",
    shot: zone("hallA"),
    layers: { heatmap: true },
    duration: 13,
  },
  {
    id: "cooling-plant",
    title: "The cooling plant",
    section: "Cooling",
    narration:
      "Chillers make the cold water for the air handlers, and pumps push it round in blue supply and red return pipes. When it's cold outside, a heat exchanger and the rooftop dry coolers make chilled water without running the compressors at all. That's called free cooling.",
    shot: zone("cooling"),
    layers: {},
    highlight: { id: "CH-1", type: "chiller", label: "Water-cooled chiller CH-1" },
    duration: 15,
  },
  {
    id: "rooftop",
    title: "Rejecting heat to the sky",
    section: "Cooling",
    narration:
      "On the roof, cooling towers and dry coolers finally hand the heat to the outside air. Their fans speed up as the load rises. Every watt the servers use ends up here as heat.",
    shot: zone("rooftop"),
    layers: {},
    highlight: { id: "CT-1", type: "cooling-tower", label: "Cooling tower CT-1" },
    duration: 12,
  },
  {
    id: "hallB",
    title: "Data Hall B: the AI hall",
    section: "White space",
    narration:
      "Each of these racks holds 72 NVIDIA Blackwell GPUs and draws around 130 kW, more than 15 normal racks put together. Air alone can't cool that, so about 85% of the heat leaves through liquid. Fan walls handle the rest.",
    shot: zone("hallB"),
    layers: {},
    highlight: { id: "B03-05", type: "gpu-rack", label: "GPU rack B03-05 (NVL72)" },
    duration: 14,
  },
  {
    id: "gpu-rack",
    title: "Inside an NVL72 rack",
    section: "White space",
    narration:
      "Eighteen compute trays (4 GPUs and 2 Grace CPUs each) sandwich nine NVLink switch trays, so all 72 GPUs act as one giant GPU. Click any tray, then 'Pull out & service this tray' to slide it out and look inside.",
    shot: zone("gpu-rack"),
    layers: {},
    duration: 15,
  },
  {
    id: "gpu-rear",
    title: "Liquid cooling up close",
    section: "Cooling",
    narration:
      "At the back, blue and red manifolds feed every tray through dripless quick-disconnects. The copper bundles are the NVLink spine: about 5,000 cables. In-row coolant distribution units (CDUs) pump the rack loop and pass the heat to the building's water.",
    shot: zone("gpu-rear"),
    layers: {},
    highlight: { id: "CDU-B01-1", type: "cdu", label: "Coolant distribution unit CDU-B01-1" },
    duration: 14,
  },
  {
    id: "network",
    title: "From the internet to a server",
    section: "Network",
    narration:
      "Follow the green packets. They arrive on carrier fibre through the north vault, cross-connect in the Meet-Me Room, and pass a border router and a spine switch. Overhead fibre then carries them to the rack's leaf switch and the server. Inside the building every hop takes microseconds.",
    shot: zone("core"),
    layers: { data: true },
    highlight: { id: "mmr-odf", type: "cross-connect", label: "Cross-connect frames (ODF)" },
    duration: 16,
  },
  {
    id: "fire",
    title: "Fire protection",
    section: "Operations",
    narration:
      "Aspirating smoke detectors sniff the air constantly. If a fire is confirmed, clean-agent gas floods the hall within 10 seconds without harming the electronics. Sprinkler pipes stay dry: water is the last resort.",
    shot: zone("fire"),
    layers: {},
    highlight: { id: "FS-BANK-A", type: "gas-suppression", label: "Clean-agent cylinder bank (Hall A)" },
    duration: 13,
  },
  {
    id: "noc",
    title: "The people who keep it running",
    section: "Operations",
    narration:
      "The Network Operations Center watches everything live: power, PUE, temperatures, traffic and alarms. Try the Scenarios menu to see how the facility rides through a power cut, a cooling failure, a fire or a fibre cut. Thanks for taking the tour!",
    shot: zone("noc"),
    layers: {},
    highlight: { id: "noc-video-wall", type: "video-wall", label: "NOC video wall" },
    duration: 16,
  },
];
