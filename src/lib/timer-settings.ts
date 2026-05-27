export type TimerSettings = {
  workMinutes: number;
  breakMinutes: number;
};

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  workMinutes: 25,
  breakMinutes: 5,
};

export const TIMER_SETTINGS_KEY = "chonk-break.timer-settings";
export const TIMER_SETTINGS_CHANGED = "timer-settings-changed";

function sanitizeMinutes(value: unknown, fallback: number) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return fallback;
  }

  return Math.min(Math.max(minutes, 1), 180);
}

export function normalizeSettings(settings: Partial<TimerSettings>): TimerSettings {
  return {
    workMinutes: sanitizeMinutes(
      settings.workMinutes,
      DEFAULT_TIMER_SETTINGS.workMinutes,
    ),
    breakMinutes: sanitizeMinutes(
      settings.breakMinutes,
      DEFAULT_TIMER_SETTINGS.breakMinutes,
    ),
  };
}

export function loadTimerSettings() {
  const rawSettings = localStorage.getItem(TIMER_SETTINGS_KEY);

  if (!rawSettings) {
    return DEFAULT_TIMER_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(rawSettings) as Partial<TimerSettings>);
  } catch {
    return DEFAULT_TIMER_SETTINGS;
  }
}

export function saveTimerSettings(settings: TimerSettings) {
  const normalizedSettings = normalizeSettings(settings);
  localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(normalizedSettings));
  return normalizedSettings;
}

export function minutesToSeconds(minutes: number) {
  return Math.round(minutes * 60);
}

export function formatTime(totalSeconds: number) {
  const clampedSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
