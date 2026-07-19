import { AccessibilityInfo, Platform } from "react-native";

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

let webRegion: HTMLElement | null = null;

function announceOnWeb(text: string): void {
  if (typeof document === "undefined") return;
  if (!webRegion || !document.body.contains(webRegion)) {
    webRegion = document.createElement("div");
    webRegion.setAttribute("role", "status");
    webRegion.setAttribute("aria-live", "polite");
    // Visually hidden but kept in the accessibility tree.
    Object.assign(webRegion.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "-1px",
      border: "0",
      padding: "0",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(webRegion);
  }
  // Clear first so logging the same item twice re-announces.
  webRegion.textContent = "";
  const region = webRegion;
  window.setTimeout(() => {
    region.textContent = text;
  }, 30);
}

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
