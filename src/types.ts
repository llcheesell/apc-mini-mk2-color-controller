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

export type AnimationModeId = "gaming" | "code" | "beauty" | "life";

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

export interface AnimationSettings {
  activeMode: AnimationModeId | null;
  primaryColor: string;
  secondaryColor: string;
  speed: number;
  intensity: number;
  liveOutput: boolean;
}

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

export interface MidiAccessLike {
  outputs: Iterable<MidiOutputLike> | Map<string, MidiOutputLike>;
  sysexEnabled?: boolean;
  onstatechange: ((event: Event) => void) | null;
}

export type RequestMidiAccess = (options?: { sysex?: boolean }) => Promise<MidiAccessLike>;

declare global {
  interface Window {
    apcDesktop?: {
      quit: () => Promise<void>;
      platform: string;
    };
  }
}
