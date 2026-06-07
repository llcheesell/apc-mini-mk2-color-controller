import { DEFAULT_BEHAVIOR_ID, hexToRgb, normalizeHex, padViewPosition } from "./apcProtocol";
import type { AnimationModeId, AnimationSettings, LayoutState, PadConfig } from "./types";

export const ANIMATION_MODES: Array<{
  id: AnimationModeId;
  name: string;
  shortName: string;
}> = [
  { id: "gaming", name: "ゲーミング", shortName: "Game" },
  { id: "code", name: "コード", shortName: "Code" },
  { id: "beauty", name: "ビューティ", shortName: "Flow" },
  { id: "life", name: "ライフゲーム", shortName: "Life" },
];

export function animationDelayMs(speed: number) {
  return Math.round(620 - clamp(speed, 1, 10) * 48);
}

export function animationLayoutForFrame(
  baseLayout: LayoutState,
  settings: AnimationSettings,
  frame: number,
): LayoutState {
  if (!settings.activeMode) {
    return baseLayout;
  }

  const pads = Array.from({ length: 64 }, (_, note) =>
    padForAnimation(settings.activeMode as AnimationModeId, settings, frame, note),
  );

  return {
    ...baseLayout,
    pads,
  };
}

function padForAnimation(
  mode: AnimationModeId,
  settings: AnimationSettings,
  frame: number,
  note: number,
): PadConfig {
  const position = padViewPosition(note);
  const t = frame * (0.06 + settings.speed * 0.015);
  const intensity = clamp(settings.intensity / 10, 0.1, 1);

  if (mode === "gaming") {
    const hue = (position.column * 38 + position.rowFromTop * 22 + frame * (8 + settings.speed * 1.5)) % 360;
    const strobe = (Math.sin(t * 4 + position.column * 0.8) + 1) / 2;
    const flash = Math.max(0, Math.sin(t * 7 - position.rowFromTop));
    const light = 34 + 42 * strobe + 20 * flash * intensity;
    return createPad(hslToHex(hue, 92, light), "FX");
  }

  if (mode === "code") {
    const head = Math.floor((frame / Math.max(1, 11 - settings.speed)) % 8);
    const stream = (position.column * 3 + position.rowFromTop + Math.floor(frame / 2)) % 8;
    const active = stream === 0 || position.rowFromTop === head;
    const flicker = seededNoise(note, Math.floor(frame / 3)) > 0.74 - intensity * 0.2;
    const color = active || flicker
      ? mixHex(settings.primaryColor, settings.secondaryColor, active ? 0.35 : 0.08)
      : mixHex("#000000", settings.primaryColor, 0.08 + intensity * 0.06);
    return createPad(color, active ? "RUN" : "bit");
  }

  if (mode === "beauty") {
    const waveA = (Math.sin(t + position.column * 0.72) + 1) / 2;
    const waveB = (Math.sin(t * 0.74 + position.rowFromTop * 0.62) + 1) / 2;
    const mix = clamp((waveA + waveB) / 2, 0, 1);
    const soft = mixHex(settings.primaryColor, settings.secondaryColor, mix);
    const glow = mixHex("#FFFFFF", soft, 0.68 + intensity * 0.28);
    return createPad(glow, "Flow");
  }

  const life = lifeCell(note, Math.floor(frame / Math.max(1, 11 - settings.speed)));
  const trail = lifeCell(note, Math.floor(frame / Math.max(1, 11 - settings.speed)) - 1);
  const color = life
    ? settings.primaryColor
    : trail
      ? mixHex(settings.primaryColor, settings.secondaryColor, 0.38)
      : mixHex("#000000", settings.secondaryColor, 0.08 + intensity * 0.04);
  return createPad(color, life ? "Life" : "Cell");
}

function createPad(color: string, label: string): PadConfig {
  return {
    color: normalizeHex(color),
    behaviorId: DEFAULT_BEHAVIOR_ID,
    label,
  };
}

function lifeCell(note: number, generation: number) {
  let cells = Array.from({ length: 64 }, (_, index) => seededNoise(index, 17) > 0.62);
  const steps = ((generation % 48) + 48) % 48;

  for (let step = 0; step < steps; step += 1) {
    cells = cells.map((alive, index) => {
      const neighbors = countNeighbors(cells, index);
      return alive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
    });
  }

  return cells[note];
}

function countNeighbors(cells: boolean[], note: number) {
  const x = note % 8;
  const y = Math.floor(note / 8);
  let count = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const nx = (x + dx + 8) % 8;
      const ny = (y + dy + 8) % 8;
      if (cells[ny * 8 + nx]) {
        count += 1;
      }
    }
  }

  return count;
}

function mixHex(a: string, b: string, amount: number) {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  const blend = clamp(amount, 0, 1);

  return rgbToHex({
    r: first.r + (second.r - first.r) * blend,
    g: first.g + (second.g - first.g) * blend,
    b: first.b + (second.b - first.b) * blend,
  });
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = clamp(s / 100, 0, 1);
  const lightness = clamp(l / 100, 0, 1);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;
  const [r, g, b] =
    segment < 1
      ? [chroma, x, 0]
      : segment < 2
        ? [x, chroma, 0]
        : segment < 3
          ? [0, chroma, x]
          : segment < 4
            ? [0, x, chroma]
            : segment < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return rgbToHex({
    r: (r + match) * 255,
    g: (g + match) * 255,
    b: (b + match) * 255,
  });
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function toHex(value: number) {
  return Math.round(clamp(value, 0, 255)).toString(16).toUpperCase().padStart(2, "0");
}

function seededNoise(index: number, seed: number) {
  const value = Math.sin(index * 127.13 + seed * 41.91) * 10000;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
