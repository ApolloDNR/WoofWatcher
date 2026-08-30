export interface CareAuthReadinessInput {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  /** Exact user/session/household key; null keeps signed-in auth pending. */
  identityKey: string | null;
}

export interface CareInitialSyncReadiness {
  observeAuth(input: CareAuthReadinessInput): void;
  canCaptureSyncAttempt(): boolean;
  captureSyncAttempt(): number | null;
  isSyncAttemptActive(attempt: number): boolean;
  settleSuccessfulSync(attempt: number): boolean;
  settleFailedSync(
    attempt: number,
    reason?: unknown,
    options?: CareInitialSyncFailureOptions,
  ): { accepted: boolean; retryDelayMs: number | null };
  requestRetry(): boolean;
  getStatus(localHydrated: boolean): CareInitialSyncStatus;
  isSettled(localHydrated: boolean): boolean;
}

export interface CareInitialSyncFailureOptions {
  /** Skip automatic retries and expose an error immediately. */
  terminal?: boolean;
  /** Whether the terminal error can be reopened by requestRetry(). */
  retryable?: boolean;
  /** Truthful user-facing explanation for this exact terminal failure. */
  message?: string;
}

export interface CareInitialSyncStatus {
  state: "pending" | "error" | "settled";
  isSettled: boolean;
  retryable: boolean;
  message: string | null;
}

export interface CareInitialSyncReadinessOptions {
  retryDelaysMs?: readonly number[];
}

const INITIAL_SYNC_ERROR_MESSAGE =
  "WoofWatcher could not confirm the current household records. Try again.";

/**
 * Tracks whether the first authoritative Care read for the current auth cycle
 * has succeeded. The generation token prevents a request that began for an
 * earlier sign-in cycle from making a later user's data look settled.
 */
export function createCareInitialSyncReadiness(
  options: CareInitialSyncReadinessOptions = {},
): CareInitialSyncReadiness {
  const retryDelaysMs = options.retryDelaysMs ?? [400, 1200];
  let authPhaseKey = "loading";
  let authGeneration = 0;
  let signedInSyncSettled = false;
  let syncAttemptCount = 0;
  let nextAttemptToken = 0;
  let activeAttemptToken: number | null = null;
  let terminalFailure = false;
  let terminalFailureRetryable = true;
  let terminalFailureMessage = INITIAL_SYNC_ERROR_MESSAGE;

  const status = (localHydrated: boolean): CareInitialSyncStatus => {
    if (!localHydrated || authPhaseKey === "loading") {
      return {
        state: "pending",
        isSettled: false,
        retryable: false,
        message: null,
      };
    }
    if (authPhaseKey === "signed-out" || signedInSyncSettled) {
      return {
        state: "settled",
        isSettled: true,
        retryable: false,
        message: null,
      };
    }
    if (terminalFailure) {
      return {
        state: "error",
        isSettled: false,
        retryable: terminalFailureRetryable,
        message: terminalFailureMessage,
      };
    }
    return {
      state: "pending",
      isSettled: false,
      retryable: false,
      message: null,
    };
  };

  const canCaptureSyncAttempt = (): boolean =>
    authPhaseKey.startsWith("signed-in:") &&
    !signedInSyncSettled &&
    !terminalFailure &&
    activeAttemptToken === null;

  return {
    observeAuth({ clerkLoaded, isSignedIn, identityKey }) {
      const normalizedIdentity = identityKey?.trim() || null;
      const nextPhaseKey =
        !clerkLoaded || (isSignedIn && !normalizedIdentity)
          ? "loading"
          : isSignedIn
            ? `signed-in:${normalizedIdentity!}`
            : "signed-out";
      if (nextPhaseKey === authPhaseKey) return;
      authPhaseKey = nextPhaseKey;
      authGeneration += 1;
      signedInSyncSettled = false;
      syncAttemptCount = 0;
      activeAttemptToken = null;
      terminalFailure = false;
      terminalFailureRetryable = true;
      terminalFailureMessage = INITIAL_SYNC_ERROR_MESSAGE;
    },
    canCaptureSyncAttempt,
    captureSyncAttempt() {
      if (!canCaptureSyncAttempt()) return null;
      syncAttemptCount += 1;
      nextAttemptToken += 1;
      activeAttemptToken = nextAttemptToken;
      return activeAttemptToken;
    },
    isSyncAttemptActive(attempt) {
      return (
        authPhaseKey.startsWith("signed-in:") &&
        attempt === activeAttemptToken &&
        !signedInSyncSettled &&
        !terminalFailure
      );
    },
    settleSuccessfulSync(attempt) {
      if (
        !authPhaseKey.startsWith("signed-in:") ||
        attempt !== activeAttemptToken ||
        signedInSyncSettled
      ) {
        return false;
      }
      activeAttemptToken = null;
      signedInSyncSettled = true;
      terminalFailure = false;
      terminalFailureRetryable = true;
      terminalFailureMessage = INITIAL_SYNC_ERROR_MESSAGE;
      return true;
    },
    settleFailedSync(attempt, _reason, options) {
      if (
        !authPhaseKey.startsWith("signed-in:") ||
        attempt !== activeAttemptToken ||
        signedInSyncSettled
      ) {
        return { accepted: false, retryDelayMs: null };
      }
      activeAttemptToken = null;
      const retryDelayMs = options?.terminal
        ? null
        : (retryDelaysMs[syncAttemptCount - 1] ?? null);
      terminalFailure = retryDelayMs === null;
      if (terminalFailure) {
        terminalFailureRetryable = options?.retryable ?? true;
        terminalFailureMessage =
          options?.message?.trim() || INITIAL_SYNC_ERROR_MESSAGE;
      }
      return { accepted: true, retryDelayMs };
    },
    requestRetry() {
      if (
        !authPhaseKey.startsWith("signed-in:") ||
        signedInSyncSettled ||
        !terminalFailure ||
        !terminalFailureRetryable
      ) {
        return false;
      }
      syncAttemptCount = 0;
      activeAttemptToken = null;
      terminalFailure = false;
      terminalFailureRetryable = true;
      terminalFailureMessage = INITIAL_SYNC_ERROR_MESSAGE;
      return true;
    },
    getStatus: status,
    isSettled(localHydrated) {
      return status(localHydrated).isSettled;
    },
  };
}

export async function runAtomicCareInitialRefresh<
  TPermit,
  TDoc,
  TEntries,
  TStaged,
>({
  permit,
  canContinue,
  fetchDoc,
  fetchEntries,
  stage,
  commit,
}: {
  permit: TPermit;
  canContinue(permit: TPermit): boolean;
  fetchDoc(): Promise<TDoc>;
  fetchEntries(): Promise<TEntries>;
  stage(doc: TDoc, entries: TEntries): TStaged;
  commit(staged: TStaged): void;
}): Promise<"committed" | "stale"> {
  const [doc, entries] = await Promise.all([fetchDoc(), fetchEntries()]);
  if (!canContinue(permit)) return "stale";
  const staged = stage(doc, entries);
  if (!canContinue(permit)) return "stale";
  commit(staged);
  return "committed";
}
