import { useCallback, useEffect, useRef, useState } from "react";
import { minutesToSeconds, TimerSettings } from "../lib/timer-settings";

export type TimerPhase = "work" | "break";

export type UseTimerOptions = {
  settings: TimerSettings;
  paused?: boolean;
  onPhaseChange?: (phase: TimerPhase) => void;
  onSkip?: (nextPhase: TimerPhase) => void;
};

export type UseTimerReturn = {
  phase: TimerPhase;
  remainingSeconds: number;
  skip: () => void;
};

export function useTimer({ settings, paused = false, onPhaseChange, onSkip }: UseTimerOptions): UseTimerReturn {
  const [phase, setPhase] = useState<TimerPhase>("work");
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    minutesToSeconds(settings.workMinutes),
  );

  // refs so callbacks always see fresh values without re-subscribing
  const phaseRef = useRef<TimerPhase>("work");
  const settingsRef = useRef(settings);
  const skipPendingRef = useRef(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // reset timer when settings change
  useEffect(() => {
    setPhase("work");
    phaseRef.current = "work";
    setRemainingSeconds(minutesToSeconds(settings.workMinutes));
  }, [settings]);

  // countdown tick — suspended while paused (e.g. scene editor is open)
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () => setRemainingSeconds((s) => s - 1),
      1000,
    );
    return () => window.clearInterval(id);
  }, [paused]);

  const advancePhase = useCallback(() => {
    const current = phaseRef.current;
    const next: TimerPhase = current === "work" ? "break" : "work";
    const s = settingsRef.current;

    phaseRef.current = next;
    setPhase(next);
    setRemainingSeconds(
      next === "break"
        ? minutesToSeconds(s.breakMinutes)
        : minutesToSeconds(s.workMinutes),
    );

    onPhaseChange?.(next);
    onSkip?.(next);
  }, [onPhaseChange, onSkip]);

  // fire when countdown hits 0 or a skip was requested
  useEffect(() => {
    if (remainingSeconds > 0 && !skipPendingRef.current) return;
    skipPendingRef.current = false;
    advancePhase();
  }, [remainingSeconds, advancePhase]);

  const skip = useCallback(() => {
    skipPendingRef.current = true;
    // trigger the effect by nudging remainingSeconds to 0
    setRemainingSeconds(0);
  }, []);

  return { phase, remainingSeconds, skip };
}