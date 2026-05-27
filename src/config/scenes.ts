import type { SceneItem } from "../lib/chonk";

export type SceneModeData = {
  mode: string;
  text: string;
  items: SceneItem[];
};

export type SceneLibraryPayload = {
  modes: SceneModeData[];
};

export function getDefaultMemeScene(): SceneModeData {
  return {
    mode: "meme",
    text: "Meowww Meme",
    items: [
      {
        src: "meme/rotate.gif",
        layout: { x: 40, y: 40, size: 18, z: 10, orbitX: "20vw" },
        motionKey: "rotate",
      },
      {
        src: "meme/angry.gif",
        layout: { x: 0, y: 0, size: 16, z: 8, anchorX: "left", anchorY: "bottom" },
      },
      {
        src: "meme/640.gif",
        layout: { x: 22, y: 20, size: 18, z: 8 },
      },
      {
        src: "meme/huh-cat.gif",
        layout: { x: 60, y: 50, size: 10, z: 8 },
      },
      {
        src: "meme/crying-cat.gif",
        layout: { x: 1, y: 0, size: 26, z: 8, anchorX: "right", anchorY: "bottom" },
      },
      {
        src: "meme/cat-spinning.gif",
        layout: { x: 80, y: 30, size: 12, z: 9 },
      },
    ],
  };
}

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
