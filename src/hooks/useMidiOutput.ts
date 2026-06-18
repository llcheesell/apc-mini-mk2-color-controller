import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildRgbSysExForPads,
  buildSingleLedMessage,
  messagesForLayout,
  nearestPaletteVelocity,
  PAD_COUNT,
  SCENE_BUTTON_NOTES,
  TRACK_BUTTON_NOTES,
} from "../apcProtocol";
import { type Rgb, clamp, rgbToHex } from "../color";
import { loadStored, storeValue } from "../storage";
import type { LayoutState, MidiAccessLike, MidiOutputLike, RequestMidiAccess } from "../types";

const OUTPUT_STORAGE_KEY = "apc-mini-mk2-output-id";

export function outputsFromAccess(access: MidiAccessLike): MidiOutputLike[] {
  const outputs = access.outputs as { values?: () => Iterable<MidiOutputLike> };
  if (typeof outputs.values === "function") {
    return Array.from(outputs.values());
  }
  return Array.from(access.outputs as Iterable<MidiOutputLike>);
}

export interface MidiStatus {
  level: "idle" | "ok" | "warn" | "error";
  text: string;
}

export function useMidiOutput(options: { preferExactRgb: boolean }) {
  const [access, setAccess] = useState<MidiAccessLike | null>(null);
  const [outputs, setOutputs] = useState<MidiOutputLike[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState(() => loadStored(OUTPUT_STORAGE_KEY, ""));
  const [sysexEnabled, setSysexEnabled] = useState(false);
  const [status, setStatus] = useState<MidiStatus>({ level: "idle", text: "MIDI未接続" });

  const selectedOutput = outputs.find((output) => output.id === selectedOutputId) ?? null;

  // Refs the rAF live loop / cleanup read without re-subscribing.
  const outputRef = useRef<MidiOutputLike | null>(null);
  outputRef.current = selectedOutput;
  const accessRef = useRef<MidiAccessLike | null>(null);
  accessRef.current = access;
  const selectedIdRef = useRef(selectedOutputId);
  selectedIdRef.current = selectedOutputId;
  const sysexRef = useRef(sysexEnabled);
  sysexRef.current = sysexEnabled;
  const preferExactRef = useRef(options.preferExactRgb);
  preferExactRef.current = options.preferExactRgb;
  const prevColors = useRef<Int16Array>(new Int16Array(PAD_COUNT * 3).fill(-1));
  // The port we actually opened for live output (so we close exactly that one).
  const openOutputRef = useRef<MidiOutputLike | null>(null);

  useEffect(() => {
    storeValue(OUTPUT_STORAGE_KEY, selectedOutputId);
  }, [selectedOutputId]);

  const refreshOutputs = useCallback((current: MidiAccessLike | null) => {
    if (!current) {
      setOutputs([]);
      return;
    }
    const next = outputsFromAccess(current);
    setOutputs(next);
    setSelectedOutputId((existing) => {
      if (existing && next.some((output) => output.id === existing)) {
        return existing;
      }
      const preferred =
        next.find((output) => /apc/i.test(output.name ?? "") && /mini/i.test(output.name ?? "")) ?? next[0];
      return preferred?.id ?? "";
    });
  }, []);

  const connect = useCallback(async () => {
    const requestMIDIAccess = (navigator as Navigator & { requestMIDIAccess?: RequestMidiAccess }).requestMIDIAccess;
    if (!requestMIDIAccess) {
      setStatus({ level: "error", text: "Web MIDI非対応" });
      return null;
    }
    const attempt = async (sysex: boolean) => {
      const granted = await requestMIDIAccess.call(navigator, { sysex });
      granted.onstatechange = () => refreshOutputs(granted);
      setAccess(granted);
      setSysexEnabled(Boolean(granted.sysexEnabled));
      refreshOutputs(granted);
      return granted;
    };
    try {
      const granted = await attempt(true);
      setStatus({ level: "ok", text: "MIDI準備完了" });
      return granted;
    } catch {
      try {
        const granted = await attempt(false);
        setSysexEnabled(false);
        setStatus({ level: "warn", text: "SysExなしで接続" });
        return granted;
      } catch (error) {
        setStatus({ level: "error", text: error instanceof Error ? error.message : "MIDI接続失敗" });
        return null;
      }
    }
  }, [refreshOutputs]);

  useEffect(() => {
    connect();
  }, [connect]);

  // Resolve the current output purely from refs (safe to call from stale closures).
  const resolveOutputFromRefs = useCallback(() => {
    if (outputRef.current) {
      return outputRef.current;
    }
    const granted = accessRef.current;
    return granted ? outputsFromAccess(granted).find((output) => output.id === selectedIdRef.current) ?? null : null;
  }, []);

  // Static send used by Design mode's explicit Send button (and restore-on-exit).
  const sendLayout = useCallback(
    async (layout: LayoutState, opts: { closeAfter: boolean; quiet?: boolean; statusText?: string }) => {
      const granted = accessRef.current ?? (await connect());
      if (!granted) {
        return false;
      }
      const output = resolveOutputFromRefs();
      if (!output) {
        if (!opts.quiet) {
          setStatus({ level: "error", text: "MIDI出力なし" });
        }
        return false;
      }
      try {
        await output.open?.();
        const result = messagesForLayout(layout, { preferExactRgb: preferExactRef.current, sysexEnabled: sysexRef.current });
        const now = performance.now();
        result.messages.forEach((message, index) => output.send(message, now + index * 2));
        if (opts.closeAfter) {
          await output.close?.();
        }
        if (!opts.quiet) {
          const suffix = result.paletteFallbacks > 0 ? " / Palette" : result.usedSysEx ? " / SysEx RGB" : "";
          setStatus({
            level: result.paletteFallbacks > 0 ? "warn" : "ok",
            text: opts.statusText ?? `送信完了${suffix}`,
          });
        }
        return true;
      } catch (error) {
        if (!opts.quiet) {
          setStatus({ level: "error", text: error instanceof Error ? error.message : "送信失敗" });
        }
        return false;
      }
    },
    [connect, resolveOutputFromRefs],
  );

  // ---- Live frame API for the animation / reactive engines ----

  const beginLive = useCallback(async () => {
    const output = resolveOutputFromRefs();
    if (!output) {
      return false;
    }
    // Close a previously-opened (now stale) port so switching ports never leaks.
    if (openOutputRef.current && openOutputRef.current !== output) {
      openOutputRef.current.close?.();
    }
    try {
      await output.open?.();
    } catch {
      // some implementations auto-open; ignore
    }
    openOutputRef.current = output;
    prevColors.current.fill(-1); // invalidate diff so the first frame sends all pads
    return true;
  }, [resolveOutputFromRefs]);

  // Diffed device send: emits only pads whose wire RGB changed since the last frame.
  const sendFrame = useCallback((colors: Rgb[], force = false) => {
    const output = outputRef.current;
    if (!output) {
      return;
    }
    const prev = prevColors.current;
    const changed: Array<{ note: number; r: number; g: number; b: number }> = [];
    for (let note = 0; note < PAD_COUNT; note += 1) {
      const r = clamp(Math.round(colors[note].r), 0, 255);
      const g = clamp(Math.round(colors[note].g), 0, 255);
      const b = clamp(Math.round(colors[note].b), 0, 255);
      const idx = note * 3;
      if (force || prev[idx] !== r || prev[idx + 1] !== g || prev[idx + 2] !== b) {
        changed.push({ note, r, g, b });
        prev[idx] = r;
        prev[idx + 1] = g;
        prev[idx + 2] = b;
      }
    }
    if (changed.length === 0) {
      return;
    }
    try {
      if (sysexRef.current && preferExactRef.current) {
        for (const message of buildRgbSysExForPads(changed)) {
          output.send(message);
        }
      } else {
        for (const { note, r, g, b } of changed) {
          output.send([0x96, note, nearestPaletteVelocity(rgbToHex({ r, g, b }))]);
        }
      }
    } catch {
      // A transient port error shouldn't kill the loop, but the pads we optimistically
      // recorded as sent were NOT received — invalidate them so the next frame retries.
      for (const { note } of changed) {
        const idx = note * 3;
        prev[idx] = -1;
        prev[idx + 1] = -1;
        prev[idx + 2] = -1;
      }
    }
  }, []);

  const endLive = useCallback((closeAfter: boolean) => {
    if (closeAfter && openOutputRef.current) {
      openOutputRef.current.close?.();
      openOutputRef.current = null;
    }
  }, []);

  const panic = useCallback(async () => {
    const output = resolveOutputFromRefs();
    if (!output) {
      setStatus({ level: "error", text: "MIDI出力なし" });
      return;
    }
    try {
      await output.open?.();
      // Single-LED note-offs need no SysEx, so always send them first — a SysEx
      // failure on the pad blackout must never prevent the buttons going dark.
      TRACK_BUTTON_NOTES.forEach((note) => output.send(buildSingleLedMessage(note, "off")));
      SCENE_BUTTON_NOTES.forEach((note) => output.send(buildSingleLedMessage(note, "off")));
      if (sysexRef.current) {
        const blackout = Array.from({ length: PAD_COUNT }, (_, note) => ({ note, r: 0, g: 0, b: 0 }));
        for (const message of buildRgbSysExForPads(blackout)) {
          output.send(message);
        }
      } else {
        // palette fallback: Note-Off every pad
        for (let note = 0; note < PAD_COUNT; note += 1) {
          output.send([0x90, note, 0]);
        }
      }
      prevColors.current.fill(-1); // force a full resend on the next live frame
      setStatus({ level: "warn", text: "全消灯 (PANIC)" });
    } catch (error) {
      setStatus({ level: "error", text: error instanceof Error ? error.message : "消灯失敗" });
    }
  }, [resolveOutputFromRefs]);

  return {
    access,
    outputs,
    selectedOutputId,
    setSelectedOutputId,
    selectedOutput,
    sysexEnabled,
    status,
    setStatus,
    connect,
    sendLayout,
    beginLive,
    sendFrame,
    endLive,
    panic,
  };
}
