import { useEffect, useRef } from "react";
import { hexToRgb } from "../color";
import type { LayoutState } from "../types";

// Draws an 8x8 glowing micro-preview of a layout to a canvas (no DOM nodes).
export function LayoutThumbnail({ layout, size = 76 }: { layout: LayoutState; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, size, size);

    const cell = size / 8;
    const pad = cell * 0.14;
    const inner = cell - pad * 2;
    const radius = inner * 0.26;

    for (let note = 0; note < 64; note += 1) {
      const column = note % 8;
      const rowFromTop = 7 - Math.floor(note / 8);
      const color = layout.pads[note]?.color ?? "#000000";
      const { r, g, b } = hexToRgb(color);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const x = column * cell + pad;
      const y = rowFromTop * cell + pad;

      ctx.shadowBlur = luminance > 0.04 ? inner * 0.7 * luminance : 0;
      ctx.shadowColor = color;
      ctx.fillStyle = luminance > 0.02 ? color : "#10141b";
      roundRect(ctx, x, y, inner, inner, radius);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }, [layout, size]);

  return <canvas ref={ref} className="layoutThumb" style={{ width: size, height: size }} />;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
