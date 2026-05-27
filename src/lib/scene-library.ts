import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SceneItem } from "./chonk";
import type { SceneLibraryPayload, SceneModeData } from "../config/scenes";

function normalizeItemPaths(mode: SceneModeData): SceneModeData {
  return {
    ...mode,
    items: mode.items.map((item) => {
      const src = item.src.includes(":") || item.src.startsWith("/")
        ? convertFileSrc(item.src)
        : item.src;

      return {
        ...item,
        src,
      } satisfies SceneItem;
    }),
  };
}

export async function syncSceneLibrary() {
  const payload = await invoke<SceneLibraryPayload>("sync_scene_library");
  return {
    modes: payload.modes.map(normalizeItemPaths),
  };
}
