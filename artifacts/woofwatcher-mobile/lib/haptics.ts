import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Premium-feel haptic accents. Fire-and-forget: haptics must never block or
 * crash a care flow, so every call is guarded for native and swallows errors
 * (e.g. hardware without a vibrator, or haptics disabled in system settings).
 */
const canBuzz = Platform.OS === "ios" || Platform.OS === "android";

/** Soft tap for starting an action: quick-log tiles, primary buttons. */
export function hapticLight(): void {
  if (!canBuzz) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Confirmation buzz when a care moment is saved or a milestone unlocks. */
export function hapticSuccess(): void {
  if (!canBuzz) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Tiny tick for switching segments, tabs, and toggles. */
export function hapticSelect(): void {
  if (!canBuzz) return;
  Haptics.selectionAsync().catch(() => {});
}
