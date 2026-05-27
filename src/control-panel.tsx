/**
 * ControlPanel.tsx — single source of truth
 *
 * Owns: timer (via useTimer), mode resolution, settings.
 * Drives App window via Tauri broadcast events.
 *
 * Events emitted:
 *   PHASE_CHANGED       → "work" | "break"
 *   TIMER_TICK          → remaining seconds (number)
 *   MODE_ACTIVE_CHANGED → resolved Mode string
 *   TIMER_SETTINGS_CHANGED → TimerSettings (for any other listener)
 *
 * Events consumed:
 *   MODE_CHANGED        → user picked a new mode selection
 *   MODE_STATE_REQUESTED → App asking for current snapshot on mount
 *   chonk:skip          → skip button from tray / shortcut
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

import {
  X,
  Save,
  DoorOpen,
  Shuffle,
  Repeat,
  BedDouble,
  BriefcaseBusiness,
  Settings,
} from "lucide-react";

import "./App.css";

import { Button } from "./components/ui/button";
import { SceneListPage, SceneEditorPage } from "./components/scene-editor";

import {
  loadTimerSettings,
  normalizeSettings,
  saveTimerSettings,
  TIMER_SETTINGS_CHANGED,
  type TimerSettings,
} from "./lib/timer-settings";

import {
  loadModeSelection,
  saveModeSelection,
  type ModeSelection,
} from "./lib/modes-selection";

import {
  MODE_CHANGED,
  MODE_ACTIVE_CHANGED,
  MODE_STATE_REQUESTED,
  PHASE_CHANGED,
  type Mode,
} from "./config/modes";

import { TIMER_TICK, SCENE_PREVIEW, SCENE_PREVIEW_CLEAR } from "./config/events";

import { syncSceneLibrary } from "./lib/scene-library";
import { useTimer, type TimerPhase } from "./hook/useTimer";
// import { createBattleSceneItems } from "./config/scenes";
import type { SceneItem } from "./lib/chonk";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type TimerSettingsDraft = { workMinutes: string; breakMinutes: string };
type Page = "main" | "scenes" | "edit";

function settingsToDraft(s: TimerSettings): TimerSettingsDraft {
  return { workMinutes: String(s.workMinutes), breakMinutes: String(s.breakMinutes) };
}

function draftToSettings(d: TimerSettingsDraft): TimerSettings {
  return normalizeSettings({
    workMinutes: Number(d.workMinutes),
    breakMinutes: Number(d.breakMinutes),
  });
}

function getModeLabel(mode: Mode) {
  return mode === "battle" ? "??B@77L3??" : mode;
}

function buildAvailableModes(externalModes: string[]): Mode[] {
  const set = new Set<string>(["meme", ...externalModes]);
  if (externalModes.length > 0) set.add("battle");
  return Array.from(set) as Mode[];
}

// ---------------------------------------------------------------------------
// Mode resolution (pure, no side-effects)
// ---------------------------------------------------------------------------

function resolveMode(
  selection: ModeSelection,
  available: Mode[],
  carouselIndexRef: React.MutableRefObject<number>,
  currentMode: Mode,
): Mode {
  const pool = available.length > 0 ? available : ["meme" as Mode];

  if (selection === "random") {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  if (selection === "carousel") {
    if (carouselIndexRef.current < 0) {
      const idx = pool.indexOf(currentMode);
      carouselIndexRef.current = idx >= 0 ? idx : 0;
      return pool[carouselIndexRef.current];
    }
    const next = (carouselIndexRef.current + 1) % pool.length;
    carouselIndexRef.current = next;
    return pool[next];
  }

  return pool.includes(selection as Mode) ? (selection as Mode) : "meme";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ControlPanel() {
  // --- settings ---
  const [settings, setSettings] = useState<TimerSettings>(loadTimerSettings);
  const [draft, setDraft] = useState(() => settingsToDraft(loadTimerSettings()));
  const [savedAt, setSavedAt] = useState("");

  // --- mode state ---
  const [modeSelection, setModeSelection] = useState<ModeSelection>("meme");
  const [activeMode, setActiveMode] = useState<Mode>("meme");
  const [availableModes, setAvailableModes] = useState<Mode[]>(["meme"]);
  // const [byMode, setByMode] = useState<Record<string, SceneItem[]>>({});

  // refs for use inside callbacks / effects without stale closure issues
  const carouselIndexRef = useRef(-1);
  const activeModeRef = useRef<Mode>("meme");
  const nextModeRef = useRef<Mode>("meme");   // mode queued for next break
  const modeSelectionRef = useRef<ModeSelection>("meme");
  const availableModesRef = useRef<Mode[]>(["meme"]);

  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { modeSelectionRef.current = modeSelection; }, [modeSelection]);
  useEffect(() => { availableModesRef.current = availableModes; }, [availableModes]);

  // --- UI ---
  const [show, setShow] = useState(false);
  const [page, setPage] = useState<Page>("main");
  const [editingMode, setEditingMode] = useState({ name: "", isNew: true });

  // true while SceneEditorPage is mounted — pauses timer + drives App preview
  const [isPreviewing, setIsPreviewing] = useState(false);

  // ---------------------------------------------------------------------------
  // Emit helpers
  // ---------------------------------------------------------------------------

  const emitMode = useCallback(async (mode: Mode) => {
    setActiveMode(mode);
    activeModeRef.current = mode;
    await emit(MODE_ACTIVE_CHANGED, mode);
  }, []);

  const emitPhase = useCallback(async (phase: TimerPhase) => {
    setShow(phase === "break");
    await emit(PHASE_CHANGED, phase);
  }, []);

  const handlePreview = useCallback((items: SceneItem[]) => {
    void emit(SCENE_PREVIEW, items);
  }, []);

  // ---------------------------------------------------------------------------
  // Timer — useTimer drives countdown; callbacks emit events to App
  // ---------------------------------------------------------------------------

  const handlePhaseChange = useCallback(
    async (nextPhase: TimerPhase) => {
      await emitPhase(nextPhase);

      if (nextPhase === "break") {
        // apply the queued mode
        await emitMode(nextModeRef.current);
      } else {
        // work phase: pre-resolve next break mode
        const next = resolveMode(
          modeSelectionRef.current,
          availableModesRef.current,
          carouselIndexRef,
          activeModeRef.current,
        );
        nextModeRef.current = next;
        await emit(MODE_ACTIVE_CHANGED, next); // preview in panel
      }
    },
    [emitMode, emitPhase],
  );

  const { phase, remainingSeconds, skip } = useTimer({
    settings,
    paused: isPreviewing,
    onPhaseChange: handlePhaseChange,
  });

  // Broadcast tick every second so App windows stay in sync
  useEffect(() => {
    void emit(TIMER_TICK, remainingSeconds);
  }, [remainingSeconds]);

  // ---------------------------------------------------------------------------
  // Init: load saved mode + scene library
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const setup = async () => {
      const saved = await loadModeSelection();
      const payload = await syncSceneLibrary();

      const externalModes = payload.modes
        .map((m) => m.mode)
        .filter((m) => m !== "meme");

      const available = buildAvailableModes(externalModes);
      const modeByKey: Record<string, SceneItem[]> = {};
      payload.modes.forEach((m) => { modeByKey[m.mode] = m.items; });

      setAvailableModes(available);
      // setByMode(modeByKey);
      availableModesRef.current = available;

      const normalizedSelection =
        available.includes(saved as Mode) || saved === "random" || saved === "carousel"
          ? saved
          : "meme";

      modeSelectionRef.current = normalizedSelection;
      setModeSelection(normalizedSelection);

      const resolved = resolveMode(normalizedSelection, available, carouselIndexRef, "meme");
      nextModeRef.current = resolved;
      await emitMode(resolved);
      await emitPhase("work");
    };

    void setup().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ---------------------------------------------------------------------------
  // Listen: MODE_CHANGED from self or other windows
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<ModeSelection>(MODE_CHANGED, async (event) => {
        const selection = await saveModeSelection(event.payload);
        if (selection !== "carousel") carouselIndexRef.current = -1;

        modeSelectionRef.current = selection;
        setModeSelection(selection);

        const resolved = resolveMode(
          selection,
          availableModesRef.current,
          carouselIndexRef,
          activeModeRef.current,
        );

        nextModeRef.current = resolved;

        if (selection === "battle" && phase === "break") {
          await emitMode("battle");
        } else {
          await emitMode(resolved);
        }
      });
    };

    void setup().catch(console.error);
    return () => unlisten?.();
  }, [emitMode, phase]);

  // ---------------------------------------------------------------------------
  // Listen: MODE_STATE_REQUESTED — App window asking for a snapshot on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen(MODE_STATE_REQUESTED, async () => {
        await emit(PHASE_CHANGED, phase);
        await emit(TIMER_TICK, remainingSeconds);
        await emit(MODE_ACTIVE_CHANGED, activeMode);
      });
    };

    void setup();
    return () => unlisten?.();
  }, [phase, remainingSeconds, activeMode]);

  // ---------------------------------------------------------------------------
  // Listen: chonk:skip — tray button / global shortcut
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => { unlisten = await listen("chonk:skip", skip); };
    void setup();
    return () => unlisten?.();
  }, [skip]);

  // ---------------------------------------------------------------------------
  // Settings save
  // ---------------------------------------------------------------------------

  const commitSettings = async (next: TimerSettings) => {
    const normalized = saveTimerSettings(next);
    setSettings(normalized);
    setDraft(settingsToDraft(normalized));
    setSavedAt(new Date().toLocaleTimeString());
    await emit(TIMER_SETTINGS_CHANGED, normalized);
  };

  // --- mode helpers for UI ---
  const isRandom = modeSelection === "random";
  const isCarousel = modeSelection === "carousel";
  const canChooseModes = availableModes.length > 1;

  const setMode = async (next: ModeSelection) => {
    const normalized = await saveModeSelection(next);
    setModeSelection(normalized);
    await emit(MODE_CHANGED, normalized);
  };

  // ---------------------------------------------------------------------------
  // Sub-pages
  // ---------------------------------------------------------------------------

  if (page === "scenes") {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground drag">
        <SceneListPage
          onBack={() => setPage("main")}
          onEdit={(mode) => { setEditingMode({ name: mode, isNew: false }); setPage("edit"); }}
          onNew={() => { setEditingMode({ name: "", isNew: true }); setPage("edit"); }}
        />
      </main>
    );
  }

  if (page === "edit") {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground drag">
        <SceneEditorPage
          modeName={editingMode.name}
          isNew={editingMode.isNew}
          onMount={() => setIsPreviewing(true)}
          onBack={() => {
            setIsPreviewing(false);
            void emit(SCENE_PREVIEW_CLEAR);
            setPage("scenes");
          }}
          onSaved={() => {
            setIsPreviewing(false);
            void emit(SCENE_PREVIEW_CLEAR);
            void syncSceneLibrary();
          }}
          onPreview={handlePreview}
        />
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Main page
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-background p-4 text-foreground drag">
      <form
        className="flex min-h-[calc(100vh-2rem)] flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void commitSettings(draftToSettings(draft));
        }}
      >
        {/* Header */}
        <header className="relative space-y-1">
          <div>
            <h1 className="text-xl font-semibold">Chonk Control</h1>
            <p className="text-sm text-muted-foreground">negotiate with the chonk.</p>
          </div>
          <Button
            type="button"
            onClick={() => invoke("hide_window").catch(console.error)}
            className="absolute top-0 right-0"
          >
            <X className="size-4" />
          </Button>
        </header>

        {/* Work minutes */}
        <div className="grid gap-2 text-sm font-medium">
          <span>work minutes</span>
          <input
            className="h-10 rounded-md border bg-background px-3 no-drag"
            type="number" min="1" max="180"
            value={draft.workMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, workMinutes: e.target.value }))}
          />
        </div>

        {/* Break minutes */}
        <div className="grid gap-2 text-sm font-medium">
          <span>break minutes</span>
          <input
            className="h-10 rounded-md border bg-background px-3 no-drag"
            type="number" min="1" max="180"
            value={draft.breakMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, breakMinutes: e.target.value }))}
          />
        </div>

        {/* Mode selector */}
        {canChooseModes && (
          <div className="grid gap-2 text-sm font-medium">
            <span>chonk mode</span>
            <div className="flex gap-2 items-center">
              <select
                className="h-10 flex-1 border rounded-md bg-background px-3 no-drag"
                value={isRandom || isCarousel ? activeMode : modeSelection}
                onChange={(e) => void setMode(e.target.value as Mode)}
              >
                {availableModes.map((mode) => (
                  <option key={mode} value={mode}>{getModeLabel(mode)}</option>
                ))}
              </select>

              <Button
                type="button"
                variant={isRandom ? "default" : "outline"}
                onClick={() => void setMode(isRandom ? activeMode : "random")}
              >
                <Shuffle className="size-4" />
              </Button>

              <Button
                type="button"
                variant={isCarousel ? "default" : "outline"}
                onClick={() => void setMode(isCarousel ? activeMode : "carousel")}
              >
                <Repeat className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto grid gap-2">
          <Button type="submit" onClick={() => invoke("hide_window").catch(console.error)}>
            <Save className="size-4" />
            save it
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => { skip(); }}
          >
            {show ? <BriefcaseBusiness className="size-4" /> : <BedDouble className="size-4" />}
            {show ? "let me work!!!" : "let me break!!!"}
          </Button>

          <Button type="button" variant="outline" onClick={() => setPage("scenes")}>
            <Settings className="size-4" />
            manage scenes
          </Button>

          <Button type="button" variant="outline" onClick={() => invoke("quit_app").catch(console.error)}>
            <DoorOpen className="size-4" />
            let me out
          </Button>

          <p className="text-center text-xs text-muted-foreground h-5">
            {savedAt ? `saved at ${savedAt}` : ""}
          </p>
        </div>
      </form>
    </main>
  );
}

export default ControlPanel;