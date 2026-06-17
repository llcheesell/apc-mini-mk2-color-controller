// Time-based animation library for the 8x8 RGB grid.
//
// Each definition fills `out` (64 RGB entries indexed by note 0-63) for an elapsed
// time `t` in seconds. Motion is a pure function of continuous time, so the engine
// can render at any frame rate without stepping artifacts. `speed` and `intensity`
// arrive as the raw 1-10 slider values; we normalise to 0..1 (s, e) inside each
// algorithm and tune the constants so low = calm/slow and high = energetic.

import {
  type Rgb,
  clamp,
  frac,
  hexToHsl,
  hexToRgb,
  hslToRgb,
  hslToHex,
  lerp,
  lerpHue,
  mixHex,
  seededNoise,
  smoothstep,
  valueNoise2D,
} from "./color";
import type { AnimationDefinition, AnimationRenderContext } from "./types";

const TAU = Math.PI * 2;

function pn(ctx: AnimationRenderContext, key: string, fallback: number) {
  const value = ctx.params[key];
  return typeof value === "number" ? value : fallback;
}
function pb(ctx: AnimationRenderContext, key: string, fallback: boolean) {
  const value = ctx.params[key];
  return typeof value === "boolean" ? value : fallback;
}
function ps(ctx: AnimationRenderContext, key: string, fallback: string) {
  const value = ctx.params[key];
  return typeof value === "string" ? value : fallback;
}

function put(out: Rgb[], note: number, color: Rgb) {
  out[note].r = color.r;
  out[note].g = color.g;
  out[note].b = color.b;
}
function putHex(out: Rgb[], note: number, hex: string) {
  put(out, note, hexToRgb(hex));
}

function columnOf(note: number) {
  return note % 8;
}
function rowFromTopOf(note: number) {
  return 7 - Math.floor(note / 8);
}

// Piecewise color ramp with smoothstep blending between stops (sorted by pos).
function rampColor(stops: Array<{ pos: number; hex: string }>, value: number) {
  const v = clamp(value, 0, 1);
  if (v <= stops[0].pos) {
    return stops[0].hex;
  }
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (v <= b.pos) {
      const local = (v - a.pos) / (b.pos - a.pos || 1);
      return mixHex(a.hex, b.hex, smoothstep(0, 1, local));
    }
  }
  return stops[stops.length - 1].hex;
}

// ---------------------------------------------------------------------------

function renderRainbowSweep(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const angle = (pn(ctx, "sweepAngle", 45) * Math.PI) / 180;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const spread = pn(ctx, "hueSpreadDeg", 38);
  const fullSpectrum = pb(ctx, "fullSpectrum", true);
  const flow = 40 + s * 260; // deg/sec
  const baseHue = hexToHsl(ctx.primary).h;
  const secHue = hexToHsl(ctx.secondary).h;

  for (let note = 0; note < 64; note += 1) {
    const column = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    const p = column * ux + rowFromTop * uy;
    let hue: number;
    if (fullSpectrum) {
      hue = ((baseHue + p * spread - t * flow) % 360 + 360) % 360;
    } else {
      const n = frac((p * spread - t * flow) / 360);
      hue = lerpHue(baseHue, secHue, 0.5 + 0.5 * Math.sin(TAU * n));
    }
    const crest = 0.5 + 0.5 * Math.sin(p * 0.6 - (t * flow * Math.PI) / 180);
    const light = 46 + (6 + e * 22) * crest;
    put(out, note, hslToRgb(hue, 92, light));
  }
}

function renderPlasma(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const w = 0.5 + s * 3.5;
  const sc = 0.5 + e * 1.0;
  const drift = pn(ctx, "hueDrift", 0);
  const c1 = hexToHsl(ctx.primary);
  const c2 = hexToHsl(ctx.secondary);
  const h1 = c1.h + (drift > 0 ? t * drift : 0);
  const h2 = c2.h + (drift > 0 ? t * drift : 0);

  for (let note = 0; note < 64; note += 1) {
    const cx = columnOf(note) + 0.5;
    const cy = rowFromTopOf(note) + 0.5;
    const dist = Math.sqrt((cx - 4) * (cx - 4) + (cy - 4) * (cy - 4));
    const v =
      Math.sin(cx * sc * 0.9 + t * w) +
      Math.sin(cy * sc * 1.1 + t * w * 0.8) +
      Math.sin((cx + cy) * sc * 0.6 + t * w * 1.3) +
      Math.sin(dist * sc * 1.4 - t * w * 1.1);
    const p = (v + 4) / 8;
    const hue = lerpHue(h1, h2, p);
    const sat = Math.max(lerp(c1.s, c2.s, p), 70);
    const light = 30 + 36 * p;
    put(out, note, hslToRgb(hue, sat, light));
  }
}

function renderEmberFlame(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const rise = 0.4 + s * 1.6;
  const flick = 0.2 + e * 0.5;
  const edge = ps(ctx, "baseEdge", "bottom");
  const midSetting = ps(ctx, "midColor", "auto");
  const mid =
    midSetting === "auto"
      ? hslToHex(
          lerpHue(hexToHsl(ctx.primary).h, hexToHsl(ctx.secondary).h, 0.5),
          (hexToHsl(ctx.primary).s + hexToHsl(ctx.secondary).s) / 2,
          (hexToHsl(ctx.primary).l + hexToHsl(ctx.secondary).l) / 2,
        )
      : midSetting;
  const stops = [
    { pos: 0, hex: "#000000" },
    { pos: 0.35, hex: ctx.primary },
    { pos: 0.75, hex: mid },
    { pos: 1, hex: ctx.secondary },
  ];

  for (let note = 0; note < 64; note += 1) {
    const column = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    let along: number;
    let across: number;
    if (edge === "top") {
      along = rowFromTop;
      across = column;
    } else if (edge === "left") {
      along = column;
      across = rowFromTop;
    } else if (edge === "right") {
      along = 7 - column;
      across = rowFromTop;
    } else {
      along = 7 - rowFromTop; // bottom
      across = column;
    }
    const g = Math.pow(clamp(along / 7, 0, 1), 1.4);
    const n = valueNoise2D(across * 0.9, along * 0.9 + t * rise);
    const n2 = 0.5 * valueNoise2D(across * 1.8 + 11.3, along * 1.8 + t * rise * 1.7);
    const turb = (n + n2) / 1.5;
    const heat = clamp(g * 1.15 - (1 - turb) * flick + 0.06 * Math.sin(t * 6 + across), 0, 1);
    putHex(out, note, rampColor(stops, heat));
  }
}

function renderRippleRings(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const w = 2 + s * 7;
  const k = pn(ctx, "freq", 1.15);
  const exp = 1 + e * 6;
  const center = ps(ctx, "center", "drift");
  let cx = 3.5;
  let cy = 3.5;
  if (center === "drift") {
    cx = 3.5 + 1.6 * Math.sin(t * 0.23);
    cy = 3.5 + 1.6 * Math.cos(t * 0.19);
  } else if (center === "corner") {
    cx = 0;
    cy = 0;
  }

  for (let note = 0; note < 64; note += 1) {
    const column = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    const d = Math.sqrt((column - cx) * (column - cx) + (rowFromTop - cy) * (rowFromTop - cy));
    const raw = Math.sin(d * k - t * w);
    const crest = Math.pow((raw + 1) / 2, exp);
    const atten = 1 / (1 + 0.18 * d);
    const v = crest * atten;
    const base = mixHex(ctx.secondary, ctx.primary, smoothstep(0.15, 0.85, v));
    const rim = smoothstep(0.82, 1, crest);
    const color = mixHex(base, "#FFFFFF", rim * 0.7);
    putHex(out, note, mixHex("#000000", color, clamp(0.06 + v * 0.97, 0, 1)));
  }
}

function renderComet(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const angle = (pn(ctx, "angle", 45) * Math.PI) / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const count = Math.round(pn(ctx, "cometCount", 2));
  const tail = 1 + e * 4;
  const L = 8 * (Math.abs(dirX) + Math.abs(dirY)) + tail;
  const v = 1 + s * 8; // cells/sec
  const head = frac((t * v) / L) * L;

  for (let note = 0; note < 64; note += 1) {
    const sproj = columnOf(note) * dirX + rowFromTopOf(note) * dirY;
    let b = 0;
    for (let i = 0; i < count; i += 1) {
      const headi = (head + (i * L) / count) % L;
      const di = (((headi - sproj) % L) + L) % L;
      b = Math.max(b, Math.exp(-di / tail));
    }
    b = clamp(b, 0, 1);
    const trail = mixHex(ctx.secondary, ctx.primary, smoothstep(0, 1, b));
    const color = mixHex(trail, "#FFFFFF", b * b * b);
    putHex(out, note, mixHex("#000000", color, b));
  }
}

function renderSpiralPinwheel(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const omega = 0.5 + s * 4;
  const arms = Math.round(pn(ctx, "arms", 3));
  const twist = pn(ctx, "twist", 0.6);
  const edge = 0.45 - e * 0.3;

  for (let note = 0; note < 64; note += 1) {
    const dx = columnOf(note) - 3.5;
    const dy = rowFromTopOf(note) - 3.5;
    const r = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx);
    const phase = arms * ang + twist * r - t * omega;
    const raw = 0.5 + 0.5 * Math.sin(phase);
    const m = smoothstep(0.5 - edge, 0.5 + edge, raw);
    const glow = 1 - smoothstep(0, 5, r) * 0.55;
    const core = 1 - smoothstep(0, 1.2, r);
    const coreBoost = 0.3 + e * 0.5;
    const v = Math.max(m * glow, core * coreBoost);
    putHex(out, note, mixHex(ctx.secondary, ctx.primary, clamp(v, 0, 1)));
  }
}

function renderFireworks(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const I = 2.4 - s * 1.6;
  const ringSpeed = 4 + s * 8;
  const width = 0.6 + e * 1.4;
  const gravity = pn(ctx, "gravity", 0.6);
  const twRate = 3 + s * 8;
  const k = Math.floor(t / I);

  for (let note = 0; note < 64; note += 1) {
    const column = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    let b = 0;
    let colorBase = ctx.primary;
    for (const j of [k, k - 1]) {
      if (j < 0) {
        continue;
      }
      const tau = t - j * I;
      const bx = seededNoise(j, 11) * 7;
      const by = 1 + seededNoise(j, 29) * 4;
      let bj = 0;
      if (tau < 0.35 * I) {
        // launch streak
        const riseY = (tau / (0.35 * I)) * by;
        if (Math.round(bx) === column && rowFromTop <= riseY && rowFromTop >= riseY - 1.2) {
          bj = 0.8;
        }
      } else {
        const localE = tau - 0.35 * I;
        const R = ringSpeed * localE;
        const cy = by + gravity * localE * localE;
        const distP = Math.hypot(column - bx, rowFromTop - cy);
        const ring = Math.exp(-((distP - R) * (distP - R)) / width);
        const fade = Math.exp(-localE * 2);
        const spark = 0.5 + 0.5 * seededNoise(note + j * 17, Math.floor(localE * 8));
        bj = clamp(ring * fade * spark, 0, 1);
      }
      const weight = j === k ? 1 : 0.7;
      if (bj * weight > b) {
        b = bj * weight;
        colorBase = mixHex(ctx.primary, ctx.secondary, seededNoise(j, 5));
      }
    }
    b = clamp(b, 0, 1);
    const core = mixHex(colorBase, "#FFFFFF", b * b);
    const tw = seededNoise(note, Math.floor(t * twRate)) > 0.92 - 0.12 * e ? 1 : 0;
    putHex(out, note, mixHex(mixHex("#000000", core, b), ctx.secondary, 0.35 * tw * (1 - b)));
  }
}

function renderAurora(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const w = 0.3 + s * 1.8;
  const sigma = 1.6 - e * 0.7;
  const count = Math.round(pn(ctx, "curtainCount", 2));
  const h1 = hexToHsl(ctx.primary).h;
  const h2 = hexToHsl(ctx.secondary).h;

  for (let note = 0; note < 64; note += 1) {
    const cx = columnOf(note) + 0.5;
    const cy = rowFromTopOf(note) + 0.5;
    const curtain = 2 + 1.6 * Math.sin(cx * 0.7 + t * w) + 0.9 * Math.sin(cx * 1.3 - t * w * 0.8);
    const band = Math.exp(-((cy - curtain) * (cy - curtain)) / (2 * sigma * sigma));
    let glow = band;
    if (count >= 2) {
      const curtain2 = 4 + 1.4 * Math.sin(cx * 0.9 - t * w * 1.2 + 2.1);
      const band2 = Math.exp(-((cy - curtain2) * (cy - curtain2)) / (2 * sigma * sigma));
      glow = Math.max(band, 0.7 * band2);
    }
    glow = clamp(glow, 0, 1);
    const hpos = clamp(cy / 8, 0, 1);
    const hue = lerpHue(h1, h2, hpos * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * w * 0.3)));
    const light = 6 + 50 * glow * (0.6 + 0.4 * e);
    put(out, note, hslToRgb(hue, 90, light));
  }
}

function renderMatrixRain(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const L = 8;
  const tailLen = 1.5 + e * 4;
  const flickRate = 6 + s * 12;
  const bg = mixHex("#000000", ctx.secondary, 0.06 + 0.05 * e);

  for (let note = 0; note < 64; note += 1) {
    const c = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    if (seededNoise(c, 3) >= 0.55 + 0.4 * (1 - e)) {
      // column inactive — only dim background
      putHex(out, note, bg);
      continue;
    }
    const vc = (0.6 + 0.8 * seededNoise(c, 7)) * (0.4 + s * 2);
    const phase = seededNoise(c, 23) * 8;
    const head = frac((t * vc + phase) / L) * L;
    const d = (((head - rowFromTop) % L) + L) % L;
    let streak = Math.pow(clamp(1 - d / tailLen, 0, 1), 1.5);
    const flick = seededNoise(note, Math.floor(t * flickRate)) > 0.5 - 0.2 * e ? 1 : 0;
    streak *= 0.55 + 0.45 * flick;
    const rain = mixHex(ctx.secondary, ctx.primary, streak);
    const withHead = mixHex(rain, "#FFFFFF", clamp(0.6 - d, 0, 1));
    putHex(out, note, mixHex(bg, withHead, streak));
  }
}

function renderLavaLamp(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const w = 0.2 + s * 1.2;
  const count = Math.round(pn(ctx, "blobCount", 4));
  const thr = 1.6 - e * 0.7;
  const fx = [0.5, 0.7, 0.9, 1.1, 0.6];
  const fy = [0.6, 0.8, 0.4, 1.0, 0.9];
  const c1 = hexToHsl(ctx.primary);
  const c2 = hexToHsl(ctx.secondary);

  const bx: number[] = [];
  const by: number[] = [];
  const br: number[] = [];
  for (let i = 0; i < count; i += 1) {
    bx[i] = 4 + 2.6 * Math.sin(t * w * fx[i % 5] + i * 1.7);
    by[i] = 4 + 2.6 * Math.cos(t * w * fy[i % 5] + i * 2.3);
    br[i] = 1.6 + 0.4 * Math.sin(t * w * 0.5 + i);
  }

  for (let note = 0; note < 64; note += 1) {
    const cx = columnOf(note) + 0.5;
    const cy = rowFromTopOf(note) + 0.5;
    let field = 0;
    for (let i = 0; i < count; i += 1) {
      field += (br[i] * br[i]) / ((cx - bx[i]) * (cx - bx[i]) + (cy - by[i]) * (cy - by[i]) + 0.6);
    }
    const m = smoothstep(thr * 0.7, thr * 1.3, field);
    const rim = smoothstep(thr * 0.7, thr, field) * (1 - smoothstep(thr, thr * 1.3, field));
    const hue = lerpHue(c2.h, c1.h, m);
    const sat = Math.max(lerp(c2.s, c1.s, m), m > 0.5 ? 70 : 0);
    const light = clamp(lerp(8, 50, m) + 18 * rim, 0, 70);
    put(out, note, hslToRgb(hue, sat, light));
  }
}

function renderSpectrumBars(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const amp = 0.4 + e * 0.9;
  const spd = 0.8 + s * 4;
  const orientation = ps(ctx, "orientation", "vertical");
  const usePeak = pb(ctx, "peakHold", true);
  const fallRate = pn(ctx, "fallRate", 3);
  const mirror = pb(ctx, "mirror", false);

  const state = ctx.state as { peak?: number[]; lastT?: number };
  if (!state.peak) {
    state.peak = new Array(8).fill(0);
    state.lastT = t;
  }
  const dt = Math.max(0, Math.min(0.2, t - (state.lastT ?? t)));
  state.lastT = t;

  const levels: number[] = [];
  for (let c = 0; c < 8; c += 1) {
    const raw =
      0.5 +
      0.3 * Math.sin(t * spd + c * 0.85) +
      0.18 * Math.sin(t * spd * 1.63 + c * 1.7 + 1.3) +
      0.12 * Math.sin(t * spd * 2.41 + c * 0.4 + 2.1);
    const level = clamp(0.5 + (raw - 0.5) * amp * 2, 0, 1);
    levels[c] = level * 8;
    const peak = state.peak[c];
    state.peak[c] = levels[c] >= peak ? levels[c] : Math.max(0, peak - fallRate * dt);
  }

  for (let note = 0; note < 64; note += 1) {
    const column = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    const axis = orientation === "horizontal" ? rowFromTop : column;
    let hb = orientation === "horizontal" ? column : 7 - rowFromTop; // height from bottom
    const hc = levels[axis];
    let frac01 = hb / 7;
    if (mirror) {
      const distFromCenter = Math.abs(hb - 3.5);
      hb = distFromCenter * 2;
      frac01 = 1 - distFromCenter / 3.5;
    }
    const fill = clamp(hc - hb, 0, 1);
    const body = mixHex(ctx.secondary, ctx.primary, clamp(frac01, 0, 1));
    const tip = smoothstep(0.6, 1, fill);
    const colColor = mixHex(body, "#FFFFFF", tip * 0.55);
    const peakMarker = usePeak && Math.round(state.peak[axis]) === hb;
    if (hb < hc - 1) {
      putHex(out, note, mixHex("#000000", colColor, 0.9));
    } else if (fill > 0) {
      putHex(out, note, mixHex("#000000", colColor, 0.35 + 0.65 * fill));
    } else if (peakMarker) {
      putHex(out, note, mixHex(ctx.primary, "#FFFFFF", 0.5));
    } else {
      putHex(out, note, "#000000");
    }
  }
}

function renderInterferencePool(out: Rgb[], t: number, ctx: AnimationRenderContext) {
  const s = ctx.speed / 10;
  const e = ctx.intensity / 10;
  const base = 1 + s * 4;
  const k = 1.1;
  const exp = 1 + e * 3;
  const twinkle = pn(ctx, "twinkle", 0.3);
  let sources = Math.round(pn(ctx, "sources", 2));
  if (e > 0.7) {
    sources = 3;
  }
  const sx = [1, 6.5, 3.5];
  const sy = [1, 6, 7];

  for (let note = 0; note < 64; note += 1) {
    const column = columnOf(note);
    const rowFromTop = rowFromTopOf(note);
    let field = 0;
    for (let i = 0; i < sources; i += 1) {
      const d = Math.sqrt((column - sx[i]) * (column - sx[i]) + (rowFromTop - sy[i]) * (rowFromTop - sy[i]));
      field += Math.sin(d * k - t * (base * (1 + 0.07 * i)));
    }
    field /= sources;
    let v = Math.pow((field + 1) / 2, exp);
    v *= 1 - twinkle + twinkle * valueNoise2D(column * 0.5 + t * 0.4, rowFromTop * 0.5);
    const baseColor = mixHex(ctx.secondary, ctx.primary, smoothstep(0.45, 0.95, v));
    const hot = smoothstep(0.9, 1, v);
    const color = mixHex(baseColor, "#FFFFFF", hot * 0.6);
    putHex(out, note, mixHex("#000000", color, clamp(0.08 + v * 0.95, 0, 1)));
  }
}

// ---------------------------------------------------------------------------

export const ANIMATIONS: AnimationDefinition[] = [
  {
    id: "plasma",
    nameJa: "プラズマ",
    nameEn: "Plasma Field",
    family: "Flow",
    description: "重なる4つの正弦波が溶け合う、エッジのない液状の2色フィールド。",
    render: renderPlasma,
    extras: [{ kind: "number", key: "hueDrift", label: "色相ドリフト", min: 0, max: 30, step: 1, default: 0 }],
  },
  {
    id: "rainbowSweep",
    nameJa: "虹の波",
    nameEn: "Rainbow Sweep",
    family: "Light",
    description: "フルスペクトルの帯が斜めに流れ、明るさの稜線が走る。",
    render: renderRainbowSweep,
    extras: [
      { kind: "number", key: "sweepAngle", label: "角度", min: 0, max: 360, step: 15, default: 45 },
      { kind: "number", key: "hueSpreadDeg", label: "色幅", min: 5, max: 60, step: 1, default: 38 },
      { kind: "bool", key: "fullSpectrum", label: "フルスペクトル", default: true },
    ],
  },
  {
    id: "aurora",
    nameJa: "オーロラ",
    nameEn: "Aurora Curtains",
    family: "Flow",
    description: "上から垂れる光のカーテンが横に揺らめき、絹のように波打つ。",
    render: renderAurora,
    extras: [{ kind: "number", key: "curtainCount", label: "カーテン数", min: 1, max: 3, step: 1, default: 2 }],
  },
  {
    id: "rippleRings",
    nameJa: "波紋リング",
    nameEn: "Concentric Ripples",
    family: "Wave",
    description: "静水に落ちた雫のように、白く輝く同心円が広がる。",
    render: renderRippleRings,
    extras: [
      { kind: "number", key: "freq", label: "リング密度", min: 0.6, max: 2, step: 0.05, default: 1.15 },
      {
        kind: "enum",
        key: "center",
        label: "中心",
        default: "drift",
        options: [
          { value: "drift", label: "ドリフト" },
          { value: "fixed-center", label: "中央固定" },
          { value: "corner", label: "角" },
        ],
      },
    ],
  },
  {
    id: "comet",
    nameJa: "流星",
    nameEn: "Comet Trails",
    family: "Particle",
    description: "白熱した点が斜めに駆け、滑らかな尾を引いて端で循環する。",
    render: renderComet,
    extras: [
      { kind: "number", key: "cometCount", label: "流星の数", min: 1, max: 3, step: 1, default: 2 },
      { kind: "number", key: "angle", label: "角度", min: 0, max: 360, step: 15, default: 45 },
    ],
  },
  {
    id: "emberFlame",
    nameJa: "灯火",
    nameEn: "Ember Flame",
    family: "Light",
    description: "底から立ち上る炎。残り火からオレンジ、白熱した炎先へ。",
    render: renderEmberFlame,
    extras: [
      {
        kind: "enum",
        key: "baseEdge",
        label: "燃える辺",
        default: "bottom",
        options: [
          { value: "bottom", label: "下" },
          { value: "top", label: "上" },
          { value: "left", label: "左" },
          { value: "right", label: "右" },
        ],
      },
    ],
  },
  {
    id: "lavaLamp",
    nameJa: "ラバランプ",
    nameEn: "Lava Lamp",
    family: "Flow",
    description: "暖色のメタボールが漂い、膨らみ、融合・分裂する。",
    render: renderLavaLamp,
    extras: [{ kind: "number", key: "blobCount", label: "ブロブ数", min: 2, max: 5, step: 1, default: 4 }],
  },
  {
    id: "spectrumBars",
    nameJa: "スペクトラムVU",
    nameEn: "Spectrum Bars",
    family: "Meter",
    description: "8本のバーが音楽スペクトラムのように弾み、ピークが落ちる。",
    render: renderSpectrumBars,
    extras: [
      {
        kind: "enum",
        key: "orientation",
        label: "向き",
        default: "vertical",
        options: [
          { value: "vertical", label: "縦" },
          { value: "horizontal", label: "横" },
        ],
      },
      { kind: "bool", key: "peakHold", label: "ピークホールド", default: true },
      { kind: "number", key: "fallRate", label: "落下速度", min: 1, max: 6, step: 0.5, default: 3 },
      { kind: "bool", key: "mirror", label: "中央対称", default: false },
    ],
  },
  {
    id: "matrixRain",
    nameJa: "デジタルレイン",
    nameEn: "Matrix Rain",
    family: "Particle",
    description: "光の雨が列ごとに落下。白い頭、緑の尾、明滅するセル。",
    render: renderMatrixRain,
    extras: [],
  },
  {
    id: "fireworks",
    nameJa: "花火",
    nameEn: "Fireworks",
    family: "Particle",
    description: "打ち上がり弾ける火花のリング。星の瞬きの上で咲いては散る。",
    render: renderFireworks,
    extras: [{ kind: "number", key: "gravity", label: "重力", min: 0, max: 1, step: 0.05, default: 0.6 }],
  },
  {
    id: "spiralPinwheel",
    nameJa: "光の渦",
    nameEn: "Light Pinwheel",
    family: "Light",
    description: "中心から渦巻く光の羽根が回転する。ねじれ0でレーダー風。",
    render: renderSpiralPinwheel,
    extras: [
      { kind: "number", key: "arms", label: "羽根の数", min: 2, max: 6, step: 1, default: 3 },
      { kind: "number", key: "twist", label: "ねじれ", min: -1.2, max: 1.2, step: 0.1, default: 0.6 },
    ],
  },
  {
    id: "interferencePool",
    nameJa: "干渉プール",
    nameEn: "Interference Pool",
    family: "Wave",
    description: "複数の波源が干渉し、プール底の光のように揺らめく。",
    render: renderInterferencePool,
    extras: [
      { kind: "number", key: "sources", label: "波源数", min: 2, max: 3, step: 1, default: 2 },
      { kind: "number", key: "twinkle", label: "きらめき", min: 0, max: 1, step: 0.05, default: 0.3 },
    ],
  },
];

export const ANIMATION_DEFAULT_ID = "plasma";

export const ANIMATION_BY_ID = new Map(ANIMATIONS.map((animation) => [animation.id, animation]));

export function animationById(id: string) {
  return ANIMATION_BY_ID.get(id) ?? ANIMATIONS[0];
}

export function defaultExtras(animation: AnimationDefinition): Record<string, number | boolean | string> {
  const result: Record<string, number | boolean | string> = {};
  for (const param of animation.extras) {
    result[param.key] = param.default;
  }
  return result;
}

export function createRgbBuffer(): Rgb[] {
  return Array.from({ length: 64 }, () => ({ r: 0, g: 0, b: 0 }));
}
