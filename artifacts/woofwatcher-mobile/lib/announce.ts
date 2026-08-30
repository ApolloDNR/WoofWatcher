import { AccessibilityInfo, Platform } from "react-native";

import {
  announceOnWeb,
  clearWebAnnouncements,
} from "./webAnnouncementRuntime.ts";

/**
 * Screen-reader announcement for state changes with no focused element -
 * the core care loop's "logged" feedback, storage warnings, validation.
 * Visual feedback (toasts, cards) is invisible to VoiceOver/TalkBack users
 * unless announced; a haptic alone cannot confirm WHAT happened.
 *
 * react-native-web's announceForAccessibility is a no-op (verified against
 * 0.21), so web gets a real ARIA live region instead. Fire-and-forget:
 * announcements must never break a care flow.
 */

export { clearWebAnnouncements };

export function announce(message: string): void {
  const text = message.trim();
  if (!text) return;
  try {
    if (Platform.OS === "web") {
      announceOnWeb(text);
      return;
    }
    AccessibilityInfo.announceForAccessibility(text);
  } catch {
    // Platform without announcement support - the visual path still works.
  }
}
