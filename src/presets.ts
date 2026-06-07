import { DEFAULT_BEHAVIOR_ID, PAD_COUNT, SCENE_BUTTON_COUNT, TRACK_BUTTON_COUNT } from "./apcProtocol";
import type { BehaviorId, LayoutPreset, LayoutState, PadConfig, SingleLedConfig } from "./types";

const offSingle = (label: string): SingleLedConfig => ({ mode: "off", label });

export function createBlankLayout(): LayoutState {
  return {
    pads: Array.from({ length: PAD_COUNT }, (_, note) => createPad("#000000", DEFAULT_BEHAVIOR_ID, `Pad ${note + 1}`)),
    trackButtons: Array.from({ length: TRACK_BUTTON_COUNT }, (_, index) => offSingle(`Track ${index + 1}`)),
    sceneButtons: Array.from({ length: SCENE_BUTTON_COUNT }, (_, index) => offSingle(`Scene ${index + 1}`)),
  };
}

export const PRESETS: LayoutPreset[] = [
  {
    id: "blank",
    name: "消灯",
    ...createBlankLayout(),
  },
  {
    id: "rows",
    name: "行カラー",
    ...layoutFromRows(["#FF0054", "#FF5400", "#FFE126", "#54FF00", "#00FF99", "#00A9FF", "#0055FF", "#7A00FF"]),
  },
  {
    id: "columns",
    name: "列カラー",
    ...layoutFromColumns(["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#00FF99", "#00A9FF", "#3F00FF", "#FF00FF"]),
  },
  {
    id: "unity",
    name: "Unity識別",
    ...layoutFromBlocks([
      ["#0055FF", "Player"],
      ["#00A9FF", "Camera"],
      ["#00FF99", "Audio"],
      ["#54FF00", "Cue"],
      ["#FFE126", "Time"],
      ["#FF7F00", "FX"],
      ["#FF0054", "Stop"],
      ["#8E66FF", "Tool"],
    ]),
  },
  {
    id: "traffic",
    name: "状態",
    ...layoutFromStatusZones(),
  },
  {
    id: "checker",
    name: "市松",
    ...layoutFromChecker(),
  },
];

function createPad(color: string, behaviorId: BehaviorId, label: string): PadConfig {
  return { color, behaviorId, label };
}

function singleButtons(trackMode: SingleLedConfig["mode"] = "off", sceneMode: SingleLedConfig["mode"] = "off") {
  return {
    trackButtons: Array.from({ length: TRACK_BUTTON_COUNT }, (_, index) => ({ mode: trackMode, label: `Track ${index + 1}` })),
    sceneButtons: Array.from({ length: SCENE_BUTTON_COUNT }, (_, index) => ({ mode: sceneMode, label: `Scene ${index + 1}` })),
  };
}

function layoutFromRows(colorsTopToBottom: string[]): LayoutState {
  const layout = createBlankLayout();

  for (let rowTop = 0; rowTop < 8; rowTop += 1) {
    for (let column = 0; column < 8; column += 1) {
      const note = (7 - rowTop) * 8 + column;
      layout.pads[note] = createPad(colorsTopToBottom[rowTop], "solid-100", `Row ${rowTop + 1}`);
    }
  }

  return { ...layout, ...singleButtons("on", "on") };
}

function layoutFromColumns(colorsLeftToRight: string[]): LayoutState {
  const layout = createBlankLayout();

  for (let rowTop = 0; rowTop < 8; rowTop += 1) {
    for (let column = 0; column < 8; column += 1) {
      const note = (7 - rowTop) * 8 + column;
      layout.pads[note] = createPad(colorsLeftToRight[column], "solid-100", `Col ${column + 1}`);
    }
  }

  return { ...layout, ...singleButtons("on", "on") };
}

function layoutFromBlocks(blocks: Array<[string, string]>): LayoutState {
  const layout = createBlankLayout();

  for (let rowTop = 0; rowTop < 8; rowTop += 1) {
    const [color, label] = blocks[rowTop];
    for (let column = 0; column < 8; column += 1) {
      const note = (7 - rowTop) * 8 + column;
      layout.pads[note] = createPad(color, "solid-100", label);
    }
  }

  layout.trackButtons = layout.trackButtons.map((button, index) => ({ ...button, mode: index < 4 ? "on" : "off" }));
  layout.sceneButtons = layout.sceneButtons.map((button, index) => ({ ...button, mode: index < 4 ? "on" : "blink" }));
  return layout;
}

function layoutFromStatusZones(): LayoutState {
  const layout = createBlankLayout();

  for (let note = 0; note < PAD_COUNT; note += 1) {
    const column = note % 8;
    const color = column < 3 ? "#00FF00" : column < 6 ? "#FFE126" : "#FF0000";
    const label = column < 3 ? "Go" : column < 6 ? "Watch" : "Stop";
    layout.pads[note] = createPad(color, "solid-100", label);
  }

  return { ...layout, ...singleButtons("off", "blink") };
}

function layoutFromChecker(): LayoutState {
  const layout = createBlankLayout();

  for (let rowTop = 0; rowTop < 8; rowTop += 1) {
    for (let column = 0; column < 8; column += 1) {
      const note = (7 - rowTop) * 8 + column;
      const on = (rowTop + column) % 2 === 0;
      layout.pads[note] = createPad(on ? "#9A99FF" : "#1E1E1E", on ? "solid-100" : "solid-50", on ? "A" : "B");
    }
  }

  return { ...layout, ...singleButtons("on", "off") };
}
