import { CheckCircle2, Palette, Power, Redo2, RefreshCw, Send, Sparkles, Undo2, Usb, XCircle, Zap } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ANIMATION_BY_ID,
  ANIMATION_DEFAULT_ID,
  animationById,
  createRgbBuffer,
  defaultExtras,
} from "./animations";
import { nearestPaletteVelocity, noteHex, normalizeHex, padViewPosition } from "./apcProtocol";
import { hexToRgb, rgbToHex } from "./color";
import { useMidiInput } from "./hooks/useMidiInput";
import { useMidiOutput } from "./hooks/useMidiOutput";
import { PRESETS, createBlankLayout } from "./presets";
import {
  type ReactiveState,
  clearReactive,
  composeReactive,
  createReactiveState,
  ingestCc,
  ingestNote,
  stepReactive,
} from "./reactive";
import { addSlot, loadSlots, loadStored, removeSlot, saveSlots, storeValue, updateSlot } from "./storage";
import { AnimationInspector } from "./ui/AnimationInspector";
import { DesignInspector } from "./ui/DesignInspector";
import { DeviceStage, type AxisFillKind } from "./ui/DeviceStage";
import { ReactiveInspector } from "./ui/ReactiveInspector";
import { IconButton, Segmented } from "./ui/primitives";
import type {
  AnimationParamValue,
  AnimationState,
  AppMode,
  AppSettings,
  BehaviorId,
  BrushState,
  BrushTool,
  GridColorSettings,
  LayoutState,
  PadConfig,
  ReactiveBehaviorId,
  ReactiveConfig,
  ReactiveNoteMapping,
  SingleLedMode,
} from "./types";

const LAYOUT_KEY = "apc-mini-mk2-layout";
const SETTINGS_KEY = "apc-mini-mk2-settings";
const GRID_KEY = "apc-mini-mk2-grid-colors";
const ANIM_KEY = "apc-mini-mk2-animation";
const REACTIVE_KEY = "apc-mini-mk2-reactive";
const BRUSH_KEY = "apc-mini-mk2-brush";

const DEVICE_FRAME_MS = 1000 / 30;

const defaultLayout = cloneLayout(PRESETS.find((preset) => preset.id === "unity") ?? createBlankLayout());
const defaultSettings: AppSettings = { preferExactRgb: true, releaseAfterSend: true };
const defaultGridColors: GridColorSettings = {
  rows: ["#FF0054", "#FF5400", "#FFE126", "#54FF00", "#00FF99", "#00A9FF", "#0055FF", "#7A00FF"],
  columns: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#00FF99", "#00A9FF", "#3F00FF", "#FF00FF"],
};
const defaultAnimation: AnimationState = {
  modeId: ANIMATION_DEFAULT_ID,
  speed: 6,
  intensity: 5,
  primary: "#00B3FF",
  secondary: "#FF1FA8",
  extras: {},
  playing: true,
  armed: false,
};
const defaultReactive: ReactiveConfig = {
  behavior: "ripple",
  accent: "#19E6FF",
  base: "#05070C",
  decayPerSec: 2.2,
  spread: 1.5,
  intensity: 6,
  rippleLifeMs: 900,
  rippleSpeed: 90,
  mapping: "direct",
  armed: false,
};
const defaultBrush: BrushState = { color: "#0055FF", behaviorId: "solid-100", tool: "brush", recent: [] };

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function App() {
  const [mode, setMode] = useState<AppMode>("design");
  const [layout, setLayout] = useState<LayoutState>(() => coerceLoaded(loadStored(LAYOUT_KEY, defaultLayout)));
  const [past, setPast] = useState<LayoutState[]>([]);
  const [future, setFuture] = useState<LayoutState[]>([]);
  const [gridColors, setGridColors] = useState<GridColorSettings>(() => ({ ...defaultGridColors, ...loadStored(GRID_KEY, defaultGridColors) }));
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...defaultSettings, ...loadStored(SETTINGS_KEY, defaultSettings) }));
  const [brush, setBrush] = useState<BrushState>(() => ({ ...defaultBrush, ...loadStored(BRUSH_KEY, defaultBrush) }));
  const [selectedPad, setSelectedPad] = useState(0);
  const [animation, setAnimation] = useState<AnimationState>(() => coerceAnimation(loadStored<unknown>(ANIM_KEY, defaultAnimation)));
  const [reactiveConfig, setReactiveConfig] = useState<ReactiveConfig>(() => ({ ...defaultReactive, ...loadStored(REACTIVE_KEY, defaultReactive) }));
  const [slots, setSlots] = useState(() => loadSlots());
  const [dragging, setDragging] = useState(false);
  const [lastNote, setLastNote] = useState<{ note: number; velocity: number; pad: number | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const midi = useMidiOutput({ preferExactRgb: settings.preferExactRgb });

  const padRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reactiveRef = useRef<ReactiveState>(createReactiveState(performance.now()));

  // Refs the rAF loop / cleanup read without re-subscribing.
  const animationRef = useRef(animation);
  animationRef.current = animation;
  const reactiveConfigRef = useRef(reactiveConfig);
  reactiveConfigRef.current = reactiveConfig;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const elapsedRef = useRef(0); // animation clock (seconds)
  const restartRef = useRef(0); // bumped to restart the animation from t=0
  const drivenRef = useRef(false); // true once a live frame reached the device this session
  const lastNoteRef = useRef<{ note: number; velocity: number; pad: number | null } | null>(null);
  const pastRef = useRef(past);
  pastRef.current = past;
  const futureRef = useRef(future);
  futureRef.current = future;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const live = mode !== "design";
  const selectedOutput = midi.selectedOutput;

  // ---- undo / redo of the layout document ----
  const pushHistory = useCallback(() => {
    setPast((p) => [...p, layoutRef.current].slice(-100));
    setFuture([]);
  }, []);
  const undo = useCallback(() => {
    const p = pastRef.current;
    if (p.length === 0) {
      return;
    }
    setPast(p.slice(0, -1));
    setFuture((f) => [layoutRef.current, ...f].slice(0, 100));
    setLayout(p[p.length - 1]);
  }, []);
  const redo = useCallback(() => {
    const f = futureRef.current;
    if (f.length === 0) {
      return;
    }
    setFuture(f.slice(1));
    setPast((p) => [...p, layoutRef.current].slice(-100));
    setLayout(f[0]);
  }, []);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // ---- persistence ----
  useEffect(() => storeValue(LAYOUT_KEY, layout), [layout]);
  useEffect(() => storeValue(GRID_KEY, gridColors), [gridColors]);
  useEffect(() => storeValue(SETTINGS_KEY, settings), [settings]);
  useEffect(() => storeValue(ANIM_KEY, animation), [animation]);
  useEffect(() => storeValue(REACTIVE_KEY, reactiveConfig), [reactiveConfig]);
  useEffect(() => storeValue(BRUSH_KEY, brush), [brush]);
  useEffect(() => saveSlots(slots), [slots]);

  useEffect(() => {
    const stop = () => setDragging(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  // Brush tool shortcuts (design mode only; ignored while typing in a field).
  useEffect(() => {
    if (mode !== "design") {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return; // let text fields use native editing/undo
      }
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (key === "b") {
        setBrush((current) => ({ ...current, tool: "brush" }));
      } else if (key === "i") {
        setBrush((current) => ({ ...current, tool: "eyedropper" }));
      } else if (key === "e") {
        setBrush((current) => ({ ...current, tool: "eraser" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, undo, redo]);

  // ---- MIDI note input (reactive mode) ----
  const { activeInputs } = useMidiInput({
    access: midi.access,
    enabled: mode === "reactive",
    mapping: reactiveConfig.mapping,
    onNote: (event) => {
      ingestNote(reactiveRef.current, event);
      // Write to a ref only; the rAF loop flushes it to React state at ~12fps so a
      // dense note stream never triggers a setState-per-message render storm.
      if (event.type === "noteon") {
        lastNoteRef.current = { note: event.note, velocity: event.velocity, pad: event.pad };
      }
    },
    onControlChange: (event) => ingestCc(reactiveRef.current, event),
  });

  // ---- arm port open/close when arming toggles or mode changes ----
  useEffect(() => {
    if (!live) {
      return;
    }
    const armed = mode === "animation" ? animation.armed : reactiveConfig.armed;
    if (armed) {
      midi.beginLive();
    } else {
      midi.endLive(true);
      // disarming while still live: hand the hardware back to the saved design
      // instead of leaving it frozen on the last live frame.
      if (drivenRef.current) {
        midi.sendLayout(layoutRef.current, { closeAfter: true, quiet: true });
        drivenRef.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, mode, animation.armed, reactiveConfig.armed, midi.selectedOutputId]);

  // ---- Design mode: push edits to the device in real time (debounced) ----
  useEffect(() => {
    if (mode !== "design" || !selectedOutput) {
      return;
    }
    const id = window.setTimeout(() => {
      midi.sendLayout(layoutRef.current, { closeAfter: false, quiet: true });
    }, 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, layout, gridColors, selectedOutput]);

  // ---- the single rAF live engine, owned by live mode ----
  useEffect(() => {
    if (!live) {
      return;
    }
    if (mode === "reactive") {
      reactiveRef.current = createReactiveState(performance.now());
    }
    const out = createRgbBuffer();
    let animState: Record<string, unknown> = {};
    let raf = 0;
    let lastNow = performance.now();
    let lastDeviceSend = 0;
    let lastNoteFlush = 0;
    let lastModeId = animationRef.current.modeId;
    let restartSeen = restartRef.current;
    elapsedRef.current = 0;

    const paintScreen = () => {
      const refs = padRefs.current;
      for (let note = 0; note < 64; note += 1) {
        const element = refs[note];
        if (!element) {
          continue;
        }
        const hex = rgbToHex(out[note]);
        element.style.setProperty("--pad-color", hex);
        element.style.setProperty("--lit", String(luminance(hex)));
      }
    };

    const loop = (now: number) => {
      const dt = (now - lastNow) / 1000;
      lastNow = now;

      if (mode === "animation") {
        const anim = animationRef.current;
        if (anim.modeId !== lastModeId) {
          lastModeId = anim.modeId;
          animState = {}; // fresh scratch (e.g. spectrum peak-hold) per animation
          elapsedRef.current = 0;
        }
        if (restartRef.current !== restartSeen) {
          restartSeen = restartRef.current;
          elapsedRef.current = 0;
          animState = {};
        }
        if (anim.playing) {
          elapsedRef.current += dt;
        }
        const def = animationById(anim.modeId);
        def.render(out, elapsedRef.current, {
          speed: anim.speed,
          intensity: anim.intensity,
          primary: anim.primary,
          secondary: anim.secondary,
          params: anim.extras?.[anim.modeId] ?? {},
          state: animState,
        });
      } else {
        stepReactive(reactiveRef.current, reactiveConfigRef.current, now);
        composeReactive(out, reactiveRef.current, reactiveConfigRef.current);
        if (lastNoteRef.current && now - lastNoteFlush > 80) {
          lastNoteFlush = now;
          setLastNote(lastNoteRef.current);
        }
      }

      paintScreen();

      const armed = mode === "animation" ? animationRef.current.armed : reactiveConfigRef.current.armed;
      if (armed && now - lastDeviceSend >= DEVICE_FRAME_MS) {
        lastDeviceSend = now;
        midi.sendFrame(out);
        drivenRef.current = true;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      midi.endLive(true);
      // Restore the saved design to the device only when leaving live mode entirely
      // (modeRef holds the NEW mode here) and only if we actually drove the device.
      if (drivenRef.current && modeRef.current === "design") {
        midi.sendLayout(layoutRef.current, { closeAfter: true, quiet: true });
        drivenRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, mode]);

  // ---- layout editing ----
  const paintPad = useCallback((note: number, color: string, behaviorId: BehaviorId) => {
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, index) => (index === note ? { ...pad, color, behaviorId } : pad)),
    }));
  }, []);

  const applyTool = useCallback(
    (note: number) => {
      if (brush.tool === "eyedropper") {
        const pad = layoutRef.current.pads[note];
        setBrush((current) => ({ ...current, color: pad.color, behaviorId: pad.behaviorId }));
        setSelectedPad(note);
        return;
      }
      const color = brush.tool === "eraser" ? "#000000" : brush.color;
      const behaviorId: BehaviorId = brush.tool === "eraser" ? "solid-100" : brush.behaviorId;
      paintPad(note, color, behaviorId);
      setSelectedPad(note);
    },
    [brush, paintPad],
  );

  const onPadDown = useCallback(
    (note: number, event: PointerEvent) => {
      // Release implicit pointer capture (touch/pen) so dragging across pads still
      // fires onPointerEnter on the pads underneath — otherwise only the first paints.
      const target = event.currentTarget as HTMLElement;
      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      if (brush.tool !== "eyedropper") {
        pushHistory(); // one undo entry per stroke (snapshot before the stroke starts)
      }
      setDragging(true);
      applyTool(note);
    },
    [applyTool, brush.tool, pushHistory],
  );

  const onPadEnter = useCallback(
    (note: number, _event: PointerEvent) => {
      if (dragging && brush.tool !== "eyedropper") {
        applyTool(note);
      }
    },
    [applyTool, brush.tool, dragging],
  );

  const onPadActivate = useCallback(
    (note: number) => {
      if (brush.tool !== "eyedropper") {
        pushHistory();
      }
      applyTool(note);
    },
    [applyTool, brush.tool, pushHistory],
  );

  const onBrushColor = useCallback(
    (raw: string) => {
      const color = /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw.toUpperCase() : raw.toUpperCase();
      setBrush((current) => {
        const valid = /^#[0-9A-F]{6}$/.test(color);
        const recent = valid ? [color, ...current.recent.filter((c) => c !== color)].slice(0, 10) : current.recent;
        return { ...current, color, recent };
      });
      if (/^#[0-9A-F]{6}$/.test(color)) {
        paintPad(selectedPad, color, brush.tool === "eraser" ? "solid-100" : brush.behaviorId);
      }
    },
    [brush.behaviorId, brush.tool, paintPad, selectedPad],
  );

  const onBrushBehavior = useCallback(
    (behaviorId: BehaviorId) => {
      setBrush((current) => ({ ...current, behaviorId }));
      paintPad(selectedPad, brush.color, behaviorId);
    },
    [brush.color, paintPad, selectedPad],
  );

  const onBrushTool = useCallback((tool: BrushTool) => setBrush((current) => ({ ...current, tool })), []);

  const onLabelChange = useCallback(
    (label: string) => {
      setLayout((current) => ({
        ...current,
        pads: current.pads.map((pad, index) => (index === selectedPad ? { ...pad, label } : pad)),
      }));
    },
    [selectedPad],
  );

  const fillPads = useCallback(
    (predicate: (note: number) => boolean, color: string, behaviorId: BehaviorId) => {
      setLayout((current) => ({
        ...current,
        pads: current.pads.map((pad, note) => (predicate(note) ? { ...pad, color, behaviorId } : pad)),
      }));
    },
    [],
  );

  const onFill = useCallback(
    (kind: "row" | "col" | "all") => {
      pushHistory();
      const position = padViewPosition(selectedPad);
      const color = brush.color;
      const behaviorId = brush.behaviorId;
      if (kind === "all") {
        fillPads(() => true, color, behaviorId);
      } else if (kind === "row") {
        fillPads((note) => padViewPosition(note).rowFromTop === position.rowFromTop, color, behaviorId);
      } else {
        fillPads((note) => padViewPosition(note).column === position.column, color, behaviorId);
      }
    },
    [brush.behaviorId, brush.color, fillPads, pushHistory, selectedPad],
  );

  const onAxisFill = useCallback(
    (kind: AxisFillKind, index: number, erase: boolean) => {
      pushHistory();
      const color = erase ? "#000000" : brush.color;
      const behaviorId: BehaviorId = erase ? "solid-100" : brush.behaviorId;
      if (kind === "all") {
        fillPads(() => true, color, behaviorId);
      } else if (kind === "row") {
        fillPads((note) => padViewPosition(note).rowFromTop === index, color, behaviorId);
      } else {
        fillPads((note) => padViewPosition(note).column === index, color, behaviorId);
      }
    },
    [brush.behaviorId, brush.color, fillPads, pushHistory],
  );

  const onClearPad = useCallback(() => {
    pushHistory();
    paintPad(selectedPad, "#000000", "solid-100");
  }, [paintPad, pushHistory, selectedPad]);

  const onAxisColor = useCallback(
    (axis: "rows" | "columns", index: number, raw: string) => {
      const color = normalizeHex(raw);
      setGridColors((current) => ({
        ...current,
        [axis]: current[axis].map((value, i) => (i === index ? color : value)),
      }));
      setLayout((current) => ({
        ...current,
        pads: current.pads.map((pad, note) => {
          const position = padViewPosition(note);
          const match = axis === "rows" ? position.rowFromTop === index : position.column === index;
          return match ? { ...pad, color } : pad;
        }),
      }));
    },
    [],
  );

  const onAxisGenerate = useCallback((axis: "rows" | "columns", colors: string[]) => {
    pushHistory();
    setGridColors((current) => ({ ...current, [axis]: colors.map(normalizeHex) }));
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) => {
        const position = padViewPosition(note);
        const index = axis === "rows" ? position.rowFromTop : position.column;
        return { ...pad, color: normalizeHex(colors[index] ?? pad.color) };
      }),
    }));
  }, [pushHistory]);

  const onApplyPreset = useCallback((id: string) => {
    const preset = PRESETS.find((candidate) => candidate.id === id);
    if (!preset) {
      return;
    }
    pushHistory();
    const next = cloneLayout(preset);
    setLayout(next);
    setSelectedPad(0);
    setBrush((current) => ({ ...current, color: next.pads[0].color, behaviorId: next.pads[0].behaviorId }));
    midi.setStatus({ level: "ok", text: `${preset.name} 適用` });
  }, [midi, pushHistory]);

  // ---- slots ----
  const onSaveSlot = useCallback(() => {
    setSlots((current) => addSlot(current, `Preset ${current.length + 1}`, cloneLayout(layout), { ...gridColors }));
  }, [gridColors, layout]);

  const onLoadSlot = useCallback(
    (id: string) => {
      const slot = slotsRef.current.find((s) => s.id === id);
      if (!slot) {
        return;
      }
      pushHistory();
      setLayout(cloneLayout(slot.layout));
      if (slot.gridColors) {
        setGridColors({ ...slot.gridColors });
      }
      setSelectedPad(0);
    },
    [pushHistory],
  );

  const onDeleteSlot = useCallback((id: string) => setSlots((current) => removeSlot(current, id)), []);
  const onRenameSlot = useCallback(
    (id: string, name: string) => setSlots((current) => updateSlot(current, id, { name })),
    [],
  );

  // ---- import / export ----
  const onExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: 1, layout, gridColors, animation }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "apc-mini-mk2-colors.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [animation, gridColors, layout]);

  const onImport = useCallback(() => fileInputRef.current?.click(), []);

  const handleImportFile = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as { layout?: LayoutState; gridColors?: GridColorSettings };
      const imported = coerceLayout(parsed.layout ?? (parsed as unknown as LayoutState));
      if (!imported) {
        midi.setStatus({ level: "error", text: "JSON形式エラー" });
        return;
      }
      pushHistory();
      setLayout(imported);
      if (parsed.gridColors) {
        setGridColors(parsed.gridColors);
      }
      setSelectedPad(0);
      midi.setStatus({ level: "ok", text: "読み込み完了" });
    } catch (error) {
      midi.setStatus({ level: "error", text: error instanceof Error ? error.message : "読み込み失敗" });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [midi, pushHistory]);

  // ---- single LED buttons ----
  const onTrackClick = useCallback((index: number) => {
    pushHistory();
    setLayout((current) => ({
      ...current,
      trackButtons: current.trackButtons.map((b, i) => (i === index ? { ...b, mode: nextLed(b.mode) } : b)),
    }));
  }, [pushHistory]);
  const onSceneClick = useCallback((index: number) => {
    pushHistory();
    setLayout((current) => ({
      ...current,
      sceneButtons: current.sceneButtons.map((b, i) => (i === index ? { ...b, mode: nextLed(b.mode) } : b)),
    }));
  }, [pushHistory]);

  // ---- send (design) ----
  const sendCurrent = useCallback(
    async (quit = false) => {
      const ok = await midi.sendLayout(layout, { closeAfter: settings.releaseAfterSend || quit });
      if (ok && quit) {
        window.setTimeout(() => window.apcDesktop?.quit(), 250);
      }
    },
    [layout, midi, settings.releaseAfterSend],
  );

  // ---- animation handlers ----
  const onSelectAnim = useCallback((id: string) => {
    setAnimation((current) => {
      const extras = current.extras[id] ?? defaultExtras(animationById(id));
      return { ...current, modeId: id, playing: true, extras: { ...current.extras, [id]: extras } };
    });
  }, []);
  const onAnimExtra = useCallback((key: string, value: AnimationParamValue) => {
    setAnimation((current) => {
      const modeExtras = { ...(current.extras[current.modeId] ?? {}), [key]: value };
      return { ...current, extras: { ...current.extras, [current.modeId]: modeExtras } };
    });
  }, []);
  const onCapture = useCallback(() => {
    // bake the current screen frame into a saved slot
    const pads: PadConfig[] = Array.from({ length: 64 }, (_, note) => {
      const element = padRefs.current[note];
      const color = element?.style.getPropertyValue("--pad-color").trim() || "#000000";
      return { color: normalizeHex(color), behaviorId: "solid-100", label: layout.pads[note]?.label ?? "" };
    });
    const baked: LayoutState = { ...layout, pads };
    setSlots((current) => addSlot(current, `${animationById(animation.modeId).nameJa} frame`, baked));
    midi.setStatus({ level: "ok", text: "フレームを保存" });
  }, [animation.modeId, layout, midi]);

  const selectedConfig = layout.pads[selectedPad];
  const selectedPosition = padViewPosition(selectedPad);

  const dockText = useMemo(() => {
    if (mode === "design") {
      return `${noteHex(selectedPad)} · R${selectedPosition.rowFromTop + 1} C${selectedPosition.column + 1} · v${nearestPaletteVelocity(selectedConfig.color)}`;
    }
    if (mode === "animation") {
      return `${animationById(animation.modeId).nameEn} · ${animation.playing ? "PLAY" : "PAUSE"} · 30fps`;
    }
    return lastNote ? `note ${lastNote.note} · vel ${(lastNote.velocity * 127) | 0}` : "MIDI入力待機";
  }, [animation.modeId, animation.playing, lastNote, mode, selectedConfig.color, selectedPad, selectedPosition]);

  return (
    <div className="appShell" data-mode={mode}>
      <header className="topBar">
        <div className="brand">
          <div className="brandMark">
            <Palette size={18} />
          </div>
          <div className="brandText">
            <h1>APC Stage</h1>
            <span>Akai APC mini mk2</span>
          </div>
        </div>

        <Segmented
          options={[
            { value: "design", label: "デザイン", icon: <Palette size={15} /> },
            { value: "animation", label: "アニメ", icon: <Sparkles size={15} /> },
            { value: "reactive", label: "リアクティブ", icon: <Zap size={15} /> },
          ]}
          value={mode}
          onChange={setMode}
        />

        <div className="topRight">
          <label className="outputSelect">
            <Usb size={15} />
            <select value={midi.selectedOutputId} onChange={(event) => midi.setSelectedOutputId(event.target.value)}>
              {midi.outputs.length === 0 ? (
                <option value="">出力ポートなし</option>
              ) : (
                midi.outputs.map((output) => (
                  <option key={output.id} value={output.id}>
                    {output.name ?? "MIDI"}
                  </option>
                ))
              )}
            </select>
          </label>
          <IconButton title="再スキャン" onClick={() => midi.connect()}>
            <RefreshCw size={16} />
          </IconButton>
          {mode === "design" && (
            <>
              <IconButton title="元に戻す (⌘Z)" onClick={undo} disabled={!canUndo}>
                <Undo2 size={16} />
              </IconButton>
              <IconButton title="やり直す (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
                <Redo2 size={16} />
              </IconButton>
              <button className="sendButton" onClick={() => sendCurrent(false)} disabled={!selectedOutput}>
                <Send size={16} />
                <span>送信</span>
              </button>
              <IconButton title="送信して終了" onClick={() => sendCurrent(true)} disabled={!selectedOutput}>
                <Power size={16} />
              </IconButton>
            </>
          )}
          <IconButton title="全消灯 (PANIC)" danger onClick={() => midi.panic()}>
            <XCircle size={16} />
          </IconButton>
        </div>
      </header>

      <main className="workspace">
        <DeviceStage
          live={live}
          layout={layout}
          selectedPad={selectedPad}
          padRefs={padRefs}
          axisColors={gridColors}
          onPadDown={onPadDown}
          onPadEnter={onPadEnter}
          onPadActivate={onPadActivate}
          onAxisFill={onAxisFill}
          onTrackClick={onTrackClick}
          onSceneClick={onSceneClick}
        />

        <aside className="inspectorWrap">
          {mode === "design" && (
            <DesignInspector
              brush={brush}
              onBrushColor={onBrushColor}
              onBrushBehavior={onBrushBehavior}
              onBrushTool={onBrushTool}
              selectedLabel={selectedConfig.label}
              onLabelChange={onLabelChange}
              onFill={onFill}
              onClearPad={onClearPad}
              gridColors={gridColors}
              onAxisColor={onAxisColor}
              onAxisGenerate={onAxisGenerate}
              presets={PRESETS}
              onApplyPreset={onApplyPreset}
              currentLayout={layout}
              slots={slots}
              onSaveSlot={onSaveSlot}
              onLoadSlot={onLoadSlot}
              onDeleteSlot={onDeleteSlot}
              onRenameSlot={onRenameSlot}
              onImport={onImport}
              onExport={onExport}
            />
          )}
          {mode === "animation" && (
            <AnimationInspector
              animation={animation}
              onSelectMode={onSelectAnim}
              onPlayToggle={() => setAnimation((c) => ({ ...c, playing: !c.playing }))}
              onRestart={() => {
                restartRef.current += 1;
                setAnimation((c) => ({ ...c, playing: true }));
              }}
              onSpeed={(speed) => setAnimation((c) => ({ ...c, speed }))}
              onIntensity={(intensity) => setAnimation((c) => ({ ...c, intensity }))}
              onPrimary={(primary) => setAnimation((c) => ({ ...c, primary: primary.toUpperCase() }))}
              onSecondary={(secondary) => setAnimation((c) => ({ ...c, secondary: secondary.toUpperCase() }))}
              onExtra={onAnimExtra}
              armed={animation.armed}
              onArmToggle={() => setAnimation((c) => ({ ...c, armed: !c.armed }))}
              liveAvailable={Boolean(selectedOutput)}
              onCapture={onCapture}
            />
          )}
          {mode === "reactive" && (
            <ReactiveInspector
              config={reactiveConfig}
              onBehavior={(behavior: ReactiveBehaviorId) => setReactiveConfig((c) => ({ ...c, behavior }))}
              onAccent={(accent) => setReactiveConfig((c) => ({ ...c, accent: accent.toUpperCase() }))}
              onBase={(base) => setReactiveConfig((c) => ({ ...c, base: base.toUpperCase() }))}
              onDecay={(decayPerSec) => setReactiveConfig((c) => ({ ...c, decayPerSec }))}
              onSpread={(spread) => setReactiveConfig((c) => ({ ...c, spread }))}
              onIntensity={(intensity) => setReactiveConfig((c) => ({ ...c, intensity }))}
              onMapping={(mapping: ReactiveNoteMapping) => setReactiveConfig((c) => ({ ...c, mapping }))}
              armed={reactiveConfig.armed}
              onArmToggle={() => setReactiveConfig((c) => ({ ...c, armed: !c.armed }))}
              liveAvailable={Boolean(selectedOutput)}
              activeInputs={activeInputs}
              lastNote={lastNote}
              onClear={() => clearReactive(reactiveRef.current)}
            />
          )}
        </aside>
      </main>

      <footer className="dock">
        <span className="dockReadout">{dockText}</span>
        <StatusPill level={midi.status.level} text={midi.status.text} />
      </footer>

      <input
        ref={fileInputRef}
        className="hiddenInput"
        type="file"
        accept="application/json,.json"
        onChange={(event) => handleImportFile(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function StatusPill({ level, text }: { level: string; text: string }) {
  const Icon = level === "error" ? XCircle : CheckCircle2;
  return (
    <div className={`statusPill ${level}`}>
      <Icon size={14} />
      <span>{text}</span>
    </div>
  );
}

function nextLed(mode: SingleLedMode): SingleLedMode {
  return mode === "off" ? "on" : mode === "on" ? "blink" : "off";
}

function cloneLayout(layout: LayoutState): LayoutState {
  return {
    pads: layout.pads.map((pad) => ({ ...pad })),
    trackButtons: layout.trackButtons.map((button) => ({ ...button })),
    sceneButtons: layout.sceneButtons.map((button) => ({ ...button })),
  };
}

function coerceLayout(value: unknown): LayoutState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as LayoutState;
  if (!Array.isArray(candidate.pads) || candidate.pads.length !== 64) {
    return null;
  }
  if (!Array.isArray(candidate.trackButtons) || candidate.trackButtons.length !== 8) {
    return null;
  }
  if (!Array.isArray(candidate.sceneButtons) || candidate.sceneButtons.length !== 8) {
    return null;
  }
  return cloneLayout(candidate);
}

function coerceLoaded(value: LayoutState): LayoutState {
  return coerceLayout(value) ?? cloneLayout(defaultLayout);
}

// Migrate a persisted animation value to the current AnimationState shape. Older
// app versions stored a different object (no extras/primary/secondary), which
// would crash the render loop — so validate every field and fall back.
function coerceAnimation(value: unknown): AnimationState {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const modeId = typeof raw.modeId === "string" && ANIMATION_BY_ID.has(raw.modeId) ? raw.modeId : ANIMATION_DEFAULT_ID;
  const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
  return {
    modeId,
    speed: typeof raw.speed === "number" ? raw.speed : defaultAnimation.speed,
    intensity: typeof raw.intensity === "number" ? raw.intensity : defaultAnimation.intensity,
    primary: isHex(raw.primary) ? (raw.primary as string).toUpperCase() : defaultAnimation.primary,
    secondary: isHex(raw.secondary) ? (raw.secondary as string).toUpperCase() : defaultAnimation.secondary,
    extras: raw.extras && typeof raw.extras === "object" ? (raw.extras as AnimationState["extras"]) : {},
    playing: typeof raw.playing === "boolean" ? raw.playing : true,
    armed: false, // never auto-arm on load
  };
}
