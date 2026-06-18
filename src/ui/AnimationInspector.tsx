import { Camera, Pause, Play, RotateCcw, Radio } from "lucide-react";
import type { CSSProperties } from "react";
import { ANIMATIONS, animationById } from "../animations";
import { IconButton, ParamControl, SectionEyebrow, Slider } from "./primitives";
import type { AnimationParamValue, AnimationState } from "../types";

export function AnimationInspector({
  animation,
  onSelectMode,
  onPlayToggle,
  onRestart,
  onSpeed,
  onIntensity,
  onPrimary,
  onSecondary,
  onExtra,
  armed,
  onArmToggle,
  liveAvailable,
  onCapture,
}: {
  animation: AnimationState;
  onSelectMode: (id: string) => void;
  onPlayToggle: () => void;
  onRestart: () => void;
  onSpeed: (value: number) => void;
  onIntensity: (value: number) => void;
  onPrimary: (hex: string) => void;
  onSecondary: (hex: string) => void;
  onExtra: (key: string, value: AnimationParamValue) => void;
  armed: boolean;
  onArmToggle: () => void;
  liveAvailable: boolean;
  onCapture: () => void;
}) {
  const current = animationById(animation.modeId);
  const extras = animation.extras[animation.modeId] ?? {};

  return (
    <div className="inspector animation">
      <div className="inspectorHead">
        <div className="transport">
          <IconButton title={animation.playing ? "一時停止" : "再生"} active={animation.playing} onClick={onPlayToggle}>
            {animation.playing ? <Pause size={17} /> : <Play size={17} />}
          </IconButton>
          <IconButton title="最初から" onClick={onRestart}>
            <RotateCcw size={16} />
          </IconButton>
          <div className="spacer" />
          <IconButton title="現在のフレームを保存" onClick={onCapture}>
            <Camera size={16} />
          </IconButton>
        </div>
      </div>

      <div className="inspectorBody">
        <section className="panel">
          <button
            className={`armButton${armed ? " armed" : ""}`}
            onClick={onArmToggle}
            disabled={!liveAvailable}
          >
            <Radio size={16} />
            <span>{armed ? `LIVE — デバイス出力中` : "デバイスへ出力"}</span>
          </button>
          <p className="armHint">
            {!liveAvailable
              ? "MIDI出力を選択すると送信できます"
              : armed
                ? "保存済みのデザインは安全です。終了時に復元されます。"
                : "プレビューのみ — デバイスには送信していません"}
          </p>
        </section>

        <section className="panel">
          <SectionEyebrow>ライブラリ</SectionEyebrow>
          <div className="animGallery">
            {ANIMATIONS.map((anim) => (
              <button
                key={anim.id}
                className={`animCard${animation.modeId === anim.id ? " active" : ""}`}
                onClick={() => onSelectMode(anim.id)}
                title={anim.description}
                style={
                  {
                    "--a": animation.primary,
                    "--b": animation.secondary,
                  } as CSSProperties
                }
              >
                <span className="animSwatch" />
                <strong>{anim.nameJa}</strong>
                <small>{anim.family}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionEyebrow>{current.nameJa} / {current.nameEn}</SectionEyebrow>
          <p className="panelDesc">{current.description}</p>

          <div className="dualColor">
            <label className="colorWell small" style={{ "--well": animation.primary } as CSSProperties}>
              <input type="color" value={animation.primary} onChange={(event) => onPrimary(event.target.value)} />
              <span>A</span>
            </label>
            <label className="colorWell small" style={{ "--well": animation.secondary } as CSSProperties}>
              <input type="color" value={animation.secondary} onChange={(event) => onSecondary(event.target.value)} />
              <span>B</span>
            </label>
          </div>

          <Slider label="速度" min={1} max={10} value={animation.speed} onChange={onSpeed} />
          <Slider label="強さ" min={1} max={10} value={animation.intensity} onChange={onIntensity} />

          {current.extras.map((spec) => (
            <ParamControl key={spec.key} spec={spec} value={extras[spec.key]} onChange={(value) => onExtra(spec.key, value)} />
          ))}
        </section>
      </div>
    </div>
  );
}
