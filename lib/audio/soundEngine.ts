/**
 * Procedural ambient sound, synthesised with the Web Audio API (no audio
 * files). Each layer is a small node graph whose gain (and some filter /
 * pitch parameters) is steered smoothly by `update()` from the simulation
 * and the camera's location.
 */

export interface SoundParams {
  /** Server-hall ambience: fans and airflow (0..1). */
  hall: number;
  /** Electrical hum: transformers, UPS, switchgear (0..1). */
  hum: number;
  /** Mechanical plant: pumps, chillers, rooftop fans (0..1). */
  plant: number;
  /** Outdoor wind (0..1). */
  outdoor: number;
  /** Cooling / server fan speed (0..1): brighter, louder air noise. */
  fanSpeed: number;
  /** Generator engine speed (0..1) and how audible the yard is from here (0..1). */
  generatorRpm: number;
  generatorLevel: number;
  /** Alarms. */
  fireAlarm: boolean;
  upsAlarm: boolean;
}

/** Smoothing time constant for parameter changes, s. */
const SMOOTH = 0.35;

function noiseBuffer(ctx: AudioContext, kind: "brown" | "pink", seconds = 4): AudioBuffer {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (kind === "brown") {
    // Integrated white noise: energy concentrated at low frequencies (air rush, rumble).
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    // Paul Kellet's economy pink-noise filter: equal energy per octave (wind).
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
  }
  return buffer;
}

export class SoundEngine {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly hallGain: GainNode;
  private readonly hallFilter: BiquadFilterNode;
  private readonly whine: OscillatorNode;
  private readonly whineGain: GainNode;
  private readonly humGain: GainNode;
  private readonly plantGain: GainNode;
  private readonly windGain: GainNode;
  private readonly genGain: GainNode;
  private readonly genOsc: OscillatorNode;
  private readonly genSub: OscillatorNode;
  private readonly genFilter: BiquadFilterNode;
  private readonly starterOsc: OscillatorNode;
  private readonly starterGain: GainNode;
  private readonly alarmOsc: OscillatorNode;
  private readonly alarmGain: GainNode;
  private readonly beepOsc: OscillatorNode;
  private readonly beepGain: GainNode;
  private lastRpm = 0;

  constructor() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    const brown = noiseBuffer(ctx, "brown");
    const pink = noiseBuffer(ctx, "pink");
    const loop = (buffer: AudioBuffer) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      // Random offsets so layers sharing a buffer don't phase together.
      src.start(0, Math.random() * buffer.duration);
      return src;
    };
    const gain = (v = 0) => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.master);
      return g;
    };

    // Hall: low-passed brown noise (air rush), cutoff rises with fan speed; faint high fan whine.
    this.hallGain = gain();
    this.hallFilter = ctx.createBiquadFilter();
    this.hallFilter.type = "lowpass";
    this.hallFilter.frequency.value = 900;
    loop(brown).connect(this.hallFilter).connect(this.hallGain);
    this.whineGain = gain();
    this.whine = ctx.createOscillator();
    this.whine.frequency.value = 2600;
    this.whine.connect(this.whineGain);
    this.whine.start();

    // Electrical hum: 100 Hz and 150 Hz (mains at 50 Hz: magnetostriction hums at twice the line frequency).
    this.humGain = gain();
    for (const [f, a] of [
      [100, 1],
      [150, 0.35],
      [200, 0.2],
    ] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = a;
      o.connect(g).connect(this.humGain);
      o.start();
    }

    // Plant: deep rumble (pumps, compressors) = band-limited brown noise plus a 50 Hz drone.
    this.plantGain = gain();
    const plantFilter = ctx.createBiquadFilter();
    plantFilter.type = "lowpass";
    plantFilter.frequency.value = 280;
    loop(brown).connect(plantFilter).connect(this.plantGain);
    const drone = ctx.createOscillator();
    drone.type = "sawtooth";
    drone.frequency.value = 50;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.08;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 160;
    drone.connect(droneFilter).connect(droneGain).connect(this.plantGain);
    drone.start();

    // Wind: band-passed pink noise with a slow gust LFO.
    this.windGain = gain();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    const gust = ctx.createGain();
    gust.gain.value = 0.7;
    loop(pink).connect(windFilter).connect(gust).connect(this.windGain);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth).connect(gust.gain);
    lfo.start();

    // Generator: diesel firing note (sawtooth) plus a sub-harmonic, low-passed; pitch follows rpm.
    this.genGain = gain();
    this.genFilter = ctx.createBiquadFilter();
    this.genFilter.type = "lowpass";
    this.genFilter.frequency.value = 300;
    this.genFilter.connect(this.genGain);
    this.genOsc = ctx.createOscillator();
    this.genOsc.type = "sawtooth";
    this.genSub = ctx.createOscillator();
    this.genSub.type = "square";
    const subGain = ctx.createGain();
    subGain.gain.value = 0.4;
    this.genOsc.connect(this.genFilter);
    this.genSub.connect(subGain).connect(this.genFilter);
    loop(brown).connect(this.genFilter);
    this.genOsc.start();
    this.genSub.start();
    // Starter motor whine while cranking.
    this.starterGain = gain();
    this.starterOsc = ctx.createOscillator();
    this.starterOsc.type = "triangle";
    this.starterOsc.frequency.value = 320;
    this.starterOsc.connect(this.starterGain);
    this.starterOsc.start();

    // Fire alarm sounder (~950 Hz) and UPS on-battery beep (2 kHz), gated by their gains.
    this.alarmGain = gain();
    this.alarmOsc = ctx.createOscillator();
    this.alarmOsc.type = "square";
    this.alarmOsc.frequency.value = 950;
    const alarmFilter = ctx.createBiquadFilter();
    alarmFilter.type = "lowpass";
    alarmFilter.frequency.value = 2500;
    this.alarmOsc.connect(alarmFilter).connect(this.alarmGain);
    this.alarmOsc.start();
    this.beepGain = gain();
    this.beepOsc = ctx.createOscillator();
    this.beepOsc.frequency.value = 2000;
    this.beepOsc.connect(this.beepGain);
    this.beepOsc.start();
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  async suspend(): Promise<void> {
    if (this.ctx.state === "running") await this.ctx.suspend();
  }

  private set(param: AudioParam, value: number, smooth = SMOOTH): void {
    param.setTargetAtTime(value, this.ctx.currentTime, smooth);
  }

  update(p: SoundParams): void {
    const t = this.ctx.currentTime;
    const fan = Math.min(1, Math.max(0, p.fanSpeed));
    this.set(this.hallGain.gain, p.hall * (0.18 + 0.32 * fan));
    this.set(this.hallFilter.frequency, 600 + 2200 * fan);
    this.set(this.whine.frequency, 1800 + 2200 * fan);
    this.set(this.whineGain.gain, p.hall * 0.004 * (0.4 + fan));
    this.set(this.humGain.gain, p.hum * 0.03);
    this.set(this.plantGain.gain, p.plant * (0.25 + 0.2 * fan));
    this.set(this.windGain.gain, p.outdoor * 0.22);

    // Generator: firing frequency of a 16-cylinder four-stroke at 1,500 rpm is
    // 1500/60 x 16/2 = 200 Hz; the crankshaft turns at 25 Hz.
    const rpm = Math.min(1, Math.max(0, p.generatorRpm));
    this.set(this.genOsc.frequency, 30 + 170 * rpm, 0.5);
    this.set(this.genSub.frequency, 8 + 17 * rpm, 0.5);
    this.set(this.genFilter.frequency, 180 + 520 * rpm, 0.5);
    this.set(this.genGain.gain, p.generatorLevel * Math.min(1, rpm * 1.4) * 0.35, 0.4);
    const cranking = rpm > 0.001 && rpm < 0.35 && rpm >= this.lastRpm;
    this.set(this.starterOsc.frequency, 260 + 500 * rpm, 0.2);
    this.set(this.starterGain.gain, cranking ? p.generatorLevel * 0.05 : 0, 0.15);
    this.lastRpm = rpm;

    // Fire sounder: on/off at ~1 Hz (temporal pattern); UPS: a short beep every 4 s.
    const alarmOn = p.fireAlarm && Math.floor(t * 2) % 2 === 0;
    this.set(this.alarmGain.gain, alarmOn ? 0.06 : 0, 0.01);
    const beepOn = p.upsAlarm && t % 4 < 0.18;
    this.set(this.beepGain.gain, beepOn ? 0.03 : 0, 0.01);
  }

  /** Two-tone chime for BMS / NOC notifications. */
  chime(): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [f, dt] of [
      [880, 0],
      [660, 0.18],
    ] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(0.06, t + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.5);
      o.connect(g).connect(this.master);
      o.start(t + dt);
      o.stop(t + dt + 0.55);
    }
  }
}

let engine: SoundEngine | null = null;

/** Create (on first call, which must be inside a user gesture) and return the engine. */
export function getSoundEngine(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}

export const peekSoundEngine = (): SoundEngine | null => engine;
