/**
 * App.tsx — pure UI window
 *
 * Owns NO timer logic, NO mode resolution.
 * All state arrives via Tauri broadcast events from ControlPanel.
 *
 * Events consumed:
 *   PHASE_CHANGED       → show/hide break overlay
 *   TIMER_TICK          → remaining seconds to display
 *   MODE_ACTIVE_CHANGED → which scene / text to render
 */

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

import { formatTime } from "./lib/timer-settings";
import {
  MODE_ACTIVE_CHANGED,
  PHASE_CHANGED,
  type Mode,
} from "./config/modes";
import { TIMER_TICK, SCENE_PREVIEW, SCENE_PREVIEW_CLEAR } from "./config/events";

import ChonkScene from "./components/chonk-scene";
import {
  createBattleSceneItems,
  getDefaultMemeScene,
  type SceneModeData,
} from "./config/scenes";
import { getChonkDuration, type SceneItem } from "./lib/chonk";
import { syncSceneLibrary } from "./lib/scene-library";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimerPhase = "work" | "break";

type SceneState = {
  byMode: Record<string, SceneItem[]>;
  textByMode: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function App() {
  // --- scene library (loaded once; no logic, just data) ---
  const [sceneState, setSceneState] = useState<SceneState>({
    byMode: {},
    textByMode: {},
  });

  useEffect(() => {
    const setup = async () => {
      const payload = await syncSceneLibrary();
      const defaultMeme = getDefaultMemeScene();

      const modesMap = new Map<string, SceneModeData>();
      modesMap.set(defaultMeme.mode, defaultMeme);
      payload.modes.forEach((m) => modesMap.set(m.mode, m));

      const byMode: Record<string, SceneItem[]> = {};
      const textByMode: Record<string, string> = {};
      modesMap.forEach((value, key) => {
        byMode[key] = value.items;
        textByMode[key] = value.text;
      });

      setSceneState({ byMode, textByMode });
    };

    void setup().catch(console.error);
  }, []);

  // --- event-driven state ---
  const [phase, setPhase] = useState<TimerPhase>("work");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [activeMode, setActiveMode] = useState<Mode>("meme");

  // null = no preview; SceneItem[] = editor is open, show these items
  const [previewItems, setPreviewItems] = useState<SceneItem[] | null>(null);

  useEffect(() => {
    const unsubs = Promise.all([
      listen<TimerPhase>(PHASE_CHANGED, (e) => setPhase(e.payload)),
      listen<number>(TIMER_TICK, (e) => setRemainingSeconds(e.payload)),
      listen<Mode>(MODE_ACTIVE_CHANGED, (e) => setActiveMode(e.payload)),
      listen<SceneItem[]>(SCENE_PREVIEW, (e) => setPreviewItems(e.payload)),
      listen(SCENE_PREVIEW_CLEAR, () => setPreviewItems(null)),
    ]);

    return () => { void unsubs.then((fns) => fns.forEach((fn) => fn())); };
  }, []);

  // --- derived display values ---
  const BATTLE_TEXT = "#@!$%^&*??::BATTLE::??*&^%$!@#";

  // Recalculate battle items each time a break starts in battle mode,
  // so every break gets a fresh roll even if the mode didn't change.
  const [battleItems, setBattleItems] = useState<SceneItem[]>([]);
  useEffect(() => {
    if (phase === "break" && activeMode === "battle") {
      setBattleItems(createBattleSceneItems(sceneState.byMode));
    }
  }, [phase, activeMode]); // re-roll on every break entry

  const activeItems: SceneItem[] =
    activeMode === "battle"
      ? battleItems
      : (sceneState.byMode[activeMode] ?? sceneState.byMode.meme ?? []);

  const activeText =
    activeMode === "battle"
      ? BATTLE_TEXT
      : (sceneState.textByMode[activeMode] ?? sceneState.textByMode.meme ?? "Meowww Meme");

  // duration for animation pacing; derived from the tick value only when break starts
  // ControlPanel owns the real settings; App just uses whatever it's told
  const [breakDurationSeconds, setBreakDurationSeconds] = useState(0);
  useEffect(() => {
    if (phase === "break") setBreakDurationSeconds(remainingSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]); // intentionally only on phase change

  const duration = getChonkDuration(0, breakDurationSeconds / 60);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-8">
      {/* Scene editor live preview — takes over while editor is open */}
      {previewItems !== null && (
        <section className="break-overlay" aria-hidden>
          <ChonkScene sceneKey="preview" items={previewItems} duration={duration} />
        </section>
      )}

      {/* Normal break overlay — hidden while previewing */}
      {phase === "break" && previewItems === null && (
        <section className="break-overlay" aria-live="polite">
          <div className="break-overlay__shade" />
          <ChonkScene sceneKey={activeMode} items={activeItems} duration={duration} />
          <div className="break-timer-card">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/70">
              Chonk {phase}
            </p>
            <div className="mt-3 text-7xl font-semibold tabular-nums tracking-normal">
              {formatTime(remainingSeconds)}
            </div>
            <p className="mt-4 text-base text-white/80">{activeText}</p>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;