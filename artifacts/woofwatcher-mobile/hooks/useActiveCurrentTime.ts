import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";

/**
 * Care status changes are minute-scale, so a 30-second focused refresh keeps
 * due-now UI timely without leaving a high-frequency timer running.
 */
export const ACTIVE_CURRENT_TIME_INTERVAL_MS = 30_000;

/**
 * Returns wall-clock time that stays fresh only while the current route and
 * app are active. Focus and foreground transitions refresh immediately; blur,
 * background, and unmount all remove both the listener and interval.
 */
export function useActiveCurrentTime(
  intervalMs: number = ACTIVE_CURRENT_TIME_INTERVAL_MS,
): number {
  const [now, setNow] = useState(() => Date.now());
  const refreshNow = useCallback(() => setNow(Date.now()), []);
  const refreshIntervalMs =
    Number.isFinite(intervalMs) && intervalMs >= 1_000
      ? intervalMs
      : ACTIVE_CURRENT_TIME_INTERVAL_MS;

  useFocusEffect(
    useCallback(() => {
      let appState = AppState.currentState;
      let timer: ReturnType<typeof setInterval> | null = null;

      const stopTimer = () => {
        if (timer === null) return;
        clearInterval(timer);
        timer = null;
      };

      const syncTimer = () => {
        stopTimer();
        if (appState !== "active") return;
        refreshNow();
        timer = setInterval(refreshNow, refreshIntervalMs);
      };

      const subscription = AppState.addEventListener("change", (nextState) => {
        appState = nextState;
        syncTimer();
      });

      syncTimer();
      return () => {
        subscription.remove();
        stopTimer();
      };
    }, [refreshIntervalMs, refreshNow]),
  );

  return now;
}
