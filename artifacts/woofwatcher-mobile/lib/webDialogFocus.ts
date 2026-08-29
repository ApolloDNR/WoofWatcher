import { DELIBERATE_CONFIRMATION_TRANSITION_MS } from "./deliberateConfirmation.ts";

export const WEB_DIALOG_STEP_TRANSITION_MS =
  DELIBERATE_CONFIRMATION_TRANSITION_MS;

export function getNextWebDialogFocusIndex(
  currentIndex: number,
  focusableCount: number,
  shiftKey: boolean,
): number {
  if (focusableCount <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= focusableCount) {
    return shiftKey ? focusableCount - 1 : 0;
  }

  const direction = shiftKey ? -1 : 1;
  return (currentIndex + direction + focusableCount) % focusableCount;
}
