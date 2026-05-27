import { load } from "@tauri-apps/plugin-store";

export type ModeSelection = string | "carousel" | "random";

const STORE_FILE = "settings.json";
const MODE_SELECTION_KEY = "modeSelection";
export const DEFAULT_MODE_SELECTION: ModeSelection = "meme";

export function normalizeModeSelection(value: unknown): ModeSelection {
  if (typeof value !== "string" || value.trim().length === 0) {
    return DEFAULT_MODE_SELECTION;
  }
  return value;
}

async function getStore() {
  return load(STORE_FILE, { autoSave: true, defaults: {} });
}

export async function loadModeSelection(): Promise<ModeSelection> {
  const store = await getStore();
  const raw = await store.get<string>(MODE_SELECTION_KEY);
  return normalizeModeSelection(raw);
}

export async function saveModeSelection(modeSelection: ModeSelection): Promise<ModeSelection> {
  const normalized = normalizeModeSelection(modeSelection);
  const store = await getStore();
  await store.set(MODE_SELECTION_KEY, normalized);
  return normalized;
}
