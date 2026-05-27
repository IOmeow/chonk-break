/** Emitted by ControlPanel every second with the remaining seconds (number). */
export const TIMER_TICK = "chonk:timer-tick";
 
/** Emitted by ControlPanel when scene editor opens; payload: SceneItem[] draft. */
export const SCENE_PREVIEW = "chonk:scene-preview";
 
/** Emitted by ControlPanel when scene editor closes; no payload. */
export const SCENE_PREVIEW_CLEAR = "chonk:scene-preview-clear";