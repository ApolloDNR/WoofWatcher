import { normalizeCareEventType } from "@workspace/care-domain";

export interface WalkRouteArmingEntry {
  id?: string;
  type?: string;
  occurredAt?: string;
  caregiverUserId?: string;
  details?: Record<string, unknown> | null;
}

export interface WalkRouteCaptureArming {
  sessionKey: string;
}

export interface ArmedWalkSessionOptions {
  lifecycle: "in-progress" | "completed";
  isSignedIn: boolean;
  userId: string | null | undefined;
}

let activeArming: WalkRouteCaptureArming | null = null;
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of listeners) listener();
}

export function walkRouteSessionKey(
  entry: WalkRouteArmingEntry | null | undefined,
): string | null {
  const startedAt = entry?.details?.walkStartedAt;
  return typeof startedAt === "string" && startedAt.trim()
    ? startedAt.trim()
    : null;
}

export function armWalkRouteCapture(
  sessionKey: string | null | undefined,
): void {
  const normalized = sessionKey?.trim() ?? "";
  if (!normalized) return;
  if (activeArming?.sessionKey === normalized) return;
  activeArming = { sessionKey: normalized };
  publish();
}

export function clearWalkRouteCaptureArming(
  sessionKey?: string | null,
): void {
  if (!activeArming) return;
  if (sessionKey && activeArming.sessionKey !== sessionKey) return;
  activeArming = null;
  publish();
}

export function getWalkRouteCaptureArming(): WalkRouteCaptureArming | null {
  return activeArming;
}

export function subscribeWalkRouteCaptureArming(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isLocallyArmedWalkSession(
  entry: WalkRouteArmingEntry,
  arming: WalkRouteCaptureArming | null,
  options: ArmedWalkSessionOptions,
): boolean {
  if (!arming || walkRouteSessionKey(entry) !== arming.sessionKey) {
    return false;
  }
  if (normalizeCareEventType(entry.type, entry.details) !== "walk") {
    return false;
  }
  if (entry.details?.walkLifecycle !== options.lifecycle) {
    return false;
  }
  if (!options.isSignedIn) return true;
  return Boolean(
    options.userId && entry.caregiverUserId === options.userId,
  );
}

export function findLocallyArmedWalkSession<
  TEntry extends WalkRouteArmingEntry,
>(
  entries: readonly TEntry[],
  options: ArmedWalkSessionOptions,
): TEntry | null {
  return findWalkSessionForArming(
    entries,
    getWalkRouteCaptureArming(),
    options,
  );
}

export function findWalkSessionForArming<
  TEntry extends WalkRouteArmingEntry,
>(
  entries: readonly TEntry[],
  arming: WalkRouteCaptureArming | null,
  options: ArmedWalkSessionOptions,
): TEntry | null {
  return (
    entries.find((entry) =>
      isLocallyArmedWalkSession(entry, arming, options),
    ) ?? null
  );
}
