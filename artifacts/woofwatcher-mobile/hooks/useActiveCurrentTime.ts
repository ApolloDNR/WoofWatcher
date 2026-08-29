import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Care status changes are minute-scale, so a 30-second focused refresh keeps
 * due-now UI timely without leaving a high-frequency timer running.
 */
export const ACTIVE_CURRENT_TIME_INTERVAL_MS = 30_000;

export function routeMotionIsActive(
  routeFocused: boolean,
  appState: AppStateStatus,
): boolean {
  return routeFocused && appState === "active";
}

/**
 * True only while the component's route is focused and the app is in the
 * foreground. Kept beside the active clock so perpetual motion and wall-clock
 * refreshes share one lifecycle rule.
 */
export function useRouteMotionActive(): boolean {
  const navigation = useNavigation();
  const [active, setActive] = useState(() =>
    routeMotionIsActive(navigation.isFocused(), AppState.currentState),
  );

  useFocusEffect(
    useCallback(() => {
      let appState = AppState.currentState;

      const syncActivity = () => {
        setActive(routeMotionIsActive(true, appState));
      };

      const subscription = AppState.addEventListener("change", (nextState) => {
        appState = nextState;
        syncActivity();
      });

      syncActivity();
      return () => {
        subscription.remove();
        setActive(false);
      };
    }, []),
  );

  return active;
}

/**
 * Returns wall-clock time that stays fresh only while the current route and
 * app are active. Focus and foreground transitions refresh immediately; blur,
 * background, and unmount all remove both the listener and interval.
 */
export function useActiveCurrentTime(
  intervalMs: number = ACTIVE_CURRENT_TIME_INTERVAL_MS,
): number {
  const [now, setNow] = useState(() => Date.now());
  const routeMotionActive = useRouteMotionActive();
  const refreshNow = useCallback(() => setNow(Date.now()), []);
  const refreshIntervalMs =
    Number.isFinite(intervalMs) && intervalMs >= 1_000
      ? intervalMs
      : ACTIVE_CURRENT_TIME_INTERVAL_MS;

  useEffect(() => {
    if (!routeMotionActive) return;
    refreshNow();
    const timer = setInterval(refreshNow, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refreshIntervalMs, refreshNow, routeMotionActive]);

  return now;
}
