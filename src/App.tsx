import {
  Activity,
  Brush,
  CheckCircle2,
  Columns3,
  Download,
  Eraser,
  Paintbrush,
  Power,
  RefreshCw,
  Rows3,
  Send,
  Sparkles,
  Upload,
  Usb,
  XCircle,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANIMATION_MODES, animationDelayMs, animationLayoutForFrame } from "./animations";
import {
  BEHAVIORS,
  QUICK_SWATCHES,
  behaviorById,
  messagesForLayout,
  nearestPaletteVelocity,
  noteHex,
  normalizeHex,
  padNoteFromView,
  padViewPosition,
} from "./apcProtocol";
import { PRESETS, createBlankLayout } from "./presets";
import { loadStored, storeValue } from "./storage";
import type {
  AppSettings,
  AnimationModeId,
  AnimationSettings,
  BehaviorId,
  GridColorSettings,
  LayoutState,
  MidiAccessLike,
  MidiOutputLike,
  PadConfig,
  RequestMidiAccess,
  SingleLedMode,
} from "./types";

const LAYOUT_STORAGE_KEY = "apc-mini-mk2-layout";
const SETTINGS_STORAGE_KEY = "apc-mini-mk2-settings";
const OUTPUT_STORAGE_KEY = "apc-mini-mk2-output-id";
const GRID_COLOR_STORAGE_KEY = "apc-mini-mk2-grid-colors";
const ANIMATION_STORAGE_KEY = "apc-mini-mk2-animation";

const defaultLayout = cloneLayout(PRESETS.find((preset) => preset.id === "unity") ?? createBlankLayout());
const defaultSettings: AppSettings = {
  preferExactRgb: true,
  releaseAfterSend: true,
};
const defaultGridColors: GridColorSettings = {
  rows: ["#FF0054", "#FF5400", "#FFE126", "#54FF00", "#00FF99", "#00A9FF", "#0055FF", "#7A00FF"],
  columns: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#00FF99", "#00A9FF", "#3F00FF", "#FF00FF"],
};
const defaultAnimationSettings: AnimationSettings = {
  activeMode: null,
  primaryColor: "#00FF99",
  secondaryColor: "#7A00FF",
  speed: 6,
  intensity: 7,
  liveOutput: false,
};

type StatusState = {
  level: "idle" | "ok" | "warn" | "error";
  text: string;
};

type PaintState = {
  color: string;
  behaviorId: BehaviorId;
};

export function App() {
  const [midiAccess, setMidiAccess] = useState<MidiAccessLike | null>(null);
  const [outputs, setOutputs] = useState<MidiOutputLike[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState(() => loadStored(OUTPUT_STORAGE_KEY, ""));
  const [layout, setLayout] = useState<LayoutState>(() => loadStored(LAYOUT_STORAGE_KEY, defaultLayout));
  const [settings, setSettings] = useState<AppSettings>(() => loadStored(SETTINGS_STORAGE_KEY, defaultSettings));
  const [gridColors, setGridColors] = useState<GridColorSettings>(() => loadStored(GRID_COLOR_STORAGE_KEY, defaultGridColors));
  const [animationSettings, setAnimationSettings] = useState<AnimationSettings>(() =>
    loadStored(ANIMATION_STORAGE_KEY, defaultAnimationSettings),
  );
  const [animationFrame, setAnimationFrame] = useState(0);
  const [selectedPad, setSelectedPad] = useState(0);
  const [paint, setPaint] = useState<PaintState>(() => ({
    color: layout.pads[0]?.color ?? "#0055FF",
    behaviorId: layout.pads[0]?.behaviorId ?? "solid-100",
  }));
  const [paintMode, setPaintMode] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [sysexEnabled, setSysexEnabled] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    level: "idle",
    text: "MIDI未接続",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewLayout = useMemo(
    () => animationLayoutForFrame(layout, animationSettings, animationFrame),
    [animationFrame, animationSettings, layout],
  );
  const animationActive = Boolean(animationSettings.activeMode);
  const selectedPadConfig = layout.pads[selectedPad];
  const selectedBehavior = behaviorById(paint.behaviorId);
  const selectedOutput = outputs.find((output) => output.id === selectedOutputId) ?? null;
  const selectedPosition = padViewPosition(selectedPad);
  const nearestVelocity = nearestPaletteVelocity(paint.color);

  const refreshOutputs = useCallback((access: MidiAccessLike | null) => {
    if (!access) {
      setOutputs([]);
      return;
    }

    const nextOutputs = outputsFromAccess(access);
    setOutputs(nextOutputs);

    setSelectedOutputId((current) => {
      if (current && nextOutputs.some((output) => output.id === current)) {
        return current;
      }

      const preferred =
        nextOutputs.find((output) => /apc/i.test(output.name ?? "") && /mini/i.test(output.name ?? "")) ??
        nextOutputs[0];

      return preferred?.id ?? "";
    });
  }, []);

  const connectMidi = useCallback(async () => {
    const requestMIDIAccess = (navigator as Navigator & { requestMIDIAccess?: RequestMidiAccess }).requestMIDIAccess;

    if (!requestMIDIAccess) {
      setStatus({ level: "error", text: "Web MIDI非対応" });
      return null;
    }

    try {
      const access = await requestMIDIAccess.call(navigator, { sysex: true });
      access.onstatechange = () => refreshOutputs(access);
      setMidiAccess(access);
      setSysexEnabled(Boolean(access.sysexEnabled));
      refreshOutputs(access);
      setStatus({ level: "ok", text: access.sysexEnabled ? "MIDI準備完了" : "MIDI準備完了" });
      return access;
    } catch {
      try {
        const access = await requestMIDIAccess.call(navigator, { sysex: false });
        access.onstatechange = () => refreshOutputs(access);
        setMidiAccess(access);
        setSysexEnabled(false);
        refreshOutputs(access);
        setStatus({ level: "warn", text: "SysExなしで接続" });
        return access;
      } catch (error) {
        setStatus({ level: "error", text: error instanceof Error ? error.message : "MIDI接続失敗" });
        return null;
      }
    }
  }, [refreshOutputs]);

  useEffect(() => {
    connectMidi();
  }, [connectMidi]);

  useEffect(() => {
    storeValue(LAYOUT_STORAGE_KEY, layout);
  }, [layout]);

  useEffect(() => {
    storeValue(SETTINGS_STORAGE_KEY, settings);
  }, [settings]);

  useEffect(() => {
    storeValue(GRID_COLOR_STORAGE_KEY, gridColors);
  }, [gridColors]);

  useEffect(() => {
    storeValue(ANIMATION_STORAGE_KEY, animationSettings);
  }, [animationSettings]);

  useEffect(() => {
    storeValue(OUTPUT_STORAGE_KEY, selectedOutputId);
  }, [selectedOutputId]);

  useEffect(() => {
    const stopDragging = () => setDragging(false);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  useEffect(() => {
    if (!animationSettings.activeMode) {
      return;
    }

    const interval = window.setInterval(() => {
      setAnimationFrame((current) => current + 1);
    }, animationDelayMs(animationSettings.speed));

    return () => window.clearInterval(interval);
  }, [animationSettings.activeMode, animationSettings.speed]);

  const updateSelectedPad = useCallback((updates: Partial<PadConfig>) => {
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) => (note === selectedPad ? { ...pad, ...updates } : pad)),
    }));
  }, [selectedPad]);

  const setPaintColor = useCallback((color: string) => {
    const normalized = color.toUpperCase();
    setPaint((current) => ({ ...current, color: normalized }));
    updateSelectedPad({ color: normalized });
  }, [updateSelectedPad]);

  const setPaintBehavior = useCallback((behaviorId: BehaviorId) => {
    setPaint((current) => ({ ...current, behaviorId }));
    updateSelectedPad({ behaviorId });
  }, [updateSelectedPad]);

  const selectOrPaintPad = useCallback((note: number) => {
    setSelectedPad(note);

    if (paintMode) {
      setLayout((current) => ({
        ...current,
        pads: current.pads.map((pad, index) =>
          index === note ? { ...pad, color: paint.color, behaviorId: paint.behaviorId } : pad,
        ),
      }));
      return;
    }

    const pad = layout.pads[note];
    setPaint({ color: pad.color, behaviorId: pad.behaviorId });
  }, [layout.pads, paint, paintMode]);

  const applyToAllPads = useCallback(() => {
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad) => ({ ...pad, color: paint.color, behaviorId: paint.behaviorId })),
    }));
    setStatus({ level: "ok", text: "全パッド更新" });
  }, [paint]);

  const applyToRow = useCallback(() => {
    const rowFromBottom = Math.floor(selectedPad / 8);
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) =>
        Math.floor(note / 8) === rowFromBottom ? { ...pad, color: paint.color, behaviorId: paint.behaviorId } : pad,
      ),
    }));
  }, [paint, selectedPad]);

  const applyToColumn = useCallback(() => {
    const column = selectedPad % 8;
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) =>
        note % 8 === column ? { ...pad, color: paint.color, behaviorId: paint.behaviorId } : pad,
      ),
    }));
  }, [paint, selectedPad]);

  const applyRowColor = useCallback((rowFromTop: number, color: string) => {
    const normalized = normalizeHex(color);
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) =>
        padViewPosition(note).rowFromTop === rowFromTop ? { ...pad, color: normalized } : pad,
      ),
    }));
  }, []);

  const applyColumnColor = useCallback((column: number, color: string) => {
    const normalized = normalizeHex(color);
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) =>
        padViewPosition(note).column === column ? { ...pad, color: normalized } : pad,
      ),
    }));
  }, []);

  const updateGridColor = useCallback((
    axis: "rows" | "columns",
    index: number,
    color: string,
    applyImmediately = true,
  ) => {
    const normalized = normalizeHex(color);
    setGridColors((current) => ({
      ...current,
      [axis]: current[axis].map((item, itemIndex) => (itemIndex === index ? normalized : item)),
    }));

    if (!applyImmediately) {
      return;
    }

    if (axis === "rows") {
      applyRowColor(index, normalized);
      return;
    }

    applyColumnColor(index, normalized);
  }, [applyColumnColor, applyRowColor]);

  const applyAllRowColors = useCallback(() => {
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) => ({
        ...pad,
        color: normalizeHex(gridColors.rows[padViewPosition(note).rowFromTop] ?? pad.color),
      })),
    }));
    setStatus({ level: "ok", text: "行カラー反映" });
  }, [gridColors.rows]);

  const applyAllColumnColors = useCallback(() => {
    setLayout((current) => ({
      ...current,
      pads: current.pads.map((pad, note) => ({
        ...pad,
        color: normalizeHex(gridColors.columns[padViewPosition(note).column] ?? pad.color),
      })),
    }));
    setStatus({ level: "ok", text: "列カラー反映" });
  }, [gridColors.columns]);

  const clearSelectedPad = useCallback(() => {
    setPaint({ color: "#000000", behaviorId: "solid-100" });
    updateSelectedPad({ color: "#000000", behaviorId: "solid-100" });
  }, [updateSelectedPad]);

  const cycleTrackButton = useCallback((index: number) => {
    setLayout((current) => ({
      ...current,
      trackButtons: current.trackButtons.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, mode: nextSingleLedMode(button.mode) } : button,
      ),
    }));
  }, []);

  const cycleSceneButton = useCallback((index: number) => {
    setLayout((current) => ({
      ...current,
      sceneButtons: current.sceneButtons.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, mode: nextSingleLedMode(button.mode) } : button,
      ),
    }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }

    const nextLayout = cloneLayout(preset);
    setLayout(nextLayout);
    setSelectedPad(0);
    setPaint({
      color: nextLayout.pads[0].color,
      behaviorId: nextLayout.pads[0].behaviorId,
    });
    setStatus({ level: "ok", text: `${preset.name} 適用` });
  }, []);

  const sendLayoutPayload = useCallback(async (
    layoutToSend: LayoutState,
    options: { closeAfter: boolean; quiet?: boolean; statusText?: string } = { closeAfter: true },
  ) => {
    const access = midiAccess ?? (await connectMidi());
    if (!access) {
      return false;
    }

    const output = selectedOutput ?? outputsFromAccess(access).find((candidate) => candidate.id === selectedOutputId);

    if (!output) {
      if (!options.quiet) {
        setStatus({ level: "error", text: "MIDI出力なし" });
      }
      return false;
    }

    try {
      await output.open?.();
      const result = messagesForLayout(layoutToSend, {
        preferExactRgb: settings.preferExactRgb,
        sysexEnabled,
      });

      const now = performance.now();
      result.messages.forEach((message, index) => output.send(message, now + index * 2));

      if (options.closeAfter) {
        await output.close?.();
      }

      if (!options.quiet) {
        const suffix = result.paletteFallbacks > 0 ? " / Palette fallback" : result.usedSysEx ? " / SysEx RGB" : "";
        setStatus({
          level: result.paletteFallbacks > 0 ? "warn" : "ok",
          text: options.statusText ?? `送信完了${suffix}`,
        });
      }

      return true;
    } catch (error) {
      if (!options.quiet) {
        setStatus({ level: "error", text: error instanceof Error ? error.message : "送信失敗" });
      }
      return false;
    }
  }, [
    connectMidi,
    midiAccess,
    selectedOutput,
    selectedOutputId,
    settings.preferExactRgb,
    sysexEnabled,
  ]);

  const sendCurrentLayout = useCallback(async (quitAfterSend = false) => {
    const sent = await sendLayoutPayload(layout, {
      closeAfter: settings.releaseAfterSend || quitAfterSend,
    });

    if (sent && quitAfterSend) {
      window.setTimeout(() => window.apcDesktop?.quit(), 250);
    }
  }, [layout, sendLayoutPayload, settings.releaseAfterSend]);

  useEffect(() => {
    if (!animationSettings.activeMode || !animationSettings.liveOutput) {
      return;
    }

    if (!selectedOutput) {
      setStatus({ level: "warn", text: "アニメーションはプレビューのみ" });
      return;
    }

    sendLayoutPayload(previewLayout, { closeAfter: false, quiet: true });
  }, [
    animationFrame,
    animationSettings.activeMode,
    animationSettings.liveOutput,
    previewLayout,
    selectedOutput,
    sendLayoutPayload,
  ]);

  useEffect(() => {
    if (!animationSettings.activeMode) {
      return;
    }

    setStatus({
      level: animationSettings.liveOutput && selectedOutput ? "ok" : "idle",
      text: animationSettings.liveOutput && selectedOutput ? "アニメーション送信中" : "アニメーションプレビュー",
    });

    return () => {
      selectedOutput?.close?.();
    };
  }, [animationSettings.activeMode, animationSettings.liveOutput, selectedOutput]);

  const toggleAnimationMode = useCallback((modeId: AnimationModeId) => {
    setAnimationSettings((current) => ({
      ...current,
      activeMode: current.activeMode === modeId ? null : modeId,
    }));
    setAnimationFrame(0);
  }, []);

  const updateAnimationSetting = useCallback((updates: Partial<AnimationSettings>) => {
    setAnimationSettings((current) => ({ ...current, ...updates }));
  }, []);

  const exportLayout = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: 1, layout, gridColors, animationSettings }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "apc-mini-mk2-colors.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [animationSettings, gridColors, layout]);

  const importLayout = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const json = JSON.parse(await file.text()) as { layout?: LayoutState };
      const imported = coerceLayout(json.layout ?? json);
      if (!imported) {
        setStatus({ level: "error", text: "JSON形式エラー" });
        return;
      }

      setLayout(imported);
      setSelectedPad(0);
      setPaint({
        color: imported.pads[0].color,
        behaviorId: imported.pads[0].behaviorId,
      });
      setStatus({ level: "ok", text: "読み込み完了" });
    } catch (error) {
      setStatus({ level: "error", text: error instanceof Error ? error.message : "読み込み失敗" });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const outputOptions = useMemo(() => outputs.map((output) => ({
    id: output.id,
    label: `${output.name ?? "Unnamed MIDI"}${output.manufacturer ? ` / ${output.manufacturer}` : ""}`,
  })), [outputs]);

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark">APC</div>
          <div>
            <h1>APC Color Controller</h1>
            <span>Akai APC mini mk2</span>
          </div>
        </div>

        <div className="midiStrip">
          <label className="selectLabel" htmlFor="midi-output">
            <Usb size={17} />
            <span>MIDI出力</span>
          </label>
          <select
            id="midi-output"
            value={selectedOutputId}
            onChange={(event) => setSelectedOutputId(event.target.value)}
          >
            {outputOptions.length === 0 ? (
              <option value="">出力ポートなし</option>
            ) : (
              outputOptions.map((output) => (
                <option key={output.id} value={output.id}>
                  {output.label}
                </option>
              ))
            )}
          </select>
          <IconButton title="再スキャン" onClick={() => connectMidi()}>
            <RefreshCw size={18} />
          </IconButton>
        </div>

        <div className="actionStrip">
          <button className="commandButton primary" onClick={() => sendCurrentLayout(false)} disabled={!selectedOutput}>
            <Send size={18} />
            <span>送信</span>
          </button>
          <button className="commandButton" onClick={() => sendCurrentLayout(true)} disabled={!selectedOutput}>
            <Power size={18} />
            <span>送信して終了</span>
          </button>
          <StatusPill status={status} />
        </div>
      </header>

      <main className="workspace">
        <section className="devicePanel">
          <div className="panelTitle">
            <h2>Surface</h2>
            <div className="surfaceMeta">
              <span>{noteHex(selectedPad)}</span>
              <span>R{selectedPosition.rowFromTop + 1}</span>
              <span>C{selectedPosition.column + 1}</span>
            </div>
          </div>

          <div className="apcBoard">
            <div className="padMatrix" onPointerLeave={() => setDragging(false)}>
              {Array.from({ length: 8 }, (_, rowFromTop) =>
                Array.from({ length: 8 }, (_, column) => {
                  const note = padNoteFromView(rowFromTop, column);
                  const pad = previewLayout.pads[note];
                  const selected = selectedPad === note;

                  return (
                    <button
                      key={note}
                      className={`padCell${selected ? " selected" : ""}`}
                      style={{ "--pad-color": pad.color } as CSSProperties}
                      onPointerDown={() => {
                        setDragging(true);
                        selectOrPaintPad(note);
                      }}
                      onPointerEnter={() => {
                        if (dragging && paintMode) {
                          selectOrPaintPad(note);
                        }
                      }}
                      title={`${noteHex(note)} ${pad.label}`}
                    >
                      <span className="padNote">{noteHex(note)}</span>
                      <span className="padLabel">{pad.label}</span>
                    </button>
                  );
                }),
              )}
            </div>

            <div className="sceneRail">
              {layout.sceneButtons.map((button, index) => (
                <button
                  key={button.label}
                  className={`singleLed scene ${button.mode}`}
                  onClick={() => cycleSceneButton(index)}
                  title={`${button.label} ${noteHex(0x70 + index)}`}
                >
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>

            <div className="trackRail">
              {layout.trackButtons.map((button, index) => (
                <button
                  key={button.label}
                  className={`singleLed track ${button.mode}`}
                  onClick={() => cycleTrackButton(index)}
                  title={`${button.label} ${noteHex(0x64 + index)}`}
                >
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="sidePanel">
          <section className="toolSection">
            <div className="sectionHeader">
              <h2>Edit</h2>
              <div className="iconGroup">
                <IconButton
                  title={paintMode ? "ブラシ" : "選択"}
                  active={paintMode}
                  onClick={() => setPaintMode((current) => !current)}
                >
                  {paintMode ? <Paintbrush size={18} /> : <Brush size={18} />}
                </IconButton>
                <IconButton title="消灯" onClick={clearSelectedPad}>
                  <Eraser size={18} />
                </IconButton>
              </div>
            </div>

            <div className="colorEditor">
              <input
                className="colorPicker"
                type="color"
                value={paint.color}
                onChange={(event) => setPaintColor(event.target.value)}
                aria-label="Pad color"
              />
              <input
                className="hexInput"
                value={paint.color}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase();
                  setPaint((current) => ({ ...current, color: value }));
                  if (/^#[0-9A-F]{6}$/.test(value)) {
                    updateSelectedPad({ color: value });
                  }
                }}
                maxLength={7}
              />
              <div className="nearestChip">v{nearestVelocity}</div>
            </div>

            <div className="swatchGrid">
              {QUICK_SWATCHES.map((color) => (
                <button
                  key={color}
                  className="swatch"
                  style={{ "--swatch": color } as CSSProperties}
                  onClick={() => setPaintColor(color)}
                  title={color}
                />
              ))}
            </div>

            <div className="segmented behaviorSegment">
              {BEHAVIORS.map((behavior) => (
                <button
                  key={behavior.id}
                  className={paint.behaviorId === behavior.id ? "active" : ""}
                  onClick={() => setPaintBehavior(behavior.id)}
                  title={behavior.kind}
                >
                  {behavior.label}
                </button>
              ))}
            </div>

            <label className="fieldLabel" htmlFor="pad-label">
              Label
            </label>
            <input
              id="pad-label"
              className="textInput"
              value={selectedPadConfig.label}
              onChange={(event) => updateSelectedPad({ label: event.target.value.slice(0, 16) })}
            />

            <div className="miniActions">
              <button onClick={applyToRow}>選択行</button>
              <button onClick={applyToColumn}>選択列</button>
              <button onClick={applyToAllPads}>全体</button>
            </div>
          </section>

          <section className="toolSection">
            <div className="sectionHeader">
              <h2>Rows / Columns</h2>
              <div className="iconGroup">
                <IconButton title="行カラー反映" onClick={applyAllRowColors}>
                  <Rows3 size={18} />
                </IconButton>
                <IconButton title="列カラー反映" onClick={applyAllColumnColors}>
                  <Columns3 size={18} />
                </IconButton>
              </div>
            </div>

            <div className="gridColorPanels">
              <GridColorBlock
                axis="rows"
                colors={gridColors.rows}
                selectedIndex={selectedPosition.rowFromTop}
                onApply={applyRowColor}
                onChange={updateGridColor}
              />
              <GridColorBlock
                axis="columns"
                colors={gridColors.columns}
                selectedIndex={selectedPosition.column}
                onApply={applyColumnColor}
                onChange={updateGridColor}
              />
            </div>
          </section>

          <section className="toolSection">
            <div className="sectionHeader">
              <h2>Presets</h2>
              <div className="iconGroup">
                <IconButton title="読み込み" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={18} />
                </IconButton>
                <IconButton title="書き出し" onClick={exportLayout}>
                  <Download size={18} />
                </IconButton>
              </div>
            </div>

            <div className="presetGrid">
              {PRESETS.map((preset) => (
                <button key={preset.id} className="presetButton" onClick={() => applyPreset(preset.id)}>
                  <PresetPreview preset={preset} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>

            <input
              ref={fileInputRef}
              className="hiddenInput"
              type="file"
              accept="application/json,.json"
              onChange={(event) => importLayout(event.target.files?.[0] ?? null)}
            />
          </section>

          <section className="toolSection">
            <div className="sectionHeader">
              <h2>Animation</h2>
              <IconButton
                title={animationActive ? "停止" : "アニメーション"}
                active={animationActive}
                onClick={() => updateAnimationSetting({ activeMode: null })}
              >
                {animationActive ? <Activity size={18} /> : <Sparkles size={18} />}
              </IconButton>
            </div>

            <div className="modeGrid">
              {ANIMATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`modeButton${animationSettings.activeMode === mode.id ? " active" : ""}`}
                  onClick={() => toggleAnimationMode(mode.id)}
                  aria-pressed={animationSettings.activeMode === mode.id}
                >
                  <span className="modeDot" />
                  <strong>{mode.name}</strong>
                  <small>{mode.shortName}</small>
                </button>
              ))}
            </div>

            <div className="dualColorEditor">
              <label>
                <span>A</span>
                <input
                  type="color"
                  value={animationSettings.primaryColor}
                  onChange={(event) => updateAnimationSetting({ primaryColor: event.target.value.toUpperCase() })}
                />
              </label>
              <label>
                <span>B</span>
                <input
                  type="color"
                  value={animationSettings.secondaryColor}
                  onChange={(event) => updateAnimationSetting({ secondaryColor: event.target.value.toUpperCase() })}
                />
              </label>
            </div>

            <SliderRow
              label="Speed"
              value={animationSettings.speed}
              min={1}
              max={10}
              onChange={(speed) => updateAnimationSetting({ speed })}
            />
            <SliderRow
              label="Intensity"
              value={animationSettings.intensity}
              min={1}
              max={10}
              onChange={(intensity) => updateAnimationSetting({ intensity })}
            />
            <Toggle
              checked={animationSettings.liveOutput}
              label="Live MIDI"
              onChange={(liveOutput) => updateAnimationSetting({ liveOutput })}
            />
          </section>

          <section className="toolSection compact">
            <h2>Output</h2>
            <Toggle
              checked={settings.preferExactRgb}
              label="Exact RGB"
              onChange={(checked) => setSettings((current) => ({ ...current, preferExactRgb: checked }))}
            />
            <Toggle
              checked={settings.releaseAfterSend}
              label="Release port"
              onChange={(checked) => setSettings((current) => ({ ...current, releaseAfterSend: checked }))}
            />
            <div className="specRows">
              <span>Pad</span>
              <strong>0x00-0x3F</strong>
              <span>Track</span>
              <strong>0x64-0x6B</strong>
              <span>Scene</span>
              <strong>0x70-0x77</strong>
              <span>SysEx</span>
              <strong>{sysexEnabled ? "On" : "Off"}</strong>
              <span>Mode</span>
              <strong>{selectedBehavior.kind}</strong>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function outputsFromAccess(access: MidiAccessLike) {
  const outputs = access.outputs as unknown as {
    values?: () => Iterable<MidiOutputLike>;
    [Symbol.iterator]?: () => Iterator<MidiOutputLike>;
  };

  if (typeof outputs.values === "function") {
    return Array.from(outputs.values());
  }

  return Array.from(outputs as Iterable<MidiOutputLike>);
}

function GridColorBlock({
  axis,
  colors,
  selectedIndex,
  onApply,
  onChange,
}: {
  axis: "rows" | "columns";
  colors: string[];
  selectedIndex: number;
  onApply: (index: number, color: string) => void;
  onChange: (axis: "rows" | "columns", index: number, color: string) => void;
}) {
  const labelPrefix = axis === "rows" ? "R" : "C";

  return (
    <div className="gridColorBlock">
      <div className="gridColorTitle">
        {axis === "rows" ? <Rows3 size={15} /> : <Columns3 size={15} />}
        <span>{axis === "rows" ? "行カラー" : "列カラー"}</span>
      </div>
      <div className="gridColorList">
        {colors.map((color, index) => (
          <label key={`${axis}-${index}`} className={`gridColorItem${selectedIndex === index ? " selected" : ""}`}>
            <span>{labelPrefix}{index + 1}</span>
            <input
              type="color"
              value={color}
              onChange={(event) => onChange(axis, index, event.target.value)}
            />
            <button type="button" onClick={() => onApply(index, color)}>
              Apply
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="sliderRow">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{value}</strong>
    </label>
  );
}

function nextSingleLedMode(mode: SingleLedMode): SingleLedMode {
  if (mode === "off") {
    return "on";
  }

  if (mode === "on") {
    return "blink";
  }

  return "off";
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

function IconButton({
  active = false,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button className={`iconButton${active ? " active" : ""}`} onClick={onClick} title={title} aria-label={title}>
      {children}
    </button>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggleRow">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function StatusPill({ status }: { status: StatusState }) {
  const Icon = status.level === "error" ? XCircle : CheckCircle2;
  return (
    <div className={`statusPill ${status.level}`}>
      <Icon size={16} />
      <span>{status.text}</span>
    </div>
  );
}

function PresetPreview({ preset }: { preset: LayoutState }) {
  return (
    <div className="presetPreview">
      {Array.from({ length: 16 }, (_, previewIndex) => {
        const row = Math.floor(previewIndex / 4);
        const column = previewIndex % 4;
        const note = (3 - row) * 16 + column * 2;
        return <span key={previewIndex} style={{ "--preview-color": preset.pads[note].color } as CSSProperties} />;
      })}
    </div>
  );
}
