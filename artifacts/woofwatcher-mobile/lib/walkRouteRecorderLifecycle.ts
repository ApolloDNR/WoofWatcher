export interface WalkRouteRecorderActiveState {
  readonly identityKey: string | null;
  readonly sessionKey: string | null;
}

export interface WalkRouteRecorderTransition {
  readonly cancelCapture: boolean;
  readonly finishSessionKey: string | null;
  readonly startSessionKey: string | null;
  readonly next: WalkRouteRecorderActiveState;
}

export interface WalkRouteRecorderCareAdmissionInput {
  readonly isLoaded: boolean;
  readonly identityScopeState: "local" | "pending" | "resolved" | "error";
  readonly initialSyncSettled: boolean;
  readonly storageWarning: string | null;
}

export interface WalkRouteRecorderAdmissionGate {
  /** Opens/closes admission for one committed layout generation. */
  commit(admitted: boolean): () => void;
  isAdmitted(): boolean;
}

/**
 * Keeps native callback admission owned by committed React layout, never by
 * speculative render. Each cleanup is generation-bound so an older discarded
 * tree cannot close a newer committed identity.
 */
export function createWalkRouteRecorderAdmissionGate(): WalkRouteRecorderAdmissionGate {
  let generation = 0;
  let admitted = false;
  return Object.freeze({
    commit(nextAdmitted: boolean) {
      generation += 1;
      const committedGeneration = generation;
      admitted = nextAdmitted;
      return () => {
        if (generation !== committedGeneration) return;
        admitted = false;
      };
    },
    isAdmitted() {
      return admitted;
    },
  });
}

/**
 * Location capture is a personal-data producer, so hydrated cache alone is
 * insufficient for signed-in accounts. The exact Care generation must first
 * finish its authoritative refresh. Local mode is admitted by the same
 * readiness signal after successful hydration. Future-schema data remains
 * opaque and can never authorize a recorder.
 */
export function isWalkRouteRecorderIdentityAdmitted(
  input: WalkRouteRecorderCareAdmissionInput,
): boolean {
  return (
    input.isLoaded &&
    (input.identityScopeState === "local" ||
      input.identityScopeState === "resolved") &&
    input.initialSyncSettled &&
    input.storageWarning !== "newer-version"
  );
}

interface CareOperationPermitLike {
  readonly identityKey: string;
}

export interface WalkRouteOperationAuthority<
  CarePermit extends CareOperationPermitLike,
  LocalIntent,
> {
  readonly identityKey: string;
  readonly carePermit: CarePermit;
  readonly localDataIntent: LocalIntent;
}

/**
 * Accept a Care identity only when the provider is loaded and its render key
 * agrees with the exact operation permit. Signed-out local mode intentionally
 * has no public identityScopeKey, so its `signed-out` permit is authoritative.
 */
export function resolveWalkRouteRecorderIdentity<
  CarePermit extends CareOperationPermitLike,
>(input: {
  isLoaded: boolean;
  identityScopeKey: string | null;
  carePermit: CarePermit | null;
}): string | null {
  if (!input.isLoaded || !input.carePermit) return null;
  if (
    input.identityScopeKey !== null &&
    input.identityScopeKey !== input.carePermit.identityKey
  ) {
    return null;
  }
  return input.carePermit.identityKey;
}

export function captureWalkRouteOperationAuthority<
  CarePermit extends CareOperationPermitLike,
  LocalIntent,
>(input: {
  isLoaded: boolean;
  identityScopeKey: string | null;
  captureCarePermit: () => CarePermit | null;
  captureLocalDataIntent: () => LocalIntent | null;
}): WalkRouteOperationAuthority<CarePermit, LocalIntent> | null {
  const carePermit = input.captureCarePermit();
  const identityKey = resolveWalkRouteRecorderIdentity({
    isLoaded: input.isLoaded,
    identityScopeKey: input.identityScopeKey,
    carePermit,
  });
  if (!carePermit || !identityKey) return null;
  const localDataIntent = input.captureLocalDataIntent();
  if (!localDataIntent) return null;
  return Object.freeze({ identityKey, carePermit, localDataIntent });
}

export function isWalkRouteOperationAuthorityCurrent<
  CarePermit extends CareOperationPermitLike,
  LocalIntent,
>(
  authority: WalkRouteOperationAuthority<CarePermit, LocalIntent>,
  input: {
    isCarePermitCurrent: (permit: CarePermit) => boolean;
    isLocalDataIntentCurrent: (intent: LocalIntent) => boolean;
  },
): boolean {
  return (
    input.isCarePermitCurrent(authority.carePermit) &&
    input.isLocalDataIntentCurrent(authority.localDataIntent)
  );
}

/**
 * Extends the exact Care/reset permit check with render-time recorder
 * admission. A first-sync or future-schema transition can therefore revoke a
 * late platform callback before React's cancellation effect tears down the
 * underlying watch.
 */
export function isWalkRouteRecorderAuthorityCurrent<
  CarePermit extends CareOperationPermitLike,
  LocalIntent,
>(
  authority: WalkRouteOperationAuthority<CarePermit, LocalIntent>,
  input: {
    isRecorderAdmitted: () => boolean;
    isCarePermitCurrent: (permit: CarePermit) => boolean;
    isLocalDataIntentCurrent: (intent: LocalIntent) => boolean;
  },
): boolean {
  return (
    input.isRecorderAdmitted() &&
    isWalkRouteOperationAuthorityCurrent(authority, input)
  );
}

/**
 * Pure transition planner for the shipping bridge. An identity change cancels
 * instead of finishing, so A's route can never be persisted by B's callbacks.
 * A reset pause is held for the same identity and resumed only after admission
 * reopens.
 */
export function planWalkRouteRecorderTransition(input: {
  active: WalkRouteRecorderActiveState;
  currentIdentityKey: string | null;
  currentSessionKey: string | null;
  captureStatus:
    | "idle"
    | "starting"
    | "recording"
    | "paused"
    | "denied"
    | "unavailable";
  careMutationsBlocked: boolean;
}): WalkRouteRecorderTransition {
  if (!input.currentIdentityKey) {
    return {
      cancelCapture: true,
      finishSessionKey: null,
      startSessionKey: null,
      next: { identityKey: null, sessionKey: null },
    };
  }

  const identityChanged =
    input.active.identityKey !== null &&
    input.active.identityKey !== input.currentIdentityKey;
  const previousSessionKey = identityChanged ? null : input.active.sessionKey;

  if (input.careMutationsBlocked) {
    return {
      cancelCapture: identityChanged,
      finishSessionKey: null,
      startSessionKey: null,
      next: {
        identityKey: input.currentIdentityKey,
        sessionKey: previousSessionKey,
      },
    };
  }

  if (previousSessionKey === input.currentSessionKey) {
    const shouldResume =
      input.currentSessionKey !== null &&
      (input.captureStatus === "paused" || input.captureStatus === "idle");
    return {
      cancelCapture: identityChanged,
      finishSessionKey: null,
      startSessionKey: shouldResume ? input.currentSessionKey : null,
      next: {
        identityKey: input.currentIdentityKey,
        sessionKey: input.currentSessionKey,
      },
    };
  }

  return {
    cancelCapture: identityChanged,
    finishSessionKey: previousSessionKey,
    startSessionKey: input.currentSessionKey,
    next: {
      identityKey: input.currentIdentityKey,
      sessionKey: input.currentSessionKey,
    },
  };
}
