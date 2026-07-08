import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation: react-native-web ships no Alert
 * implementation, so destructive flows confirmed via Alert.alert would
 * silently no-op in web builds. Native uses Alert; web falls back to the
 * browser's confirm/alert so every platform gets a real answer.
 */

export interface ConfirmStepInput {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

function webConfirm(step: ConfirmStepInput): boolean {
  const dialog = (globalThis as { confirm?: (text: string) => boolean }).confirm;
  if (typeof dialog !== "function") return false;
  return dialog(`${step.title}\n\n${step.message}`);
}

/** Walks the steps in order; onConfirmed fires only if every step is accepted. */
export function confirmThroughSteps(
  steps: readonly ConfirmStepInput[],
  onConfirmed: () => void,
): void {
  if (!steps.length) {
    onConfirmed();
    return;
  }
  const [step, ...rest] = steps;

  if (Platform.OS === "web") {
    if (webConfirm(step)) {
      confirmThroughSteps(rest, onConfirmed);
    }
    return;
  }

  Alert.alert(step.title, step.message, [
    { text: step.cancelLabel ?? "Cancel", style: "cancel" },
    {
      text: step.confirmLabel,
      style: step.destructive ? "destructive" : "default",
      onPress: () => confirmThroughSteps(rest, onConfirmed),
    },
  ]);
}

/** Cross-platform notice: Alert on native, window.alert on web. */
export function notifyDialog(title: string, message: string): void {
  if (Platform.OS === "web") {
    const dialog = (globalThis as { alert?: (text: string) => void }).alert;
    if (typeof dialog === "function") dialog(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
