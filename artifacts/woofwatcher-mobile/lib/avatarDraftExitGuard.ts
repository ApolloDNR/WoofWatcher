export type AvatarDraftExitResult =
  | "blocked"
  | "exit-pending"
  | "confirmation-pending"
  | "confirmation-requested"
  | "exited";

export interface AvatarDraftExitConfirmationLatch {
  active: boolean;
  confirmationInFlight: boolean;
  exitDispatched: boolean;
  lifecycleVersion: number;
  requestVersion: number;
}

export function createAvatarDraftExitConfirmationLatch(): AvatarDraftExitConfirmationLatch {
  return {
    active: true,
    confirmationInFlight: false,
    exitDispatched: false,
    lifecycleVersion: 1,
    requestVersion: 0,
  };
}

export function activateAvatarDraftExitConfirmationLatch(
  latch: AvatarDraftExitConfirmationLatch,
): void {
  latch.active = true;
  latch.confirmationInFlight = false;
  latch.exitDispatched = false;
  latch.lifecycleVersion += 1;
  latch.requestVersion += 1;
}

export function invalidateAvatarDraftExitConfirmationLatch(
  latch: AvatarDraftExitConfirmationLatch,
): void {
  latch.active = false;
  latch.confirmationInFlight = false;
  latch.exitDispatched = false;
  latch.lifecycleVersion += 1;
  latch.requestVersion += 1;
}

export interface AvatarDraftExitInput {
  dirty: boolean;
  persistenceInFlight: boolean;
  confirmationLatch: AvatarDraftExitConfirmationLatch;
  confirmDiscard: (
    onConfirmed: () => void,
    onCancelled: () => void,
  ) => void;
  markClean: () => void;
  exit: () => void;
}

type AvatarDraftExitRequestHandler = (
  exit: () => void,
) => AvatarDraftExitResult;

let registeredAvatarDraftExitRequestHandler:
  | AvatarDraftExitRequestHandler
  | null = null;

/**
 * Registers the mounted Avatar Studio as the owner of route-level exits such
 * as a focused More-tab reselect. The identity check makes a stale cleanup
 * unable to unregister a newer mounted studio.
 */
export function registerAvatarDraftExitRequestHandler(
  handler: AvatarDraftExitRequestHandler,
): () => void {
  registeredAvatarDraftExitRequestHandler = handler;
  return () => {
    if (registeredAvatarDraftExitRequestHandler === handler) {
      registeredAvatarDraftExitRequestHandler = null;
    }
  };
}

export function requestRegisteredAvatarDraftExit(
  exit: () => void,
): AvatarDraftExitResult | "unhandled" {
  if (!registeredAvatarDraftExitRequestHandler) return "unhandled";
  return registeredAvatarDraftExitRequestHandler(exit);
}

function dispatchAvatarDraftExit(
  input: AvatarDraftExitInput,
): AvatarDraftExitResult {
  if (!input.confirmationLatch.active) return "blocked";
  if (input.confirmationLatch.exitDispatched) return "exit-pending";

  input.confirmationLatch.exitDispatched = true;
  try {
    input.exit();
  } catch (error) {
    input.confirmationLatch.exitDispatched = false;
    throw error;
  }
  return "exited";
}

export function requestAvatarDraftExit(
  input: AvatarDraftExitInput,
): AvatarDraftExitResult {
  if (!input.confirmationLatch.active) return "blocked";
  if (input.persistenceInFlight) return "blocked";
  if (input.confirmationLatch.exitDispatched) return "exit-pending";
  if (input.confirmationLatch.confirmationInFlight) {
    return "confirmation-pending";
  }

  if (!input.dirty) {
    return dispatchAvatarDraftExit(input);
  }

  const lifecycleVersion = input.confirmationLatch.lifecycleVersion;
  const requestVersion = input.confirmationLatch.requestVersion + 1;
  input.confirmationLatch.requestVersion = requestVersion;
  input.confirmationLatch.confirmationInFlight = true;
  let settled = false;

  const settle = (): boolean => {
    if (
      settled ||
      !input.confirmationLatch.active ||
      input.confirmationLatch.lifecycleVersion !== lifecycleVersion ||
      !input.confirmationLatch.confirmationInFlight ||
      input.confirmationLatch.requestVersion !== requestVersion
    ) {
      return false;
    }
    settled = true;
    input.confirmationLatch.confirmationInFlight = false;
    return true;
  };

  try {
    input.confirmDiscard(
      () => {
        if (!settle()) return;
        input.markClean();
        dispatchAvatarDraftExit(input);
      },
      () => {
        settle();
      },
    );
  } catch (error) {
    settle();
    throw error;
  }
  return "confirmation-requested";
}
