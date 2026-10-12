/**
 * Every kind of equipment the explorer knows about. Entries in data/equipment.ts
 * are keyed by these ids. Some ids are referenced (e.g. in `connectsTo`) before
 * their 3D model exists; they get catalogue entries as later phases add them.
 */
export type EquipmentTypeId =
  // Racks and rack-mounted devices
  | "rack"
  | "gpu-rack"
  | "network-rack"
  | "server-1u"
  | "server-2u"
  | "gpu-compute-tray"
  | "gpu-chip"
  | "grace-cpu"
  | "cold-plate"
  | "quick-disconnect"
  | "nic-card"
  | "nvlink-switch-tray"
  | "power-shelf"
  | "tor-switch"
  | "spine-switch"
  | "border-router"
  | "patch-panel"
  | "rack-pdu"
  | "blanking-panel"
  // Network infrastructure
  | "carrier-cage"
  | "cross-connect"
  | "fiber-entry"
  | "cable-tray"
  // Power chain
  | "power-line"
  | "substation"
  | "transformer"
  | "switchgear"
  | "ats"
  | "ups"
  | "battery-cabinet"
  | "generator"
  | "fuel-tank"
  | "rpp"
  | "busway"
  // Cooling
  | "crah"
  | "fan-wall"
  | "cdu"
  | "chiller"
  | "cooling-tower"
  | "dry-cooler"
  | "pump"
  | "chilled-water-pipe"
  | "cold-aisle-containment"
  | "raised-floor"
  // Fire safety
  | "vesda"
  | "gas-suppression"
  | "sprinkler"
  // Operations and security
  | "noc"
  | "video-wall"
  | "mantrap"
  | "badge-reader"
  | "biometric-scanner"
  | "cctv"
  | "security-fence"
  | "guard-house"
  // Site
  | "building"
  | "water-tank";

export type EquipmentCategory =
  | "compute"
  | "network"
  | "power"
  | "cooling"
  | "infrastructure"
  | "safety";

export interface SpecEntry {
  readonly label: string;
  readonly value: string;
}

export interface EquipmentInfo {
  readonly id: EquipmentTypeId;
  readonly name: string;
  readonly category: EquipmentCategory;
  /** One or two plain-language sentences. */
  readonly shortDescription: string;
  /** A paragraph for engineers. */
  readonly technicalDetails: string;
  readonly typicalSpecs: readonly SpecEntry[];
  readonly connectsTo: readonly EquipmentTypeId[];
  readonly funFact?: string;
}

/** Which rack face a device is mounted to. */
export type RackFace = "front" | "rear";

/** Devices that mount in rack units. */
export type RackMountKind =
  | "server-1u"
  | "server-2u"
  | "tor-switch"
  | "spine-switch"
  | "border-router"
  | "patch-panel"
  | "blanking-panel";

export type DeviceStatus = "ok" | "warning" | "fault";

/** A slot entry in a rack's configuration (authored data). */
export interface RackSlotConfig {
  readonly kind: RackMountKind;
  /** Lowest rack unit occupied (1 = bottom). */
  readonly u: number;
  /** Only needed for blanking panels, which come in 1U and 2U sizes. */
  readonly heightU?: number;
  /** Defaults to the kind's usual mounting face (see MOUNT_SPECS). */
  readonly face?: RackFace;
  readonly status?: DeviceStatus;
  readonly label?: string;
}

/** The two independent power feeds of a 2N-powered rack. */
export type PowerFeed = "A" | "B";
