import type { BehaviorId, LayoutState, PadConfig, SingleLedMode } from "./types";

export const PAD_COUNT = 64;
export const TRACK_BUTTON_COUNT = 8;
export const SCENE_BUTTON_COUNT = 8;

export const TRACK_BUTTON_NOTES = Array.from({ length: TRACK_BUTTON_COUNT }, (_, index) => 0x64 + index);
export const SCENE_BUTTON_NOTES = Array.from({ length: SCENE_BUTTON_COUNT }, (_, index) => 0x70 + index);

export const BEHAVIORS: Array<{
  id: BehaviorId;
  label: string;
  channel: number;
  kind: "solid" | "pulse" | "blink";
  brightness: number;
}> = [
  { id: "solid-10", label: "10%", channel: 0, kind: "solid", brightness: 0.1 },
  { id: "solid-25", label: "25%", channel: 1, kind: "solid", brightness: 0.25 },
  { id: "solid-50", label: "50%", channel: 2, kind: "solid", brightness: 0.5 },
  { id: "solid-65", label: "65%", channel: 3, kind: "solid", brightness: 0.65 },
  { id: "solid-75", label: "75%", channel: 4, kind: "solid", brightness: 0.75 },
  { id: "solid-90", label: "90%", channel: 5, kind: "solid", brightness: 0.9 },
  { id: "solid-100", label: "100%", channel: 6, kind: "solid", brightness: 1 },
  { id: "pulse-16", label: "Pulse 1/16", channel: 7, kind: "pulse", brightness: 1 },
  { id: "pulse-8", label: "Pulse 1/8", channel: 8, kind: "pulse", brightness: 1 },
  { id: "pulse-4", label: "Pulse 1/4", channel: 9, kind: "pulse", brightness: 1 },
  { id: "pulse-2", label: "Pulse 1/2", channel: 10, kind: "pulse", brightness: 1 },
  { id: "blink-24", label: "Blink 1/24", channel: 11, kind: "blink", brightness: 1 },
  { id: "blink-16", label: "Blink 1/16", channel: 12, kind: "blink", brightness: 1 },
  { id: "blink-8", label: "Blink 1/8", channel: 13, kind: "blink", brightness: 1 },
  { id: "blink-4", label: "Blink 1/4", channel: 14, kind: "blink", brightness: 1 },
  { id: "blink-2", label: "Blink 1/2", channel: 15, kind: "blink", brightness: 1 },
];

export const DEFAULT_BEHAVIOR_ID: BehaviorId = "solid-100";

export const PALETTE_COLORS = [
  "#000000",
  "#1E1E1E",
  "#7F7F7F",
  "#FFFFFF",
  "#FF4C4C",
  "#FF0000",
  "#590000",
  "#190000",
  "#FFBD6C",
  "#FF5400",
  "#591D00",
  "#271B00",
  "#FFFF4C",
  "#FFFF00",
  "#595900",
  "#191900",
  "#88FF4C",
  "#54FF00",
  "#1D5900",
  "#142B00",
  "#4CFF4C",
  "#00FF00",
  "#005900",
  "#001900",
  "#4CFF5E",
  "#00FF19",
  "#00590D",
  "#001902",
  "#4CFF88",
  "#00FF55",
  "#00591D",
  "#001F12",
  "#4CFFB7",
  "#00FF99",
  "#005935",
  "#001912",
  "#4CC3FF",
  "#00A9FF",
  "#004152",
  "#001019",
  "#4C88FF",
  "#0055FF",
  "#001D59",
  "#000819",
  "#4C4CFF",
  "#0000FF",
  "#000059",
  "#000019",
  "#874CFF",
  "#5400FF",
  "#190064",
  "#0F0030",
  "#FF4CFF",
  "#FF00FF",
  "#590059",
  "#190019",
  "#FF4C87",
  "#FF0054",
  "#59001D",
  "#220013",
  "#FF1500",
  "#993500",
  "#795100",
  "#436400",
  "#033900",
  "#005735",
  "#00547F",
  "#0000FF",
  "#00454F",
  "#2500CC",
  "#7F7F7F",
  "#202020",
  "#FF0000",
  "#BDFF2D",
  "#AFED06",
  "#64FF09",
  "#108B00",
  "#00FF87",
  "#00A9FF",
  "#002AFF",
  "#3F00FF",
  "#7A00FF",
  "#B21A7D",
  "#402100",
  "#FF4A00",
  "#88E106",
  "#72FF15",
  "#00FF00",
  "#3BFF26",
  "#59FF71",
  "#38FFCC",
  "#5B8AFF",
  "#3151C6",
  "#877FE9",
  "#D31DFF",
  "#FF005D",
  "#FF7F00",
  "#B9B000",
  "#90FF00",
  "#835D07",
  "#392B00",
  "#144C10",
  "#0D5038",
  "#15152A",
  "#16205A",
  "#693C1C",
  "#A8000A",
  "#DE513D",
  "#D86A1C",
  "#FFE126",
  "#9EE12F",
  "#67B50F",
  "#1E1E30",
  "#DCFF6B",
  "#80FFBD",
  "#9A99FF",
  "#8E66FF",
  "#404040",
  "#757575",
  "#E0FFFF",
  "#A00000",
  "#350000",
  "#1AD000",
  "#074200",
  "#B9B000",
  "#3F3100",
  "#B35F00",
  "#4B1502",
] as const;

export const QUICK_SWATCHES = [
  "#000000",
  "#FFFFFF",
  "#FF0000",
  "#FF5400",
  "#FFFF00",
  "#54FF00",
  "#00FF99",
  "#00A9FF",
  "#0055FF",
  "#7A00FF",
  "#FF00FF",
  "#FF0054",
];

export function padNoteFromView(rowFromTop: number, column: number) {
  return (7 - rowFromTop) * 8 + column;
}

export function padViewPosition(note: number) {
  return {
    rowFromTop: 7 - Math.floor(note / 8),
    column: note % 8,
  };
}

export function noteHex(note: number) {
  return `0x${note.toString(16).toUpperCase().padStart(2, "0")}`;
}

export function behaviorById(id: BehaviorId) {
  return BEHAVIORS.find((behavior) => behavior.id === id) ?? BEHAVIORS[6];
}

export function normalizeHex(hex: string) {
  if (/^#[\da-f]{6}$/i.test(hex)) {
    return hex.toUpperCase();
  }
  return "#000000";
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function nearestPaletteVelocity(hex: string) {
  const target = hexToRgb(hex);
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  PALETTE_COLORS.forEach((candidate, velocity) => {
    const rgb = hexToRgb(candidate);
    const distance =
      (target.r - rgb.r) ** 2 +
      (target.g - rgb.g) ** 2 +
      (target.b - rgb.b) ** 2;

    if (distance < nearestDistance) {
      nearest = velocity;
      nearestDistance = distance;
    }
  });

  return nearest;
}

export function buildPalettePadMessage(note: number, pad: PadConfig) {
  const behavior = behaviorById(pad.behaviorId);
  return [0x90 + behavior.channel, note, nearestPaletteVelocity(pad.color)];
}

export function buildSingleLedMessage(note: number, mode: SingleLedMode) {
  const velocity = mode === "off" ? 0x00 : mode === "blink" ? 0x02 : 0x01;
  return [0x90, note, velocity];
}

// The APC mini mk2 silently truncates a single SysEx after ~256 data bytes
// (32 pads of 8 bytes each), so a 64-pad message only lights the first half.
// Cap each RGB SysEx well under that limit so every pad updates.
export const MAX_PADS_PER_SYSEX = 8;

function buildRgbSysExChunk(pairs: Array<{ note: number; color: string; behaviorId: BehaviorId }>) {
  const payload = pairs.flatMap(({ note, color, behaviorId }) => {
    const behavior = behaviorById(behaviorId);
    const rgb = scaleRgb(hexToRgb(color), behavior.brightness);
    const red = splitToMidi7Bit(rgb.r);
    const green = splitToMidi7Bit(rgb.g);
    const blue = splitToMidi7Bit(rgb.b);

    return [note, note, red.msb, red.lsb, green.msb, green.lsb, blue.msb, blue.lsb];
  });

  const length = payload.length;
  return [0xf0, 0x47, 0x7f, 0x4f, 0x24, (length >> 7) & 0x7f, length & 0x7f, ...payload, 0xf7];
}

export function buildExactRgbSysEx(pairs: Array<{ note: number; color: string; behaviorId: BehaviorId }>) {
  const messages: number[][] = [];
  for (let index = 0; index < pairs.length; index += MAX_PADS_PER_SYSEX) {
    messages.push(buildRgbSysExChunk(pairs.slice(index, index + MAX_PADS_PER_SYSEX)));
  }
  return messages;
}

// Fast path for the animation/reactive engines: build chunked RGB SysEx directly
// from raw 0-255 channel values (no behavior lookup / palette math). Each entry is
// a pad already known to have changed, so callers pass only the diff.
export function buildRgbSysExForPads(entries: Array<{ note: number; r: number; g: number; b: number }>) {
  const messages: number[][] = [];
  for (let index = 0; index < entries.length; index += MAX_PADS_PER_SYSEX) {
    const slice = entries.slice(index, index + MAX_PADS_PER_SYSEX);
    const payload = slice.flatMap(({ note, r, g, b }) => {
      const red = splitToMidi7Bit(r);
      const green = splitToMidi7Bit(g);
      const blue = splitToMidi7Bit(b);
      return [note, note, red.msb, red.lsb, green.msb, green.lsb, blue.msb, blue.lsb];
    });
    const length = payload.length;
    messages.push([0xf0, 0x47, 0x7f, 0x4f, 0x24, (length >> 7) & 0x7f, length & 0x7f, ...payload, 0xf7]);
  }
  return messages;
}

export function messagesForLayout(
  layout: LayoutState,
  options: { preferExactRgb: boolean; sysexEnabled: boolean },
) {
  const messages: number[][] = [];
  const exactRgbPairs: Array<{ note: number; color: string; behaviorId: BehaviorId }> = [];
  let paletteFallbacks = 0;

  layout.pads.forEach((pad, note) => {
    const behavior = behaviorById(pad.behaviorId);
    const canUseExact = options.preferExactRgb && options.sysexEnabled && behavior.kind === "solid";

    if (canUseExact) {
      exactRgbPairs.push({ note, color: pad.color, behaviorId: pad.behaviorId });
      return;
    }

    if (options.preferExactRgb && behavior.kind === "solid" && !options.sysexEnabled) {
      paletteFallbacks += 1;
    }

    messages.push(buildPalettePadMessage(note, pad));
  });

  if (exactRgbPairs.length > 0) {
    messages.unshift(...buildExactRgbSysEx(exactRgbPairs));
  }

  layout.trackButtons.forEach((button, index) => {
    messages.push(buildSingleLedMessage(TRACK_BUTTON_NOTES[index], button.mode));
  });

  layout.sceneButtons.forEach((button, index) => {
    messages.push(buildSingleLedMessage(SCENE_BUTTON_NOTES[index], button.mode));
  });

  return {
    messages,
    usedSysEx: exactRgbPairs.length > 0,
    paletteFallbacks,
  };
}

function splitToMidi7Bit(value: number) {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return {
    msb: (clamped >> 7) & 0x7f,
    lsb: clamped & 0x7f,
  };
}

function scaleRgb(rgb: { r: number; g: number; b: number }, brightness: number) {
  return {
    r: rgb.r * brightness,
    g: rgb.g * brightness,
    b: rgb.b * brightness,
  };
}
