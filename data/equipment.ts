import type { EquipmentInfo, EquipmentTypeId } from "@/types/equipment";
import { FACILITY_EQUIPMENT, type RackEntryId } from "./equipmentFacility";

/**
 * Educational content for rack-level equipment. Facility equipment (power,
 * cooling, network, safety, site) lives in data/equipmentFacility.ts; the two
 * are combined below into a catalogue that TypeScript checks is complete.
 */
const RACK_EQUIPMENT: Record<RackEntryId, EquipmentInfo> = {
  rack: {
    id: "rack",
    name: "Server Rack (42U)",
    category: "infrastructure",
    shortDescription:
      "A steel cabinet that holds servers, switches and power strips in a standard stack. Every device bolts onto the same 19-inch-wide rails.",
    technicalDetails:
      "Racks follow the EIA-310 standard: mounting rails 19 in (482.6 mm) apart across the flanges, with height measured in rack units (1U = 1.75 in / 44.45 mm). A 42U rack offers about 1.87 m of mounting space. Perforated front and rear doors (typically 60-80% open area) let cold air in at the front and hot exhaust out at the back. Racks are lined up in rows so all fronts face a shared cold aisle and all backs face a hot aisle. Average air-cooled enterprise racks draw roughly 5-15 kW, while AI/GPU racks with liquid cooling can exceed 100 kW.",
    typicalSpecs: [
      { label: "Height", value: "42U (2000 mm external)" },
      { label: "Footprint", value: "600 x 1200 mm (W x D)" },
      { label: "Rail standard", value: "EIA-310, 19-inch" },
      { label: "Static load rating", value: "1000-1500 kg" },
      { label: "Typical power", value: "5-15 kW air-cooled" },
      { label: "Door perforation", value: "60-80% open area" },
    ],
    connectsTo: ["server-1u", "tor-switch", "rack-pdu", "blanking-panel", "cold-aisle-containment"],
    funFact:
      "The 19-inch width dates back to telephone relay racks of the early 1900s. Data centres simply never changed it.",
  },

  "server-1u": {
    id: "server-1u",
    name: "1U Rack Server",
    category: "compute",
    shortDescription:
      "A thin, powerful computer that runs applications and websites. It is just 1.75 inches tall, so dozens fit in one rack.",
    technicalDetails:
      "A typical 1U server has two CPU sockets, 16-32 memory slots and up to ten 2.5-inch NVMe or SAS drives at the front. Air is pulled in through the front by a row of high-speed fans and pushed out the back, which is why racks face a cold aisle at the front. Two hot-swap power supplies plug into different PDUs (A and B feeds), so the server keeps running if either power path fails. A baseboard management controller (BMC, e.g. iDRAC, iLO or any Redfish/IPMI device) lets operators monitor and power-cycle it remotely, even when the operating system has crashed.",
    typicalSpecs: [
      { label: "CPUs", value: "2 sockets, 32-128 cores each" },
      { label: "Memory", value: "256 GB - 2 TB DDR5" },
      { label: "Storage", value: "Up to 10 x 2.5\" NVMe/SAS" },
      { label: "Network", value: "2 x 25 GbE (dual-homed)" },
      { label: "Power supplies", value: "2 x 800-1400 W, hot-swap, redundant (1+1)" },
      { label: "Typical draw", value: "250-600 W" },
      { label: "Airflow", value: "Front to back" },
    ],
    connectsTo: ["tor-switch", "rack-pdu"],
    funFact:
      "1U server fans can spin faster than 20,000 RPM. That is why a server hall is loud enough that staff often wear ear protection.",
  },

  "server-2u": {
    id: "server-2u",
    name: "2U Rack Server",
    category: "compute",
    shortDescription:
      "A taller server with room for more disks, expansion cards or GPUs. It takes two rack units.",
    technicalDetails:
      "The extra height allows larger, slower and quieter fans, up to twelve 3.5-inch or twenty-four 2.5-inch drives, and full-height PCIe cards such as GPUs, accelerators or additional NICs. 2U chassis are popular for storage nodes (software-defined storage like Ceph), virtualisation hosts and databases. They have the same dual redundant power supplies and dual network uplinks as 1U servers, and the same front-to-back airflow.",
    typicalSpecs: [
      { label: "CPUs", value: "2 sockets" },
      { label: "Storage", value: "12 x 3.5\" or 24 x 2.5\"" },
      { label: "Expansion", value: "Up to 8 PCIe slots / 2-4 double-width GPUs" },
      { label: "Power supplies", value: "2 x 1100-2400 W, redundant" },
      { label: "Typical draw", value: "400-1200 W (more with GPUs)" },
    ],
    connectsTo: ["tor-switch", "rack-pdu"],
  },

  "tor-switch": {
    id: "tor-switch",
    name: "Top-of-Rack (Leaf) Switch",
    category: "network",
    shortDescription:
      "The rack's network hub. Every server plugs into it, and it connects the whole rack to the rest of the data centre.",
    technicalDetails:
      "In a leaf-spine (Clos) network, each rack has one or two leaf switches. Every leaf connects to every spine switch, so any two servers are always the same number of hops apart and bandwidth scales by adding spines. A common leaf offers 48 x 25 GbE server ports and 8 x 100 GbE uplinks: 1.2 Tb/s down and 800 Gb/s up, an oversubscription ratio of 1.5:1. Racks usually have two leaves (paired with MLAG or EVPN multihoming) with each server cabled to both, so a switch can fail or be upgraded without disconnecting anything. ToR switches are often mounted at the rear, ports facing the server NICs, with \"port-side exhaust\" fans so airflow still runs cold aisle to hot aisle.",
    typicalSpecs: [
      { label: "Access ports", value: "48 x 25 GbE SFP28" },
      { label: "Uplinks", value: "8 x 100 GbE QSFP28" },
      { label: "Switching capacity", value: "4.0 Tb/s (full duplex)" },
      { label: "Latency", value: "~0.5-1 µs port to port" },
      { label: "Power", value: "150-350 W, 1+1 PSU, N+1 fans" },
      { label: "Redundancy", value: "Deployed in pairs (MLAG / EVPN-MH)" },
    ],
    connectsTo: ["server-1u", "server-2u", "patch-panel", "spine-switch", "rack-pdu"],
    funFact:
      "A packet can cross a modern leaf switch in under a microsecond. In that time light travels only about 200 metres through fibre.",
  },

  "patch-panel": {
    id: "patch-panel",
    name: "Fibre Patch Panel",
    category: "network",
    shortDescription:
      "A tidy connection point where the rack's short cables meet the permanent fibre running to the network core.",
    technicalDetails:
      "Structured cabling (TIA-942 / TIA-568) separates permanent trunk cabling, laid in overhead trays to the network row, from short patch cords inside the rack. That way moves and changes never disturb the trunks. This 1U panel holds 24 LC duplex adapters (48 fibres). Blue adapters indicate single-mode fibre with UPC polish. Single-mode fibre has a yellow jacket and is used for long runs, while multimode uses aqua (OM3/OM4) or lime (OM5). Each mated connector pair adds roughly 0.2-0.5 dB of loss (TIA allows up to 0.75 dB), which is why link budgets limit how many patch points a path can have.",
    typicalSpecs: [
      { label: "Height", value: "1U" },
      { label: "Ports", value: "24 x LC duplex (48 fibres)" },
      { label: "Fibre type", value: "Single-mode OS2 (blue adapters)" },
      { label: "Insertion loss", value: "≤0.75 dB per mated pair" },
      { label: "Power", value: "None (passive)" },
    ],
    connectsTo: ["tor-switch", "spine-switch", "cross-connect"],
  },

  "rack-pdu": {
    id: "rack-pdu",
    name: "Rack PDU (A or B feed)",
    category: "power",
    shortDescription:
      "A tall, smart power strip. Each rack has two, one on the A feed and one on the B feed, so every server gets power from two independent sources.",
    technicalDetails:
      "Vertical \"zero-U\" PDUs mount in the rear corners without using rack space. Each is fed from a separate upstream path (A: UPS-A → PDU-A, B: UPS-B → PDU-B). Every server plugs one power supply into each. To survive the loss of a whole feed, each PDU must be loaded below 50% of its rating in normal operation, so that one side can carry the full rack alone. That is the essence of 2N power. Intelligent PDUs meter current per phase or per outlet, report over SNMP/Redfish, and switched models can power-cycle individual outlets remotely. Outlets are IEC C13 (up to 10 A, for servers) and C19 (16 A, for high-power devices).",
    typicalSpecs: [
      { label: "Input", value: "3-phase 400 V 32 A (≈22 kW) or 208 V 30 A (≈8.6 kW)" },
      { label: "Outlets", value: "36 x C13 + 6 x C19" },
      { label: "Monitoring", value: "Per-phase or per-outlet metering" },
      { label: "Mounting", value: "Zero-U, vertical, rear of rack" },
      { label: "Loading rule", value: "Keep each feed < 50% so either can carry 100%" },
    ],
    connectsTo: ["server-1u", "server-2u", "tor-switch", "rpp"],
    funFact:
      "Switched PDUs let an engineer on another continent power-cycle a frozen server. It is \"turn it off and on again\" done remotely.",
  },

  "blanking-panel": {
    id: "blanking-panel",
    name: "Blanking Panel",
    category: "cooling",
    shortDescription:
      "A plain plate that covers empty slots in a rack. It stops hot exhaust air leaking back to the front where servers breathe in.",
    technicalDetails:
      "Servers pull air from the front and exhaust it at the rear. An open U space is a short circuit: hot rear air is drawn through the gap and re-ingested, raising inlet temperatures by several degrees and forcing cooling to work harder. Blanking panels, together with aisle containment, keep server inlets within the ASHRAE recommended range of 18-27 °C. Tool-less snap-in panels make them quick to fit, and data-centre audits routinely check for missing blanks.",
    typicalSpecs: [
      { label: "Sizes", value: "1U, 2U (snap-in or screw-mount)" },
      { label: "Material", value: "ABS plastic or steel" },
      { label: "Purpose", value: "Prevent hot-air recirculation" },
    ],
    connectsTo: ["rack", "cold-aisle-containment"],
    funFact:
      "Blanking panels are often called the cheapest efficiency upgrade in a data centre. They cost a few dollars each and can noticeably lower cooling energy.",
  },
};

/** Every equipment type, with a description. Missing an entry is a type error. */
export const EQUIPMENT: Record<EquipmentTypeId, EquipmentInfo> = { ...RACK_EQUIPMENT, ...FACILITY_EQUIPMENT };

export function getEquipmentInfo(id: EquipmentTypeId): EquipmentInfo {
  return EQUIPMENT[id];
}
