import { useEffect, useRef, useState } from "react";
import { padNoteFromView } from "../apcProtocol";
import type {
  MidiAccessLike,
  MidiCcEvent,
  MidiInputLike,
  MidiMessageEventLike,
  MidiNoteEvent,
  ReactiveNoteMapping,
} from "../types";

function inputsFromAccess(access: MidiAccessLike): MidiInputLike[] {
  const inputs = access.inputs as { values?: () => Iterable<MidiInputLike> };
  if (typeof inputs.values === "function") {
    return Array.from(inputs.values());
  }
  return Array.from(access.inputs as Iterable<MidiInputLike>);
}

// Map an incoming MIDI note number to a grid pad (0-63) or null when it has no
// pad (e.g. APC track/scene buttons, which the reactive engine handles by note).
export function mapIncomingNote(note: number, isApc: boolean, mapping: ReactiveNoteMapping): number | null {
  if (isApc) {
    return note >= 0 && note <= 63 ? note : null; // track/scene buttons handled separately
  }
  if (mapping === "direct") {
    // out-of-range notes have no pad in direct mode (don't silently wrap)
    return note >= 0 && note <= 63 ? note : null;
  }
  if (mapping === "chromatic") {
    const column = note % 12;
    if (column > 7) {
      return null;
    }
    const rowFromTop = 7 - (Math.floor(note / 12) % 8);
    return padNoteFromView(rowFromTop, column);
  }
  // musical wrap: pitch class drives the column, octave drives the row
  const column = note % 8;
  const rowFromTop = 7 - (Math.floor(note / 8) % 8);
  return padNoteFromView(rowFromTop, column);
}

export function useMidiInput(options: {
  access: MidiAccessLike | null;
  enabled: boolean;
  mapping: ReactiveNoteMapping;
  onNote?: (event: MidiNoteEvent) => void;
  onControlChange?: (event: MidiCcEvent) => void;
}) {
  const onNote = useRef(options.onNote);
  onNote.current = options.onNote;
  const onCc = useRef(options.onControlChange);
  onCc.current = options.onControlChange;
  const mapping = useRef(options.mapping);
  mapping.current = options.mapping;
  const bound = useRef(new Map<string, (event: MidiMessageEventLike) => void>());
  const [activeInputs, setActiveInputs] = useState<string[]>([]);

  useEffect(() => {
    const access = options.access;
    if (!access || !options.enabled) {
      return;
    }

    const makeHandler = (input: MidiInputLike) => (event: MidiMessageEventLike) => {
      const data = event.data;
      if (!data || data.length < 1) {
        return;
      }
      const status = data[0] & 0xf0;
      const channel = data[0] & 0x0f;
      const isApc = /apc/i.test(input.name ?? "");
      const time = typeof event.timeStamp === "number" ? event.timeStamp : performance.now();

      if (status === 0x90 || status === 0x80) {
        const note = data[1];
        const velocity = data.length > 2 ? data[2] : 0;
        const on = status === 0x90 && velocity > 0;
        onNote.current?.({
          type: on ? "noteon" : "noteoff",
          note,
          pad: mapIncomingNote(note, isApc, mapping.current),
          velocity: velocity / 127,
          channel,
          sourceId: input.id,
          isApc,
          time,
        });
      } else if (status === 0xb0) {
        onCc.current?.({
          type: "cc",
          controller: data[1],
          value: (data[2] ?? 0) / 127,
          sourceId: input.id,
          time,
        });
      }
      // ignore clock/active-sensing/sysex (0xF8/0xFE/0xF0)
    };

    const subscribe = (input: MidiInputLike) => {
      if (bound.current.has(input.id)) {
        return;
      }
      const handler = makeHandler(input);
      bound.current.set(input.id, handler);
      if (input.addEventListener) {
        input.addEventListener("midimessage", handler);
      } else {
        input.onmidimessage = handler;
      }
      input.open?.();
    };

    const unsubscribe = (id: string, input?: MidiInputLike) => {
      const handler = bound.current.get(id);
      if (!handler) {
        return;
      }
      if (input?.removeEventListener) {
        input.removeEventListener("midimessage", handler);
      } else if (input) {
        input.onmidimessage = null;
      }
      bound.current.delete(id);
    };

    const sync = () => {
      const current = inputsFromAccess(access);
      const ids = new Set(current.map((input) => input.id));
      current.forEach(subscribe);
      for (const id of [...bound.current.keys()]) {
        if (!ids.has(id)) {
          unsubscribe(id);
        }
      }
      setActiveInputs(current.filter((input) => input.state !== "disconnected").map((input) => input.name ?? input.id));
    };

    sync();
    const onState = () => sync();
    // addEventListener coexists with App's `access.onstatechange = ...` property handler.
    access.addEventListener?.("statechange", onState);

    return () => {
      access.removeEventListener?.("statechange", onState);
      const byId = new Map(inputsFromAccess(access).map((input) => [input.id, input]));
      for (const id of [...bound.current.keys()]) {
        unsubscribe(id, byId.get(id));
      }
    };
  }, [options.access, options.enabled]);

  return { activeInputs };
}
