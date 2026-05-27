import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SceneLayout } from "./chonk";

export type SaveableItem = {
  src: string;
  layout: SceneLayout;
  motionKey?: "rotate" | "slide";
};

export type SceneManifest = {
  text: string | null;
  items: SaveableItem[];
};

export type AssetInfo = {
  name: string;
  fullPath: string;
  url: string;
};

export async function getSceneMode(modeName: string): Promise<SceneManifest> {
  return invoke<SceneManifest>("get_scene_mode", { modeName });
}

export async function saveSceneMode(
  modeName: string,
  text: string,
  items: SaveableItem[],
): Promise<void> {
  await invoke("save_scene_mode", { modeName, text, items });
}

export async function deleteSceneMode(modeName: string): Promise<void> {
  await invoke("delete_scene_mode", { modeName });
}

export async function importSceneAsset(
  modeName: string,
  fileName: string,
  data: number[],
): Promise<AssetInfo> {
  const fullPath = await invoke<string>("import_scene_asset", { modeName, fileName, data });
  const name = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  return { name, fullPath, url: convertFileSrc(fullPath) };
}

export async function listSceneAssets(modeName: string): Promise<AssetInfo[]> {
  const paths = await invoke<string[]>("list_scene_assets", { modeName });
  return paths.map((p) => {
    const name = p.replace(/\\/g, "/").split("/").pop() ?? p;
    return { name, fullPath: p, url: convertFileSrc(p) };
  });
}
