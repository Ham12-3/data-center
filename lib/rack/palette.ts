/** Colours for rack hardware. Kept in one place so the scene stays consistent. */

export const LED_COLORS = {
  green: "#3dff6e",
  amber: "#ffb020",
  red: "#ff3b30",
  blue: "#4aa3ff",
} as const;

export const HARDWARE_COLORS = {
  rackFrame: "#2c3036",
  rail: "#8b929b",
  chassisLid: "#9aa1aa",
  bezel: "#262a31",
  ear: "#2b2f36",
  driveCaddy: "#2e333b",
  driveCaddyLight: "#454b55",
  rearPlate: "#3a3e46",
  psu: "#3b4048",
  inlet: "#0e0f11",
  portCage: "#0c0d0f",
  switchBody: "#2c3036",
  switchFace: "#16181b",
  fanModule: "#30343b",
  blanking: "#1f2226",
  patchFace: "#1b1d21",
  lcAdapterSM: "#2f6fe0", // blue LC adapter = single-mode UPC polish
  pduBody: "#2c2f35",
  outletC13: "#0b0b0c",
} as const;

/** Physical cable jacket colours. Fibre is yellow (single-mode, OS2). */
export const CABLE_COLORS = {
  powerA: "#16181c",
  powerB: "#9aa1ab",
  copper: "#a78bfa",
  fiber: "#facc15",
} as const;

/** Accent colours used to label the A and B power feeds. */
export const FEED_COLORS = {
  A: "#3b82f6",
  B: "#f97316",
} as const;
