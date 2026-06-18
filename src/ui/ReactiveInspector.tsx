import { Eraser, Radio, Waves } from "lucide-react";
import type { CSSProperties } from "react";
import { IconButton, SectionEyebrow, Segmented, Slider } from "./primitives";
import type { ReactiveBehaviorId, ReactiveConfig, ReactiveNoteMapping } from "../types";

const BEHAVIORS: Array<{ value: ReactiveBehaviorId; label: string; desc: string }> = [
  { value: "ripple", label: "波紋", desc: "叩いたパッドから波紋が広がる" },
  { value: "glow", label: "ホールド", desc: "押している間ふわっと光り続ける" },
  { value: "heat", label: "ヒート", desc: "強さで青→赤に変化するヒートマップ" },
  { value: "trails", label: "トレイル", desc: "残光が隣へ滲み、彗星の尾を描く" },
];

const MAPPINGS: Array<{ value: ReactiveNoteMapping; label: string }> = [
  { value: "direct", label: "ダイレクト" },
  { value: "musical", label: "ミュージカル" },
  { value: "chromatic", label: "クロマチック" },
];

export function ReactiveInspector({
  config,
  onBehavior,
  onAccent,
  onBase,
  onDecay,
  onSpread,
  onIntensity,
  onMapping,
  armed,
  onArmToggle,
  liveAvailable,
  activeInputs,
  lastNote,
  onClear,
}: {
  config: ReactiveConfig;
  onBehavior: (id: ReactiveBehaviorId) => void;
  onAccent: (hex: string) => void;
  onBase: (hex: string) => void;
  onDecay: (value: number) => void;
  onSpread: (value: number) => void;
  onIntensity: (value: number) => void;
  onMapping: (mapping: ReactiveNoteMapping) => void;
  armed: boolean;
  onArmToggle: () => void;
  liveAvailable: boolean;
  activeInputs: string[];
  lastNote: { note: number; velocity: number; pad: number | null } | null;
  onClear: () => void;
}) {
  const current = BEHAVIORS.find((b) => b.value === config.behavior) ?? BEHAVIORS[0];

  return (
    <div className="inspector reactive">
      <div className="inspectorHead">
        <div className="listenRow">
          <span className={`listenDot${activeInputs.length > 0 ? " on" : ""}`} />
          <span className="listenText">
            {activeInputs.length > 0 ? `${activeInputs.length}個の入力を待受中` : "MIDI入力なし"}
          </span>
          <div className="spacer" />
          <IconButton title="全消去" onClick={onClear}>
            <Eraser size={16} />
          </IconButton>
        </div>
      </div>

      <div className="inspectorBody">
        <section className="panel">
          <button className={`armButton${armed ? " armed" : ""}`} onClick={onArmToggle} disabled={!liveAvailable}>
            <Radio size={16} />
            <span>{armed ? "LIVE — デバイス出力中" : "デバイスへ出力"}</span>
          </button>
          <p className="armHint">
            {!liveAvailable ? "MIDI出力を選択すると送信できます" : armed ? "MIDI入力に反応して光ります" : "プレビューのみ"}
          </p>
        </section>

        <section className="panel">
          <SectionEyebrow>エフェクト</SectionEyebrow>
          <div className="reactiveGallery">
            {BEHAVIORS.map((b) => (
              <button
                key={b.value}
                className={`animCard${config.behavior === b.value ? " active" : ""}`}
                onClick={() => onBehavior(b.value)}
                title={b.desc}
                style={{ "--a": config.accent, "--b": config.base } as CSSProperties}
              >
                <span className="animSwatch" />
                <strong>{b.label}</strong>
                <small>
                  <Waves size={11} />
                </small>
              </button>
            ))}
          </div>
          <p className="panelDesc">{current.desc}</p>
        </section>

        <section className="panel">
          <SectionEyebrow>カラー</SectionEyebrow>
          <div className="dualColor">
            <label className="colorWell small" style={{ "--well": config.accent } as CSSProperties}>
              <input type="color" value={config.accent} onChange={(event) => onAccent(event.target.value)} />
              <span>光</span>
            </label>
            <label className="colorWell small" style={{ "--well": config.base } as CSSProperties}>
              <input type="color" value={config.base} onChange={(event) => onBase(event.target.value)} />
              <span>地</span>
            </label>
          </div>

          <SectionEyebrow>応答</SectionEyebrow>
          <Slider label="残光" min={0.5} max={6} step={0.1} value={config.decayPerSec} onChange={onDecay} display={config.decayPerSec.toFixed(1)} />
          <Slider label="強さ" min={1} max={10} value={config.intensity} onChange={onIntensity} />
          {config.behavior === "trails" && (
            <Slider label="拡散" min={0} max={4} step={0.1} value={config.spread} onChange={onSpread} display={config.spread.toFixed(1)} />
          )}

          <SectionEyebrow>ノートマッピング</SectionEyebrow>
          <Segmented size="sm" options={MAPPINGS} value={config.mapping} onChange={onMapping} />
          <p className="panelDesc">
            外部キーボードのノートをグリッドに割当てます。APCのパッドはそのまま対応します。
          </p>
        </section>

        <section className="panel">
          <SectionEyebrow>モニター</SectionEyebrow>
          <div className="monitorRow">
            <span className="monoText">
              {lastNote ? `note ${lastNote.note}` : "—"}
            </span>
            <span className="monoText">
              {lastNote ? `pad ${lastNote.pad ?? "—"}` : ""}
            </span>
            <div className="velMeter">
              <span style={{ width: `${(lastNote?.velocity ?? 0) * 100}%` }} />
            </div>
          </div>
          <div className="inputList">
            {activeInputs.length === 0 ? <span className="monoText dim">入力デバイスを接続してください</span> : null}
            {activeInputs.map((name) => (
              <span key={name} className="inputPill">{name}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
