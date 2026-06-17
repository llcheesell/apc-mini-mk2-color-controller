import type { GridColorSettings, LayoutState, SavedSlot } from "./types";

export function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function storeValue<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization errors
  }
}

const SLOTS_KEY = "apc-mini-mk2-slots";

export function loadSlots(): SavedSlot[] {
  const slots = loadStored<SavedSlot[]>(SLOTS_KEY, []);
  return Array.isArray(slots) ? slots : [];
}

export function saveSlots(slots: SavedSlot[]) {
  storeValue(SLOTS_KEY, slots);
}

export function createSlotId() {
  return `slot-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function addSlot(
  slots: SavedSlot[],
  name: string,
  layout: LayoutState,
  gridColors?: GridColorSettings,
): SavedSlot[] {
  const now = Date.now();
  const slot: SavedSlot = {
    id: createSlotId(),
    name: name.trim() || `Preset ${slots.length + 1}`,
    createdAt: now,
    updatedAt: now,
    layout,
    gridColors,
  };
  return [slot, ...slots];
}

export function updateSlot(slots: SavedSlot[], id: string, patch: Partial<SavedSlot>): SavedSlot[] {
  return slots.map((slot) => (slot.id === id ? { ...slot, ...patch, updatedAt: Date.now() } : slot));
}

export function removeSlot(slots: SavedSlot[], id: string): SavedSlot[] {
  return slots.filter((slot) => slot.id !== id);
}
