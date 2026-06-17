// Shared color + math helpers for the animation and reactive engines.
// Pure functions only — no DOM, no protocol concerns.

import { hexToRgb, normalizeHex } from "./apcProtocol";

export type Rgb = { r: number; g: number; b: number };

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

export function frac(value: number) {
  return value - Math.floor(value);
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function channelToHex(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).toUpperCase().padStart(2, "0");
}

export function rgbToHex({ r, g, b }: Rgb) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

// HSL with h in [0,360), s/l in [0,100].
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s / 100, 0, 1);
  const lightness = clamp(l / 100, 0, 1);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (segment < 1) {
    [r, g, b] = [chroma, x, 0];
  } else if (segment < 2) {
    [r, g, b] = [x, chroma, 0];
  } else if (segment < 3) {
    [r, g, b] = [0, chroma, x];
  } else if (segment < 4) {
    [r, g, b] = [0, x, chroma];
  } else if (segment < 5) {
    [r, g, b] = [x, 0, chroma];
  } else {
    [r, g, b] = [chroma, 0, x];
  }

  return {
    r: (r + match) * 255,
    g: (g + match) * 255,
    b: (b + match) * 255,
  };
}

export function hslToHex(h: number, s: number, l: number) {
  return rgbToHex(hslToRgb(h, s, l));
}

export function rgbToHsl({ r, g, b }: Rgb) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  return { h, s: s * 100, l: l * 100 };
}

export function hexToHsl(hex: string) {
  return rgbToHsl(hexToRgb(hex));
}

// Shortest-path hue interpolation around the 360° wheel.
export function lerpHue(h1: number, h2: number, amount: number) {
  let delta = ((h2 - h1) % 360 + 540) % 360 - 180;
  return ((h1 + delta * amount) % 360 + 360) % 360;
}

export function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function mixHex(a: string, b: string, amount: number) {
  return rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), amount));
}

export { hexToRgb, normalizeHex };

// Deterministic 1D hash noise in [0,1) — used for sparkle/flicker/seeds.
export function seededNoise(index: number, seed: number) {
  const value = Math.sin(index * 127.13 + seed * 41.91) * 10000;
  return value - Math.floor(value);
}

function hash2(ix: number, iy: number) {
  const value = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

// Smooth 2D value noise in [0,1] with quintic-ish (smoothstep) interpolation.
export function valueNoise2D(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
