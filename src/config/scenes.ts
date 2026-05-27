import type { SceneItem } from "../lib/chonk";

export type SceneModeData = {
  mode: string;
  text: string;
  items: SceneItem[];
};

export type SceneLibraryPayload = {
  modes: SceneModeData[];
};

export function createBattleSceneItems(
  scenesByMode: Record<string, SceneItem[]>,
  count = 6,
): SceneItem[] {
  const pool = Object.entries(scenesByMode)
    .filter(([mode]) => mode !== "battle")
    .flatMap(([, items]) => items);

  if (pool.length <= count) {
    return [...pool];
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}
