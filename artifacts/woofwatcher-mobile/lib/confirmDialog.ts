import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation: react-native-web ships no Alert
 * implementation, so destructive flows confirmed via Alert.alert would
 * silently no-op in web builds. Native uses Alert; web presents the themed
 * in-app dialog host mounted in app/_layout (components/WebDialogHost), so
 * "Memory saved" style notices match the board UI instead of raw
 * window.alert chrome. If no host is mounted (tests, very early calls),
 * web falls back to the browser's confirm/alert so every platform still
 * gets a real answer instead of a silent no-op.
 */

export interface ConfirmStepInput {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** One dialog the web host should render. `cancelLabel: null` = notice (OK only). */
export interface WebDialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string | null;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

type WebDialogPresenter = (request: WebDialogRequest) => void;

let webDialogPresenter: WebDialogPresenter | null = null;

/**
 * Registered by the themed web dialog host (mounted once in app/_layout).
 * Returns an unregister function; while registered, all web notices and
 * confirm steps route through the host instead of window.alert/confirm.
 */
export function registerWebDialogPresenter(present: WebDialogPresenter): () => void {
  webDialogPresenter = present;
  return () => {
    if (webDialogPresenter === present) webDialogPresenter = null;
  };
}

function noop(): void {}

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
    if (webDialogPresenter) {
      webDialogPresenter({
        title: step.title,
        message: step.message,
        confirmLabel: step.confirmLabel,
        cancelLabel: step.cancelLabel ?? "Cancel",
        destructive: step.destructive ?? false,
        onConfirm: () => confirmThroughSteps(rest, onConfirmed),
        onCancel: noop,
      });
      return;
    }
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

/** Cross-platform notice: Alert on native, themed dialog host on web. */
export function notifyDialog(title: string, message: string): void {
  if (Platform.OS === "web") {
    if (webDialogPresenter) {
      webDialogPresenter({
        title,
        message,
        confirmLabel: "OK",
        cancelLabel: null,
        destructive: false,
        onConfirm: noop,
        onCancel: noop,
      });
      return;
    }
    const dialog = (globalThis as { alert?: (text: string) => void }).alert;
    if (typeof dialog === "function") dialog(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
