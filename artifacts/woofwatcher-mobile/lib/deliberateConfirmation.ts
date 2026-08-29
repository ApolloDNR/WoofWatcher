/**
 * A small identity-bound transition latch for destructive multi-step UI.
 * The next displayed control is temporarily disarmed so a browser double
 * click or rapid repeated activation cannot settle two distinct steps.
 */
export const DELIBERATE_CONFIRMATION_TRANSITION_MS = 500;

export interface DeliberateConfirmationLatch<T> {
  readonly transitionMs: number;
  active: boolean;
  target: T | undefined;
  readyAt: number;
  settled: boolean;
}

export function createDeliberateConfirmationLatch<T>(
  transitionMs: number,
): DeliberateConfirmationLatch<T> {
  if (!Number.isFinite(transitionMs) || transitionMs < 0) {
    throw new Error("The deliberate confirmation transition must be non-negative.");
  }
  return {
    transitionMs,
    active: false,
    target: undefined,
    readyAt: 0,
    settled: false,
  };
}

export function activateDeliberateConfirmation<T>(
  latch: DeliberateConfirmationLatch<T>,
  target: T,
  now: number,
): boolean {
  if (latch.active) return false;
  latch.active = true;
  latch.target = target;
  latch.readyAt = now;
  latch.settled = false;
  return true;
}

export function transitionDeliberateConfirmation<T>(
  latch: DeliberateConfirmationLatch<T>,
  target: T,
  now: number,
): boolean {
  if (!latch.active || !latch.settled) return false;
  latch.target = target;
  latch.readyAt = now + latch.transitionMs;
  latch.settled = false;
  return true;
}

export function trySettleDeliberateConfirmation<T>(
  latch: DeliberateConfirmationLatch<T>,
  target: T,
  now: number,
  options: Readonly<{ allowBeforeReady?: boolean }> = {},
): boolean {
  if (
    !latch.active ||
    latch.settled ||
    !Object.is(latch.target, target) ||
    (!options.allowBeforeReady && now < latch.readyAt)
  ) {
    return false;
  }
  latch.settled = true;
  return true;
}

export function getDeliberateConfirmationDelay<T>(
  latch: DeliberateConfirmationLatch<T>,
  target: T,
  now: number,
): number {
  if (!latch.active || latch.settled || !Object.is(latch.target, target)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, latch.readyAt - now);
}

export function resetDeliberateConfirmation<T>(
  latch: DeliberateConfirmationLatch<T>,
): void {
  latch.active = false;
  latch.target = undefined;
  latch.readyAt = 0;
  latch.settled = false;
}
