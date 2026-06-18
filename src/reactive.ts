// Reactive engine: turns incoming MIDI notes into living light on the grid.
//
// Handlers mutate a ref-held ReactiveState (no React render per message). A rAF
// loop calls stepReactive() (decay + sustain + ripple growth + neighbour bleed)
// then composeReactive() to fill an RGB buffer for the screen and the device.

import { type Rgb, clamp, hexToRgb, hslToRgb, mixRgb, smoothstep } from "./color";
import type { MidiCcEvent, MidiNoteEvent, ReactiveConfig } from "./types";

const N = 64;

export interface ReactiveState {
  energy: Float32Array;
  born: Float64Array;
  held: Map<number, { velocity: number; born: number }>;
  ripples: Array<{ pad: number; born: number; velocity: number }>;
  ccHue: number;
  last: number;
}

export function createReactiveState(now: number): ReactiveState {
  return {
    energy: new Float32Array(N),
    born: new Float64Array(N),
    held: new Map(),
    ripples: [],
    ccHue: 0,
    last: now,
  };
}

const xOf = (pad: number) => pad % 8;
const yOf = (pad: number) => Math.floor(pad / 8);
function chebyshev(a: number, b: number) {
  return Math.max(Math.abs(xOf(a) - xOf(b)), Math.abs(yOf(a) - yOf(b)));
}

function triggerPad(state: ReactiveState, pad: number, velocity: number, time: number) {
  state.held.set(pad, { velocity, born: time });
  state.ripples.push({ pad, born: time, velocity });
  state.energy[pad] = Math.max(state.energy[pad], 0.3 + 0.7 * velocity);
  state.born[pad] = time;
}

export function ingestNote(state: ReactiveState, event: MidiNoteEvent) {
  if (event.type === "noteon") {
    if (event.pad != null) {
      triggerPad(state, event.pad, event.velocity, event.time);
      return;
    }
    // APC track buttons (0x64-0x6B) flood a column; scene buttons (0x70-0x77) flood a row.
    if (event.isApc && event.note >= 0x64 && event.note <= 0x6b) {
      const column = event.note - 0x64;
      for (let row = 0; row < 8; row += 1) {
        triggerPad(state, row * 8 + column, event.velocity, event.time);
      }
    } else if (event.isApc && event.note >= 0x70 && event.note <= 0x77) {
      const rowFromTop = event.note - 0x70;
      const rowFromBottom = 7 - rowFromTop;
      for (let column = 0; column < 8; column += 1) {
        triggerPad(state, rowFromBottom * 8 + column, event.velocity, event.time);
      }
    }
    return;
  }
  if (event.pad != null) {
    state.held.delete(event.pad);
  }
}

export function ingestCc(state: ReactiveState, event: MidiCcEvent) {
  // Mod wheel (CC1) or any fader biases the global hue.
  state.ccHue = event.value;
}

export function stepReactive(state: ReactiveState, config: ReactiveConfig, now: number) {
  const dt = Math.min(0.1, (now - state.last) / 1000);
  state.last = now;

  const decay = Math.exp(-config.decayPerSec * dt);
  for (let i = 0; i < N; i += 1) {
    state.energy[i] *= decay;
  }

  // Sustained notes keep a breathing glow while held.
  if (config.behavior === "glow" || config.behavior === "heat") {
    state.held.forEach(({ velocity }, pad) => {
      const breathe = 0.85 + 0.15 * Math.sin(now / 300);
      state.energy[pad] = Math.max(state.energy[pad], (0.4 + 0.6 * velocity) * breathe);
    });
  }

  // Expanding rings (ripple behavior).
  if (config.behavior === "ripple") {
    state.ripples = state.ripples.filter((r) => now - r.born < config.rippleLifeMs);
    for (const ripple of state.ripples) {
      const radius = (now - ripple.born) / config.rippleSpeed;
      const fade = 1 - (now - ripple.born) / config.rippleLifeMs;
      for (let pad = 0; pad < N; pad += 1) {
        if (Math.abs(chebyshev(pad, ripple.pad) - radius) < 0.6) {
          state.energy[pad] = Math.min(1, state.energy[pad] + 0.6 * ripple.velocity * fade);
        }
      }
    }
  } else {
    state.ripples.length = 0;
  }

  // Neighbour diffusion for comet-like smears (trails behavior).
  if (config.behavior === "trails" && config.spread > 0) {
    const out = Float32Array.from(state.energy);
    const amount = Math.min(0.5, config.spread * dt);
    for (let pad = 0; pad < N; pad += 1) {
      const x = xOf(pad);
      const y = yOf(pad);
      let acc = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
            acc += state.energy[ny * 8 + nx];
            n += 1;
          }
        }
      }
      out[pad] = state.energy[pad] * (1 - amount) + (acc / Math.max(1, n)) * amount;
    }
    state.energy.set(out);
  }
}

function colorFor(config: ReactiveConfig, energy: number, hue: number): Rgb {
  const base = hexToRgb(config.base);
  if (energy <= 0.001) {
    return base;
  }
  if (config.behavior === "heat") {
    return hslToRgb((1 - energy) * 220, 95, 12 + 60 * energy);
  }
  if (config.behavior === "ripple" || config.behavior === "trails") {
    return mixRgb(base, hslToRgb(hue * 360, 90, 55), energy);
  }
  // glow
  return mixRgb(base, hexToRgb(config.accent), energy);
}

export function composeReactive(out: Rgb[], state: ReactiveState, config: ReactiveConfig) {
  for (let pad = 0; pad < N; pad += 1) {
    const energy = clamp(state.energy[pad] * (0.5 + config.intensity / 2), 0, 1);
    const hue = (state.ccHue + state.born[pad] / 4000) % 1;
    const color = colorFor(config, energy, hue < 0 ? hue + 1 : hue);
    out[pad].r = color.r;
    out[pad].g = color.g;
    out[pad].b = color.b;
  }
}

export function clearReactive(state: ReactiveState) {
  state.energy.fill(0);
  state.born.fill(0);
  state.held.clear();
  state.ripples.length = 0;
}
