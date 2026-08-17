/**
 * Sound cues.
 *
 * Every cue is currently synthesised in the browser, which keeps the app
 * dependency-free and guarantees the sounds are short and quiet. They are
 * placeholders in intent, not in quality: each one is shaped to be felt more
 * than heard.
 *
 * To replace a cue with a recorded file, drop it in `public/sounds/` and add
 * the path to `SOUND_SOURCES` below. The manager prefers a file whenever one
 * exists and falls back to the synth otherwise — no other code changes.
 */

export type CueName =
  | "join"
  | "submit"
  | "select"
  | "countdown"
  | "reveal"
  | "disagree"
  | "align"
  | "profileSelect"
  | "moneyFlick"
  | "moneyDrop"
  | "dnaComplete"
  | "heart"
  | "finalReveal"
  | "sessionClose"
  | "advance";

/** e.g. { reveal: "/sounds/reveal.mp3" } */
export const SOUND_SOURCES: Partial<Record<CueName, string>> = {};

/** Per-cue trim, so no single cue has to be re-recorded to sit right. */
export const CUE_GAIN: Record<CueName, number> = {
  join: 0.5,
  submit: 0.45,
  select: 0.3,
  countdown: 0.35,
  reveal: 0.6,
  disagree: 0.6,
  align: 0.55,
  profileSelect: 0.4,
  moneyFlick: 0.28,
  moneyDrop: 0.5,
  dnaComplete: 0.55,
  heart: 0.3,
  finalReveal: 0.7,
  sessionClose: 0.6,
  advance: 0.25,
};

export interface SynthCtx {
  ctx: AudioContext;
  out: AudioNode;
  now: number;
  noise: AudioBuffer;
}

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  start?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  /** Glide to this frequency across the note. */
  sweepTo?: number;
  filter?: { freq: number; q?: number; type?: BiquadFilterType };
  detune?: number;
}

export function tone(s: SynthCtx, o: ToneOptions) {
  const start = s.now + (o.start ?? 0);
  const dur = o.dur ?? 0.24;
  const attack = o.attack ?? 0.006;

  const osc = s.ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.detune) osc.detune.setValueAtTime(o.detune, start);
  if (o.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.sweepTo), start + dur);

  const gain = s.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.2), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let node: AudioNode = osc;
  if (o.filter) {
    const biquad = s.ctx.createBiquadFilter();
    biquad.type = o.filter.type ?? "lowpass";
    biquad.frequency.setValueAtTime(o.filter.freq, start);
    biquad.Q.setValueAtTime(o.filter.q ?? 0.7, start);
    node.connect(biquad);
    node = biquad;
  }
  node.connect(gain).connect(s.out);

  osc.start(start);
  osc.stop(start + dur + 0.05);
}

interface NoiseOptions {
  start?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  filter?: { freq: number; q?: number; type?: BiquadFilterType; sweepTo?: number };
}

export function noiseBurst(s: SynthCtx, o: NoiseOptions) {
  const start = s.now + (o.start ?? 0);
  const dur = o.dur ?? 0.12;

  const src = s.ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;

  const gain = s.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.12), start + (o.attack ?? 0.004));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let node: AudioNode = src;
  if (o.filter) {
    const biquad = s.ctx.createBiquadFilter();
    biquad.type = o.filter.type ?? "bandpass";
    biquad.frequency.setValueAtTime(o.filter.freq, start);
    biquad.Q.setValueAtTime(o.filter.q ?? 1.2, start);
    if (o.filter.sweepTo) {
      biquad.frequency.exponentialRampToValueAtTime(
        Math.max(20, o.filter.sweepTo),
        start + dur,
      );
    }
    node.connect(biquad);
    node = biquad;
  }
  node.connect(gain).connect(s.out);

  src.start(start);
  src.stop(start + dur + 0.05);
}

/* ------------------------------------------------------------------ */
/* The cues                                                            */
/* ------------------------------------------------------------------ */

// A minor-pentatonic-ish set — pleasant in any order, so overlapping cues
// never clash during a busy reveal.
const A4 = 440;
const E5 = 659.25;
const B4 = 493.88;
const D5 = 587.33;
const Fs5 = 739.99;
const A5 = 880;
const Cs6 = 1108.73;

export const RECIPES: Record<CueName, (s: SynthCtx) => void> = {
  /** Two rising notes: "you're in". */
  join: (s) => {
    tone(s, { freq: B4, type: "sine", dur: 0.22, gain: 0.16 });
    tone(s, { freq: Fs5, type: "sine", start: 0.09, dur: 0.34, gain: 0.13 });
    tone(s, { freq: Fs5 * 2, type: "sine", start: 0.09, dur: 0.3, gain: 0.03 });
  },

  /** Soft confirming tap — a full stop, not a fanfare. */
  submit: (s) => {
    tone(s, { freq: D5, type: "sine", dur: 0.16, gain: 0.14 });
    tone(s, { freq: A5, type: "sine", start: 0.05, dur: 0.2, gain: 0.06 });
    noiseBurst(s, { dur: 0.05, gain: 0.02, filter: { freq: 2600, q: 1.4 } });
  },

  /** Barely-there tick when a choice is highlighted. */
  select: (s) => {
    noiseBurst(s, { dur: 0.035, gain: 0.05, filter: { freq: 3200, q: 2 } });
    tone(s, { freq: A5, type: "sine", dur: 0.06, gain: 0.05 });
  },

  /** Neutral metronome tick — no game-show urgency. */
  countdown: (s) => {
    tone(s, { freq: A4, type: "sine", dur: 0.09, gain: 0.09 });
  },

  /** Cinematic lift, then the drop that lands on the results. */
  reveal: (s) => {
    noiseBurst(s, {
      dur: 0.75,
      gain: 0.055,
      attack: 0.4,
      filter: { freq: 260, sweepTo: 2600, q: 0.8, type: "bandpass" },
    });
    tone(s, { freq: B4 / 2, type: "triangle", dur: 0.8, gain: 0.07, attack: 0.35 });
    tone(s, { freq: Fs5, type: "sine", start: 0.62, dur: 0.5, gain: 0.13 });
    tone(s, { freq: Cs6, type: "sine", start: 0.68, dur: 0.42, gain: 0.06 });
  },

  /** Playful, slightly cocked-eyebrow interval. Falls, then questions. */
  disagree: (s) => {
    tone(s, { freq: Fs5, type: "triangle", dur: 0.16, gain: 0.13 });
    tone(s, { freq: D5, type: "triangle", start: 0.12, dur: 0.16, gain: 0.13 });
    tone(s, { freq: A4, type: "triangle", start: 0.24, dur: 0.34, gain: 0.12, sweepTo: A4 * 1.06 });
    noiseBurst(s, { start: 0.24, dur: 0.2, gain: 0.02, filter: { freq: 1400, q: 1 } });
  },

  /** Warm major third — agreement, without smugness. */
  align: (s) => {
    tone(s, { freq: D5, type: "sine", dur: 0.5, gain: 0.11 });
    tone(s, { freq: Fs5, type: "sine", start: 0.04, dur: 0.5, gain: 0.09 });
    tone(s, { freq: A5, type: "sine", start: 0.08, dur: 0.55, gain: 0.05 });
  },

  /** Card lifts off the table. */
  profileSelect: (s) => {
    noiseBurst(s, { dur: 0.14, gain: 0.045, filter: { freq: 900, sweepTo: 2800, q: 0.9 } });
    tone(s, { freq: E5, type: "sine", start: 0.03, dur: 0.2, gain: 0.09 });
  },

  /** Paper-money flick: filtered noise, no tonal content at all. */
  moneyFlick: (s) => {
    noiseBurst(s, { dur: 0.075, gain: 0.075, filter: { freq: 2200, sweepTo: 900, q: 1.6 } });
    noiseBurst(s, { start: 0.045, dur: 0.05, gain: 0.04, filter: { freq: 3400, q: 2.2 } });
  },

  /** Low satisfying thump as a bundle lands. */
  moneyDrop: (s) => {
    tone(s, { freq: 140, type: "sine", dur: 0.19, gain: 0.22, sweepTo: 62 });
    noiseBurst(s, { dur: 0.07, gain: 0.05, filter: { freq: 480, q: 0.9, type: "lowpass" } });
  },

  /** The DNA ring closing — eight parts resolving into one chord. */
  dnaComplete: (s) => {
    [D5, Fs5, A5, Cs6].forEach((freq, i) => {
      tone(s, { freq, type: "sine", start: i * 0.07, dur: 0.75, gain: 0.075 - i * 0.012 });
    });
    noiseBurst(s, { dur: 0.5, gain: 0.02, attack: 0.25, filter: { freq: 3000, q: 0.6 } });
  },

  /** A heart lands. Tiny. */
  heart: (s) => {
    tone(s, { freq: A5, type: "sine", dur: 0.1, gain: 0.07 });
    tone(s, { freq: Cs6, type: "sine", start: 0.045, dur: 0.12, gain: 0.045 });
  },

  /** Final reveal: a slow swell that opens out rather than hits. */
  finalReveal: (s) => {
    noiseBurst(s, {
      dur: 1.5,
      gain: 0.05,
      attack: 0.95,
      filter: { freq: 180, sweepTo: 3200, q: 0.7, type: "bandpass" },
    });
    tone(s, { freq: 110, type: "triangle", dur: 1.7, gain: 0.08, attack: 0.7 });
    [D5, A5, Fs5 * 2].forEach((freq, i) => {
      tone(s, { freq, type: "sine", start: 1.05 + i * 0.1, dur: 1.1, gain: 0.09 - i * 0.02 });
    });
  },

  /** Session close: a descending, settled cadence. */
  sessionClose: (s) => {
    tone(s, { freq: A5, type: "sine", dur: 0.4, gain: 0.09 });
    tone(s, { freq: Fs5, type: "sine", start: 0.18, dur: 0.45, gain: 0.09 });
    tone(s, { freq: D5, type: "sine", start: 0.36, dur: 0.9, gain: 0.1 });
    tone(s, { freq: D5 / 2, type: "triangle", start: 0.36, dur: 1.1, gain: 0.06 });
  },

  /** Moving between screens — almost subliminal. */
  advance: (s) => {
    noiseBurst(s, { dur: 0.16, gain: 0.028, filter: { freq: 500, sweepTo: 2000, q: 0.8 } });
  },
};
