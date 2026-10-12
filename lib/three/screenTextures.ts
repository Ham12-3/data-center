import * as THREE from "three";
import { HALL_A_RACKS } from "@/data/halls";
import { hash01 } from "@/lib/random";
import { live } from "@/lib/sim/live";
import { ASHRAE_MAX_INLET_C, type FacilityMetrics, heatColor } from "@/lib/sim/model";
import { scenarioById } from "@/lib/sim/scenarios";

/**
 * Canvas textures for NOC screens: operations dashboards drawn from the live
 * simulation (power, PUE, thermal map, network, alerts). `refreshScreens()`
 * redraws every screen in place; the same textures are shared by every mesh.
 */

export type ScreenKind = "power" | "thermal" | "network" | "alerts" | "pue" | "floorplan" | "cctv";

const W = 512;
const H = 288;
const HISTORY = 90;

const screens = new Map<ScreenKind, { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }>();
const history = { power: [] as number[], it: [] as number[], fabric: [] as number[], internet: [] as number[] };

const mw = (kw: number) => (kw >= 1000 ? `${(kw / 1000).toFixed(2)} MW` : `${Math.round(kw)} kW`);

function base(ctx: CanvasRenderingContext2D, title: string, ok = true): void {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#13203a";
  ctx.fillRect(0, 0, W, 30);
  ctx.fillStyle = "#93c5fd";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, 12, 21);
  ctx.fillStyle = ok ? "#3dff6e" : "#ffb020";
  ctx.beginPath();
  ctx.arc(W - 18, 15, 5, 0, Math.PI * 2);
  ctx.fill();
}

/** Line chart of a history series, auto-scaled with a little headroom. */
function chart(ctx: CanvasRenderingContext2D, series: number[], x: number, y: number, w: number, h: number, color: string, max?: number): void {
  ctx.strokeStyle = "#1e2d4a";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / 4);
    ctx.lineTo(x + w, y + (h * i) / 4);
    ctx.stroke();
  }
  if (series.length < 2) return;
  const top = (max ?? Math.max(...series)) * 1.15 || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  series.forEach((v, i) => {
    const px = x + (w * i) / (HISTORY - 1);
    const py = y + h * (1 - v / top);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function alertsOf(m: FacilityMetrics): [string, string][] {
  const rows: [string, string][] = [];
  // The running scenario's current step goes to the top of the list.
  const sc = live.scenario;
  if (sc) {
    const def = scenarioById(sc.id);
    const step = def.steps[Math.min(sc.step, def.steps.length - 1)];
    const color = { critical: "#ff3b30", warning: "#ffb020", info: "#38bdf8", ok: "#3dff6e" }[step.severity];
    rows.push([color, `${step.severity.toUpperCase().padEnd(5)} ${step.title}`]);
  }
  for (const r of HALL_A_RACKS) {
    for (const s of r.slots ?? []) {
      if (s.status === "fault") rows.push(["#ff3b30", `CRIT  ${r.id} U${s.u}  server offline`]);
      else if (s.status === "warning") rows.push(["#ffb020", `WARN  ${r.id} U${s.u}  server health degraded`]);
    }
  }
  const hot = [...m.racks.values()].filter((r) => r.inletC > ASHRAE_MAX_INLET_C).sort((a, b) => b.inletC - a.inletC);
  for (const r of hot.slice(0, 3)) rows.unshift(["#ffb020", `WARN  ${r.id}  inlet ${r.inletC.toFixed(1)} °C > 27 °C`]);
  rows.push(["#38bdf8", `INFO  PUE ${m.pue.toFixed(2)} · free cooling ${Math.round(m.freeCoolingFraction * 100)}%`]);
  rows.push(["#3dff6e", "OK    UPS-A / UPS-B online, batteries 100%"]);
  return rows;
}

const DRAW: Record<ScreenKind, (ctx: CanvasRenderingContext2D, m: FacilityMetrics) => void> = {
  power: (ctx, m) => {
    base(ctx, "FACILITY POWER");
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(mw(m.totalKw), 16, 86);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`IT ${mw(m.itKw.total)}  ·  Feed A ${mw(m.feedKw.A)}  ·  Feed B ${mw(m.feedKw.B)}`, 16, 112);
    chart(ctx, history.power, 16, 130, W - 32, H - 150, "#22d3ee");
    chart(ctx, history.it, 16, 130, W - 32, H - 150, "#3dff6e", Math.max(...history.power, 1));
  },
  thermal: (ctx, m) => {
    base(ctx, "HALL A · RACK INLET TEMPERATURE", m.maxInletC <= ASHRAE_MAX_INLET_C);
    const rows = 10;
    const cols = 20;
    const cw = (W - 32) / cols;
    const ch = (H - 60) / rows;
    HALL_A_RACKS.forEach((r, n) => {
      const row = Math.floor(n / cols);
      const col = n % cols;
      const st = m.racks.get(r.id);
      const [cr, cg, cb] = heatColor(st?.inletC ?? 20, 18, 32);
      ctx.fillStyle = `rgb(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)})`;
      ctx.fillRect(16 + col * cw + 1, 44 + row * ch + 1, cw - 2, ch - 2);
    });
  },
  network: (ctx, m) => {
    base(ctx, "NETWORK THROUGHPUT");
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(`${m.fabricTbps.toFixed(0)} Tb/s`, 16, 82);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`fabric (east-west)  ·  internet ${m.internetGbps.toFixed(0)} Gb/s`, 210, 80);
    chart(ctx, history.fabric, 16, 100, W - 32, H - 120, "#3dff6e");
  },
  alerts: (ctx, m) => {
    const rows = alertsOf(m);
    base(ctx, `ACTIVE ALERTS (${rows.length})`, !rows.some(([c]) => c === "#ff3b30"));
    ctx.font = "15px monospace";
    rows.slice(0, 7).forEach(([c, t], i) => {
      ctx.fillStyle = c;
      ctx.fillRect(14, 42 + i * 34, 6, 22);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(t, 30, 59 + i * 34);
    });
  },
  pue: (ctx, m) => {
    base(ctx, "PUE (TOTAL ÷ IT POWER)");
    const cx = W / 2;
    const cy = H * 0.72;
    const r = Math.min(W, H) * 0.36;
    // Gauge spans PUE 1.0 (left) to 2.0 (right).
    const frac = Math.min(1, Math.max(0, m.pue - 1));
    ctx.lineWidth = 18;
    ctx.strokeStyle = "#1e2d4a";
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = m.pue < 1.3 ? "#3dff6e" : m.pue < 1.6 ? "#ffb020" : "#ff3b30";
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * frac);
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(m.pue.toFixed(2), cx, cy - 6);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("industry average ≈ 1.56 · hyperscale ≈ 1.1", cx, cy + 24);
    ctx.textAlign = "left";
  },
  floorplan: (ctx, m) => {
    base(ctx, "FACILITY OVERVIEW");
    ctx.font = "15px sans-serif";
    const lines: [string, string][] = [
      ["Hall A (air)", `${mw(m.itKw.hallA)} · inlet avg ${m.avgInletC.toFixed(1)} °C`],
      ["Hall B (AI / liquid)", mw(m.itKw.hallB)],
      ["Cooling", `${mw(m.coolingKw.total)} · fans ${Math.round(m.fanSpeed * 100)}%`],
      ["Chillers", mw(m.coolingKw.chillers)],
      ["UPS losses", mw(m.upsLossKw)],
      ["Generators", "standby, 8 × 2.5 MW ready"],
    ];
    lines.forEach(([k, v], i) => {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(k, 20, 62 + i * 36);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(v, 200, 62 + i * 36);
    });
  },
  cctv: (ctx) => {
    base(ctx, "CCTV · 16 CAMERAS");
    const cols = 4;
    const rows = 3;
    const cw = (W - 20) / cols;
    const ch = (H - 40) / rows;
    for (let i = 0; i < cols * rows; i++) {
      const x = 10 + (i % cols) * cw;
      const y = 34 + Math.floor(i / cols) * ch;
      const g = 40 + Math.round(hash01("cam", i) * 40);
      ctx.fillStyle = `rgb(${g},${g + 4},${g + 8})`;
      ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x + 6, y + 6, 5, 5);
    }
  },
};

export function screenTexture(kind: ScreenKind): THREE.CanvasTexture {
  let s = screens.get(kind);
  if (!s) {
    const el = document.createElement("canvas");
    el.width = W;
    el.height = H;
    const ctx = el.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    DRAW[kind](ctx, live.metrics);
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    s = { ctx, tex };
    screens.set(kind, s);
  }
  return s.tex;
}

/** Append the latest metrics to the chart history and redraw every screen. */
export function refreshScreens(m: FacilityMetrics): void {
  const push = (arr: number[], v: number) => {
    arr.push(v);
    if (arr.length > HISTORY) arr.shift();
  };
  push(history.power, m.totalKw);
  push(history.it, m.itKw.total);
  push(history.fabric, m.fabricTbps);
  push(history.internet, m.internetGbps);
  for (const [kind, s] of screens) {
    DRAW[kind](s.ctx, m);
    s.tex.needsUpdate = true;
  }
}

const matCache = new Map<ScreenKind, THREE.MeshBasicMaterial>();

/** Unlit screen material: screens emit their own light. */
export function screenMaterial(kind: ScreenKind): THREE.MeshBasicMaterial {
  let m = matCache.get(kind);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: screenTexture(kind), toneMapped: false });
    matCache.set(kind, m);
  }
  return m;
}
