import { memo } from "react";
import type { CSSProperties, MutableRefObject, PointerEvent } from "react";
import { behaviorById, noteHex, SCENE_BUTTON_NOTES, TRACK_BUTTON_NOTES } from "../apcProtocol";
import { hexToRgb } from "../color";
import type { GridColorSettings, LayoutState } from "../types";

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export type AxisFillKind = "row" | "col" | "all";

function DeviceStageImpl({
  live,
  layout,
  selectedPad,
  padRefs,
  axisColors,
  onPadDown,
  onPadEnter,
  onPadActivate,
  onAxisFill,
  onTrackClick,
  onSceneClick,
}: {
  live: boolean;
  layout: LayoutState;
  selectedPad: number | null;
  padRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  axisColors: GridColorSettings;
  onPadDown: (note: number, event: PointerEvent) => void;
  onPadEnter: (note: number, event: PointerEvent) => void;
  onPadActivate: (note: number) => void;
  onAxisFill: (kind: AxisFillKind, index: number, erase: boolean) => void;
  onTrackClick: (index: number) => void;
  onSceneClick: (index: number) => void;
}) {
  return (
    <div className="stage">
      <div className={`console${live ? " live" : ""}`}>
        {/* corner "All" handle */}
        <button
          className="axisHandle corner"
          style={{ gridColumn: 1, gridRow: 1 }}
          onClick={(event) => !live && onAxisFill("all", 0, event.shiftKey)}
          title="全体を塗る (Shiftで消去)"
          disabled={live}
        >
          ⬚
        </button>

        {/* column handles */}
        {Array.from({ length: 8 }, (_, column) => (
          <button
            key={`col-${column}`}
            className="axisHandle col"
            style={{ gridColumn: column + 2, gridRow: 1, "--dot": axisColors.columns[column] } as CSSProperties}
            onClick={(event) => !live && onAxisFill("col", column, event.shiftKey)}
            title={`列 C${column + 1} を塗る (Shiftで消去)`}
            disabled={live}
          >
            <span className="axisDot" />
            <span className="axisLabel">C{column + 1}</span>
          </button>
        ))}

        {/* row handles */}
        {Array.from({ length: 8 }, (_, rowFromTop) => (
          <button
            key={`row-${rowFromTop}`}
            className="axisHandle row"
            style={{ gridColumn: 1, gridRow: rowFromTop + 2, "--dot": axisColors.rows[rowFromTop] } as CSSProperties}
            onClick={(event) => !live && onAxisFill("row", rowFromTop, event.shiftKey)}
            title={`行 R${rowFromTop + 1} を塗る (Shiftで消去)`}
            disabled={live}
          >
            <span className="axisDot" />
            <span className="axisLabel">R{rowFromTop + 1}</span>
          </button>
        ))}

        {/* 64 pads */}
        {Array.from({ length: 64 }, (_, note) => {
          const column = note % 8;
          const rowFromTop = 7 - Math.floor(note / 8);
          const pad = layout.pads[note];
          const behavior = behaviorById(pad.behaviorId);
          const selected = !live && selectedPad === note;
          // In live mode the rAF loop owns --pad-color/--lit imperatively, so we
          // must NOT put them in the style object or React would reset them on
          // every re-render. In design mode React drives them from the layout.
          const style = live
            ? ({ gridColumn: column + 2, gridRow: rowFromTop + 2 } as CSSProperties)
            : ({
                gridColumn: column + 2,
                gridRow: rowFromTop + 2,
                "--pad-color": pad.color,
                "--lit": luminance(pad.color) * behavior.brightness,
              } as CSSProperties);
          return (
            <button
              key={note}
              ref={(element) => {
                padRefs.current[note] = element;
              }}
              className={`pad${selected ? " selected" : ""}`}
              data-behavior={live ? "solid" : behavior.kind}
              style={style}
              onPointerDown={(event) => !live && onPadDown(note, event)}
              onPointerEnter={(event) => !live && onPadEnter(note, event)}
              onKeyDown={(event) => {
                if (!live && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onPadActivate(note);
                }
              }}
              title={live ? undefined : `${noteHex(note)} ${pad.label}`}
              tabIndex={live ? -1 : 0}
            >
              {!live && (
                <>
                  <span className="padNote">{noteHex(note)}</span>
                  <span className="padLabel">{pad.label}</span>
                </>
              )}
            </button>
          );
        })}

        {/* scene rail (right edge) */}
        {layout.sceneButtons.map((button, index) => (
          <button
            key={`scene-${index}`}
            className="singleLed scene"
            data-mode={button.mode}
            style={{ gridColumn: 10, gridRow: index + 2 } as CSSProperties}
            onClick={() => !live && onSceneClick(index)}
            title={`${button.label} ${noteHex(SCENE_BUTTON_NOTES[index])}`}
            disabled={live}
          >
            <span>{index + 1}</span>
          </button>
        ))}

        {/* track rail (bottom edge) */}
        {layout.trackButtons.map((button, index) => (
          <button
            key={`track-${index}`}
            className="singleLed track"
            data-mode={button.mode}
            style={{ gridColumn: index + 2, gridRow: 10 } as CSSProperties}
            onClick={() => !live && onTrackClick(index)}
            title={`${button.label} ${noteHex(TRACK_BUTTON_NOTES[index])}`}
            disabled={live}
          >
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const DeviceStage = memo(DeviceStageImpl);
