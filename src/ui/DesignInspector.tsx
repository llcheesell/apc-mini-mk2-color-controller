import { Brush, Droplet, Eraser, FlipVertical2, FolderOpen, Pipette, Plus, Trash2 } from "lucide-react";
import { type CSSProperties, useState } from "react";
import {
  BEHAVIORS,
  PALETTE_COLORS,
  QUICK_SWATCHES,
  nearestPaletteVelocity,
} from "../apcProtocol";
import { hslToHex } from "../color";
import { LayoutThumbnail } from "./LayoutThumbnail";
import { IconButton, SectionEyebrow, Segmented, Swatch } from "./primitives";
import type {
  BehaviorId,
  BrushState,
  BrushTool,
  GridColorSettings,
  LayoutPreset,
  LayoutState,
  SavedSlot,
} from "../types";

type BehaviorKind = "solid" | "pulse" | "blink";

const KIND_OPTIONS: Array<{ value: BehaviorKind; label: string }> = [
  { value: "solid", label: "点灯" },
  { value: "pulse", label: "パルス" },
  { value: "blink", label: "点滅" },
];

function generatorPalette(kind: "rainbow" | "warm" | "cool" | "mono", baseColor: string): string[] {
  if (kind === "rainbow") {
    return Array.from({ length: 8 }, (_, i) => hslToHex(i * 45, 90, 55));
  }
  if (kind === "warm") {
    return Array.from({ length: 8 }, (_, i) => hslToHex(-20 + i * 12, 95, 52));
  }
  if (kind === "cool") {
    return Array.from({ length: 8 }, (_, i) => hslToHex(150 + i * 18, 88, 55));
  }
  // mono: lightness ramp of the base hue
  const hueMatch = baseColor;
  return Array.from({ length: 8 }, (_, i) => {
    const l = 18 + i * 9;
    return shadeOf(hueMatch, l);
  });
}

function shadeOf(hex: string, lightness: number) {
  // crude: convert to hsl-ish by reusing hslToHex on extracted hue is overkill; just scale value
  const value = lightness / 100;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * value + 255 * (value - 0.5) * 0.2);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * value + 255 * (value - 0.5) * 0.2);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * value + 255 * (value - 0.5) * 0.2);
  const clamp = (n: number) => Math.max(0, Math.min(255, n)).toString(16).toUpperCase().padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

export function DesignInspector(props: {
  brush: BrushState;
  onBrushColor: (color: string) => void;
  onBrushBehavior: (id: BehaviorId) => void;
  onBrushTool: (tool: BrushTool) => void;
  selectedLabel: string;
  onLabelChange: (label: string) => void;
  onFill: (kind: "row" | "col" | "all") => void;
  onClearPad: () => void;
  gridColors: GridColorSettings;
  onAxisColor: (axis: "rows" | "columns", index: number, color: string) => void;
  onAxisGenerate: (axis: "rows" | "columns", colors: string[]) => void;
  presets: LayoutPreset[];
  onApplyPreset: (id: string) => void;
  currentLayout: LayoutState;
  slots: SavedSlot[];
  onSaveSlot: () => void;
  onLoadSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onRenameSlot: (id: string, name: string) => void;
  onImport: () => void;
  onExport: () => void;
}) {
  const [tab, setTab] = useState<"paint" | "library">("paint");
  const behavior = BEHAVIORS.find((b) => b.id === props.brush.behaviorId) ?? BEHAVIORS[6];
  const kind = behavior.kind;
  const ratesForKind = BEHAVIORS.filter((b) => b.kind === kind);

  return (
    <div className="inspector design">
      <div className="inspectorHead">
        <Segmented
          options={[
            { value: "paint", label: "ペイント" },
            { value: "library", label: "ライブラリ" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "paint" ? (
        <div className="inspectorBody">
          <PaintPanel {...props} kind={kind} ratesForKind={ratesForKind} />
          <RowColumnPanel
            gridColors={props.gridColors}
            brushColor={props.brush.color}
            onAxisColor={props.onAxisColor}
            onAxisGenerate={props.onAxisGenerate}
          />
        </div>
      ) : (
        <div className="inspectorBody">
          <LibraryPanel {...props} />
        </div>
      )}
    </div>
  );
}

function PaintPanel({
  brush,
  onBrushColor,
  onBrushBehavior,
  onBrushTool,
  selectedLabel,
  onLabelChange,
  onFill,
  onClearPad,
  kind,
  ratesForKind,
}: {
  brush: BrushState;
  onBrushColor: (color: string) => void;
  onBrushBehavior: (id: BehaviorId) => void;
  onBrushTool: (tool: BrushTool) => void;
  selectedLabel: string;
  onLabelChange: (label: string) => void;
  onFill: (kind: "row" | "col" | "all") => void;
  onClearPad: () => void;
  kind: BehaviorKind;
  ratesForKind: typeof BEHAVIORS;
}) {
  const [showPalette, setShowPalette] = useState(false);
  const velocity = nearestPaletteVelocity(brush.color);

  return (
    <section className="panel">
      <SectionEyebrow>ブラシ</SectionEyebrow>

      <div className="toolRow">
        <IconButton title="ブラシ (B)" active={brush.tool === "brush"} onClick={() => onBrushTool("brush")}>
          <Brush size={17} />
        </IconButton>
        <IconButton title="スポイト (I)" active={brush.tool === "eyedropper"} onClick={() => onBrushTool("eyedropper")}>
          <Pipette size={17} />
        </IconButton>
        <IconButton title="消しゴム (E)" active={brush.tool === "eraser"} onClick={() => onBrushTool("eraser")}>
          <Eraser size={17} />
        </IconButton>
        <div className="spacer" />
        <IconButton title="このパッドを消灯" onClick={onClearPad}>
          <Droplet size={17} />
        </IconButton>
      </div>

      <div className="colorWellRow">
        <label className="colorWell" style={{ "--well": brush.color } as CSSProperties}>
          <input type="color" value={brush.color} onChange={(event) => onBrushColor(event.target.value)} />
        </label>
        <div className="colorMeta">
          <input
            className="hexInput"
            value={brush.color}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              if (/^#[0-9A-F]{0,6}$/.test(value)) {
                onBrushColor(value);
              }
            }}
            maxLength={7}
          />
          <span className="velChip">v{velocity}</span>
        </div>
      </div>

      <div className="swatchGrid">
        {QUICK_SWATCHES.map((color) => (
          <Swatch key={color} color={color} active={brush.color === color} onClick={() => onBrushColor(color)} />
        ))}
      </div>

      {brush.recent.length > 0 && (
        <div className="recentRow">
          <span className="miniLabel">最近</span>
          <div className="swatchGrid">
            {brush.recent.map((color) => (
              <Swatch key={color} color={color} active={brush.color === color} onClick={() => onBrushColor(color)} />
            ))}
          </div>
        </div>
      )}

      <button className="linkButton" onClick={() => setShowPalette((value) => !value)}>
        {showPalette ? "パレットを隠す" : "デバイスパレット (128色)"}
      </button>
      {showPalette && (
        <div className="paletteGrid">
          {PALETTE_COLORS.map((color, index) => (
            <button
              key={`${color}-${index}`}
              className="paletteCell"
              style={{ "--swatch": color } as CSSProperties}
              onClick={() => onBrushColor(color)}
              title={`v${index} ${color}`}
            />
          ))}
        </div>
      )}

      <SectionEyebrow>挙動</SectionEyebrow>
      <Segmented
        size="sm"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(nextKind) => {
          const first = BEHAVIORS.find((b) => b.kind === nextKind);
          if (first) {
            onBrushBehavior(first.id);
          }
        }}
      />
      <div className="rateChips">
        {ratesForKind.map((b) => (
          <button
            key={b.id}
            className={`rateChip${brush.behaviorId === b.id ? " active" : ""}`}
            onClick={() => onBrushBehavior(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <SectionEyebrow>一括</SectionEyebrow>
      <div className="fillRow">
        <button onClick={() => onFill("row")}>選択行</button>
        <button onClick={() => onFill("col")}>選択列</button>
        <button onClick={() => onFill("all")}>全体</button>
      </div>

      <label className="fieldLabel">ラベル</label>
      <input
        className="textInput"
        value={selectedLabel}
        onChange={(event) => onLabelChange(event.target.value.slice(0, 16))}
        placeholder="選択パッドのラベル"
      />
    </section>
  );
}

function RowColumnPanel({
  gridColors,
  brushColor,
  onAxisColor,
  onAxisGenerate,
}: {
  gridColors: GridColorSettings;
  brushColor: string;
  onAxisColor: (axis: "rows" | "columns", index: number, color: string) => void;
  onAxisGenerate: (axis: "rows" | "columns", colors: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const axisBlock = (axis: "rows" | "columns", label: string) => (
    <div className="axisBlock">
      <div className="axisBlockHead">
        <span>{label}</span>
        <div className="genRow">
          {(["rainbow", "warm", "cool", "mono"] as const).map((g) => (
            <button key={g} onClick={() => onAxisGenerate(axis, generatorPalette(g, brushColor))}>
              {g === "rainbow" ? "虹" : g === "warm" ? "暖" : g === "cool" ? "寒" : "単"}
            </button>
          ))}
        </div>
      </div>
      <div className="axisChips">
        {gridColors[axis].map((color, index) => (
          <label key={`${axis}-${index}`} className="axisChip" style={{ "--swatch": color } as CSSProperties}>
            <input type="color" value={color} onChange={(event) => onAxisColor(axis, index, event.target.value)} />
            <span>{axis === "rows" ? "R" : "C"}{index + 1}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <section className="panel">
      <button className="panelToggle" onClick={() => setOpen((value) => !value)}>
        <FlipVertical2 size={15} />
        <span>行 / 列カラー</span>
        <span className="chev">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="axisPanels">
          {axisBlock("rows", "行 (上→下)")}
          {axisBlock("columns", "列 (左→右)")}
        </div>
      )}
    </section>
  );
}

function LibraryPanel({
  presets,
  onApplyPreset,
  currentLayout,
  slots,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  onRenameSlot,
  onImport,
  onExport,
}: {
  presets: LayoutPreset[];
  onApplyPreset: (id: string) => void;
  currentLayout: LayoutState;
  slots: SavedSlot[];
  onSaveSlot: () => void;
  onLoadSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onRenameSlot: (id: string, name: string) => void;
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <>
      <section className="panel">
        <div className="panelHeadRow">
          <SectionEyebrow>マイプリセット</SectionEyebrow>
          <div className="iconGroup">
            <IconButton title="JSON読み込み" onClick={onImport}>
              <FolderOpen size={16} />
            </IconButton>
            <IconButton title="JSON書き出し" onClick={onExport}>
              <Droplet size={16} />
            </IconButton>
          </div>
        </div>
        <div className="cardGrid">
          <button className="slotCard add" onClick={onSaveSlot}>
            <div className="addThumb">
              <Plus size={22} />
            </div>
            <span>現在を保存</span>
          </button>
          {slots.map((slot) => (
            <div key={slot.id} className="slotCard">
              <button className="slotThumbBtn" onClick={() => onLoadSlot(slot.id)} title="読み込み">
                <LayoutThumbnail layout={slot.layout} size={72} />
              </button>
              <input
                className="slotName"
                value={slot.name}
                onChange={(event) => onRenameSlot(slot.id, event.target.value.slice(0, 24))}
              />
              <button className="slotDelete" onClick={() => onDeleteSlot(slot.id)} title="削除">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionEyebrow>スターター</SectionEyebrow>
        <div className="cardGrid">
          {presets.map((preset) => (
            <button key={preset.id} className="slotCard starter" onClick={() => onApplyPreset(preset.id)}>
              <LayoutThumbnail layout={preset} size={72} />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
