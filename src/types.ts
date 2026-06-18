export type BehaviorId =
  | "solid-10"
  | "solid-25"
  | "solid-50"
  | "solid-65"
  | "solid-75"
  | "solid-90"
  | "solid-100"
  | "pulse-16"
  | "pulse-8"
  | "pulse-4"
  | "pulse-2"
  | "blink-24"
  | "blink-16"
  | "blink-8"
  | "blink-4"
  | "blink-2";

export type SingleLedMode = "off" | "on" | "blink";

export interface PadConfig {
  color: string;
  behaviorId: BehaviorId;
  label: string;
}

export interface SingleLedConfig {
  mode: SingleLedMode;
  label: string;
}

export interface LayoutState {
  pads: PadConfig[];
  trackButtons: SingleLedConfig[];
  sceneButtons: SingleLedConfig[];
}

export interface LayoutPreset {
  id: string;
  name: string;
  pads: PadConfig[];
  trackButtons: SingleLedConfig[];
  sceneButtons: SingleLedConfig[];
}

export interface AppSettings {
  preferExactRgb: boolean;
  releaseAfterSend: boolean;
}

export interface GridColorSettings {
  rows: string[];
  columns: string[];
}

// Top-level mutually-exclusive workspace modes.
export type AppMode = "design" | "animation" | "reactive";

// Editing tools in design mode.
export type BrushTool = "brush" | "eyedropper" | "eraser";

export interface BrushState {
  color: string;
  behaviorId: BehaviorId;
  tool: BrushTool;
  recent: string[];
}

// ---- Animation system ----

export type AnimationParamValue = number | boolean | string;

export interface AnimationNumberParam {
  kind: "number";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface AnimationBoolParam {
  kind: "bool";
  key: string;
  label: string;
  default: boolean;
}

export interface AnimationEnumParam {
  kind: "enum";
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  default: string;
}

export type AnimationParamSpec = AnimationNumberParam | AnimationBoolParam | AnimationEnumParam;

export interface AnimationDefinition {
  id: string;
  nameJa: string;
  nameEn: string;
  family: string;
  description: string;
  // Fills `out` (64 RGB entries, indexed by note 0-63) for elapsed time `t` seconds.
  render: (out: Array<{ r: number; g: number; b: number }>, t: number, ctx: AnimationRenderContext) => void;
  extras: AnimationParamSpec[];
}

export interface AnimationRenderContext {
  speed: number;
  intensity: number;
  primary: string;
  secondary: string;
  params: Record<string, AnimationParamValue>;
  state: Record<string, unknown>;
}

export interface AnimationState {
  modeId: string;
  speed: number;
  intensity: number;
  primary: string;
  secondary: string;
  extras: Record<string, Record<string, AnimationParamValue>>;
  playing: boolean;
  armed: boolean;
}

// ---- Reactive (MIDI note input) system ----

export type ReactiveBehaviorId = "ripple" | "glow" | "heat" | "trails";

export type ReactiveNoteMapping = "direct" | "musical" | "chromatic";

export interface ReactiveConfig {
  behavior: ReactiveBehaviorId;
  accent: string;
  base: string;
  decayPerSec: number;
  spread: number;
  intensity: number;
  rippleLifeMs: number;
  rippleSpeed: number;
  mapping: ReactiveNoteMapping;
  armed: boolean;
}

// ---- Saved library slots ----

export interface SavedSlot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  layout: LayoutState;
  gridColors?: GridColorSettings;
}

// ---- Web MIDI shims ----

export interface MidiOutputLike {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: string;
  connection?: string;
  send(data: number[] | Uint8Array, timestamp?: number): void;
  open?: () => Promise<unknown>;
  close?: () => Promise<unknown>;
}

export interface MidiMessageEventLike {
  data: Uint8Array;
  timeStamp: number;
}

export interface MidiInputLike {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
  addEventListener?: (type: "midimessage", listener: (event: MidiMessageEventLike) => void) => void;
  removeEventListener?: (type: "midimessage", listener: (event: MidiMessageEventLike) => void) => void;
  open?: () => Promise<unknown>;
}

export interface MidiAccessLike {
  outputs: Iterable<MidiOutputLike> | Map<string, MidiOutputLike>;
  inputs: Iterable<MidiInputLike> | Map<string, MidiInputLike>;
  sysexEnabled?: boolean;
  onstatechange: ((event: Event) => void) | null;
  addEventListener?: (type: "statechange", listener: (event: Event) => void) => void;
  removeEventListener?: (type: "statechange", listener: (event: Event) => void) => void;
}

export type RequestMidiAccess = (options?: { sysex?: boolean }) => Promise<MidiAccessLike>;

export type MidiNoteEvent = {
  type: "noteon" | "noteoff";
  note: number;
  pad: number | null;
  velocity: number;
  channel: number;
  sourceId: string;
  isApc: boolean;
  time: number;
};

export type MidiCcEvent = {
  type: "cc";
  controller: number;
  value: number;
  sourceId: string;
  time: number;
};

declare global {
  interface Window {
    apcDesktop?: {
      quit: () => Promise<void>;
      platform: string;
    };
  }
}
