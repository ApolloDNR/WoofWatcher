import type {
  CareInitialSyncFailureOptions,
  CareInitialSyncReadiness,
} from "./careInitialSyncReadiness.ts";

export const FUTURE_CARE_SCHEMA_INITIAL_SYNC_MESSAGE =
  "These household records were saved by a newer WoofWatcher version. Update WoofWatcher before opening them.";

export interface CareLocalDocSnapshot<TDoc> {
  /** Monotonically increases for every accepted local document edit. */
  revision: number;
  doc: TDoc;
}

export interface CareInitialSyncDocSelection<TDoc> {
  doc: TDoc;
  capturedRevision: number;
  currentRevision: number;
  preservedConcurrentLocalEdit: boolean;
}

export type CareInitialSyncSettlement =
  | {
      kind: "success";
      accepted: true;
      retryDelayMs: null;
      reason: null;
    }
  | {
      kind: "failure";
      accepted: true;
      retryDelayMs: number | null;
      reason: unknown;
    }
  | {
      kind: "stale";
      accepted: false;
      retryDelayMs: null;
      reason: unknown;
    };

export interface CareInitialSyncLifecycleAttempt<TDoc> {
  readonly attemptToken: number;
  readonly capturedDocRevision: number;
  /**
   * Selects and synchronously commits the safe document at the last state
   * boundary. A local edit accepted after this attempt began always wins over
   * a response derived from the captured revision.
   */
  commitDoc(
    serverDoc: TDoc,
    commit: (selection: CareInitialSyncDocSelection<TDoc>) => void,
  ): CareInitialSyncDocSelection<TDoc> | null;
  succeed(): CareInitialSyncSettlement;
  fail(
    reason?: unknown,
    options?: CareInitialSyncFailureOptions,
  ): CareInitialSyncSettlement;
  failForFutureSchema(reason?: unknown): CareInitialSyncSettlement;
  /**
   * Settles an otherwise unresolved same-identity early return as a bounded
   * failure. Identity-stale attempts are ignored instead of touching the next
   * identity's readiness state.
   */
  finish(reason?: unknown): CareInitialSyncSettlement;
}

export interface CareInitialSyncLifecycleAttemptOptions<TDoc> {
  readiness: CareInitialSyncReadiness;
  /** Exact user/session/household identity captured by the caller. */
  isIdentityCurrent(): boolean;
  /** Reset/write-admission guard; defaults to isIdentityCurrent. */
  canApply?: () => boolean;
  readLocalDoc(): CareLocalDocSnapshot<TDoc>;
}

export interface CareInitialSyncLifecycleOptions<
  TDoc,
  TResult,
> extends CareInitialSyncLifecycleAttemptOptions<TDoc> {
  run(attempt: CareInitialSyncLifecycleAttempt<TDoc>): Promise<TResult>;
}

export type CareInitialSyncLifecycleRunResult<TResult> =
  | {
      started: false;
      value: undefined;
      error: undefined;
      settlement: null;
    }
  | {
      started: true;
      value: TResult | undefined;
      error: unknown;
      settlement: CareInitialSyncSettlement;
    };

const EARLY_EXIT_REASON = new Error(
  "The initial Care sync exited before its exact attempt settled.",
);

function staleSettlement(reason: unknown): CareInitialSyncSettlement {
  return {
    kind: "stale",
    accepted: false,
    retryDelayMs: null,
    reason,
  };
}

function createLifecycleAttempt<TDoc>({
  attemptToken,
  captured,
  readiness,
  isIdentityCurrent,
  canApply,
  readLocalDoc,
}: {
  attemptToken: number;
  captured: CareLocalDocSnapshot<TDoc>;
  readiness: CareInitialSyncReadiness;
  isIdentityCurrent(): boolean;
  canApply(): boolean;
  readLocalDoc(): CareLocalDocSnapshot<TDoc>;
}): CareInitialSyncLifecycleAttempt<TDoc> {
  let settlement: CareInitialSyncSettlement | null = null;

  const fail = (
    reason: unknown = EARLY_EXIT_REASON,
    options?: CareInitialSyncFailureOptions,
  ): CareInitialSyncSettlement => {
    if (settlement) return settlement;
    if (!isIdentityCurrent()) {
      settlement = staleSettlement(reason);
      return settlement;
    }
    const failed = readiness.settleFailedSync(attemptToken, reason, options);
    if (!failed.accepted) {
      settlement = staleSettlement(reason);
      return settlement;
    }
    settlement = {
      kind: "failure",
      accepted: true,
      retryDelayMs: failed.retryDelayMs,
      reason,
    };
    return settlement;
  };

  return {
    attemptToken,
    capturedDocRevision: captured.revision,
    commitDoc(serverDoc, commit) {
      if (
        settlement ||
        !readiness.isSyncAttemptActive(attemptToken) ||
        !isIdentityCurrent() ||
        !canApply()
      ) {
        return null;
      }
      const current = readLocalDoc();
      const preservedConcurrentLocalEdit =
        current.revision !== captured.revision;
      const selection: CareInitialSyncDocSelection<TDoc> = {
        doc: preservedConcurrentLocalEdit ? current.doc : serverDoc,
        capturedRevision: captured.revision,
        currentRevision: current.revision,
        preservedConcurrentLocalEdit,
      };
      // There is deliberately no await between the final authority checks and
      // the caller's refs/state commit.
      if (
        !readiness.isSyncAttemptActive(attemptToken) ||
        !isIdentityCurrent() ||
        !canApply()
      ) {
        return null;
      }
      commit(selection);
      return selection;
    },
    succeed() {
      if (settlement) return settlement;
      if (!isIdentityCurrent()) {
        settlement = staleSettlement(
          new Error("The Care identity changed before sync completion."),
        );
        return settlement;
      }
      if (!canApply()) {
        return fail(
          new Error(
            "The initial Care sync lost write/reset admission before completion.",
          ),
        );
      }
      if (!readiness.settleSuccessfulSync(attemptToken)) {
        settlement = staleSettlement(
          new Error("The Care sync attempt was no longer active."),
        );
        return settlement;
      }
      settlement = {
        kind: "success",
        accepted: true,
        retryDelayMs: null,
        reason: null,
      };
      return settlement;
    },
    fail,
    failForFutureSchema(reason = new Error("Newer Care data version")) {
      return fail(reason, {
        terminal: true,
        retryable: false,
        message: FUTURE_CARE_SCHEMA_INITIAL_SYNC_MESSAGE,
      });
    },
    finish(reason = EARLY_EXIT_REASON) {
      return settlement ?? fail(reason);
    },
  };
}

/**
 * Begins an exact attempt for integrations that already own a larger refresh
 * try/catch/finally block. A null result means readiness is already settled,
 * terminal, or another attempt is active; normal non-initial refresh work may
 * still continue independently.
 */
export function beginCareInitialSyncLifecycle<TDoc>({
  readiness,
  isIdentityCurrent,
  canApply = isIdentityCurrent,
  readLocalDoc,
}: CareInitialSyncLifecycleAttemptOptions<TDoc>): CareInitialSyncLifecycleAttempt<TDoc> | null {
  if (!readiness.canCaptureSyncAttempt()) return null;
  // Capture local state before reserving the readiness token. If a storage or
  // migration getter throws, no active attempt can be stranded.
  const captured = readLocalDoc();
  const attemptToken = readiness.captureSyncAttempt();
  if (attemptToken === null) return null;
  return createLifecycleAttempt({
    attemptToken,
    captured,
    readiness,
    isIdentityCurrent,
    canApply,
    readLocalDoc,
  });
}

/**
 * Runs one exact initial-sync attempt and guarantees that every callback exit
 * is settled. Call succeed only after the final synchronous refs/state commit;
 * future-schema paths should call failForFutureSchema before returning.
 */
export async function runCareInitialSyncLifecycle<TDoc, TResult>({
  readiness,
  isIdentityCurrent,
  canApply = isIdentityCurrent,
  readLocalDoc,
  run,
}: CareInitialSyncLifecycleOptions<TDoc, TResult>): Promise<
  CareInitialSyncLifecycleRunResult<TResult>
> {
  const attempt = beginCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent,
    canApply,
    readLocalDoc,
  });
  if (!attempt) {
    return {
      started: false,
      value: undefined,
      error: undefined,
      settlement: null,
    };
  }

  let value: TResult | undefined;
  let error: unknown;
  try {
    value = await run(attempt);
  } catch (caught) {
    const settlement = attempt.fail(caught);
    // `succeed()` is an irreversible readiness boundary. If integration code
    // throws afterward, do not return the contradictory shape
    // `{ success, error }`; preserve the already-settled success contract.
    if (settlement.kind !== "success") error = caught;
  }
  return {
    started: true,
    value,
    error,
    settlement: attempt.finish(error ?? EARLY_EXIT_REASON),
  };
}
