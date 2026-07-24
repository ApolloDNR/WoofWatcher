export interface CareLifecycleToken {
  identityGeneration: number;
  eraseGeneration: number;
}

export type CareDeviceOperationResult =
  | "written"
  | "paused"
  | "stale"
  | "failed";

export type CareStorageWriteResult = CareDeviceOperationResult;

export interface CareWipeOperation {
  target: string;
  run: () => Promise<void>;
}

export interface CareWipeResult {
  ok: boolean;
  failures: string[];
  requiresSignOut?: boolean;
}

export interface CareWipeCompletion {
  resumeHydration: boolean;
  requiresSignOut: boolean;
}

export interface CareWipeVerdict {
  complete: boolean;
  failures: string[];
  clearedAccountCare: boolean;
}

export interface CareWipeVerdictInput {
  careResult: PromiseSettledResult<CareWipeResult>;
  avatarSetResult: PromiseSettledResult<unknown>;
  avatarConfigResult: PromiseSettledResult<unknown>;
  signOut: () => Promise<void>;
}

interface CareDeviceOperationOptions {
  allowWhilePaused?: boolean;
  runWhenStale?: boolean;
}

export interface CareLifecycleCoordinator {
  beginIdentityChange: () => CareLifecycleToken;
  beginWipe: () => CareLifecycleToken;
  capture: () => CareLifecycleToken;
  completeHydration: (token: CareLifecycleToken) => boolean;
  finishWipe: (token: CareLifecycleToken) => boolean;
  isCurrent: (token: CareLifecycleToken) => boolean;
  queueDeviceOperation: (
    token: CareLifecycleToken,
    operation: () => Promise<void>,
    options?: CareDeviceOperationOptions,
  ) => Promise<CareDeviceOperationResult>;
  waitForDeviceOperations: () => Promise<void>;
  queueStorageWrite: (
    token: CareLifecycleToken,
    write: () => Promise<void>,
    options?: { allowWhilePaused?: boolean },
  ) => Promise<CareStorageWriteResult>;
  waitForStorageWrites: () => Promise<void>;
}

export interface HouseholdScopeReloadRequest {
  id: number;
  token: CareLifecycleToken;
  promise: Promise<boolean>;
}

export interface HouseholdScopeReloadCoordinator {
  requestReload: (
    invalidateCurrentScope: () => void,
  ) => HouseholdScopeReloadRequest;
  settleFrom: (
    request: HouseholdScopeReloadRequest,
    result: Promise<boolean>,
  ) => Promise<void>;
  cancelActive: () => void;
  activate: () => void;
  dispose: () => void;
}

export function resolveCareWipeCompletion(
  scopeKind: "account" | "local" | null,
  wipeSucceeded: boolean,
): CareWipeCompletion {
  if (!wipeSucceeded) {
    return { resumeHydration: false, requiresSignOut: false };
  }
  if (scopeKind === "account") {
    return { resumeHydration: false, requiresSignOut: true };
  }
  return {
    resumeHydration: scopeKind === "local",
    requiresSignOut: false,
  };
}

export async function resolveCareWipeVerdict({
  careResult,
  avatarSetResult,
  avatarConfigResult,
  signOut,
}: CareWipeVerdictInput): Promise<CareWipeVerdict> {
  const careEraseResult =
    careResult.status === "fulfilled"
      ? careResult.value
      : {
          ok: false,
          failures: ["care-data"],
          requiresSignOut: false,
        };
  const failures = [...careEraseResult.failures];
  if (avatarSetResult.status === "rejected") failures.push("avatar-set");
  if (avatarConfigResult.status === "rejected") {
    failures.push("avatar-config");
  }
  if (
    careEraseResult.ok &&
    failures.length === 0 &&
    careEraseResult.requiresSignOut
  ) {
    try {
      await signOut();
    } catch {
      failures.push("account-sign-out");
    }
  }

  const complete = careEraseResult.ok && failures.length === 0;
  return {
    complete,
    failures,
    clearedAccountCare:
      complete && Boolean(careEraseResult.requiresSignOut),
  };
}

export function createCareLifecycleCoordinator(): CareLifecycleCoordinator {
  let identityGeneration = 0;
  let eraseGeneration = 0;
  let persistencePaused = true;
  let deviceOperationTail: Promise<void> = Promise.resolve();

  const capture = (): CareLifecycleToken => ({
    identityGeneration,
    eraseGeneration,
  });
  const isCurrent = (token: CareLifecycleToken): boolean =>
    token.identityGeneration === identityGeneration &&
    token.eraseGeneration === eraseGeneration;
  const queueDeviceOperation = (
    token: CareLifecycleToken,
    operationToRun: () => Promise<void>,
    options?: CareDeviceOperationOptions,
  ): Promise<CareDeviceOperationResult> => {
    const allowWhilePaused = options?.allowWhilePaused ?? false;
    const runWhenStale = options?.runWhenStale ?? false;
    if (!isCurrent(token)) return Promise.resolve("stale");
    if (persistencePaused && !allowWhilePaused) {
      return Promise.resolve("paused");
    }

    const operation = deviceOperationTail.then(async () => {
      if (!runWhenStale && !isCurrent(token)) return "stale" as const;
      if (persistencePaused && !allowWhilePaused) return "paused" as const;
      try {
        await operationToRun();
        return isCurrent(token) ? ("written" as const) : ("stale" as const);
      } catch {
        return "failed" as const;
      }
    });
    deviceOperationTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };
  const waitForDeviceOperations = (): Promise<void> => deviceOperationTail;

  return {
    beginIdentityChange() {
      identityGeneration += 1;
      persistencePaused = true;
      return capture();
    },
    beginWipe() {
      eraseGeneration += 1;
      persistencePaused = true;
      return capture();
    },
    capture,
    completeHydration(token) {
      if (!isCurrent(token)) return false;
      persistencePaused = false;
      return true;
    },
    finishWipe(token) {
      if (!isCurrent(token)) return false;
      persistencePaused = false;
      return true;
    },
    isCurrent,
    queueDeviceOperation,
    waitForDeviceOperations,
    queueStorageWrite(token, write, options) {
      return queueDeviceOperation(token, write, options);
    },
    waitForStorageWrites() {
      return waitForDeviceOperations();
    },
  };
}

export function createHouseholdScopeReloadCoordinator(
  lifecycle: Pick<
    CareLifecycleCoordinator,
    "beginIdentityChange" | "capture" | "isCurrent"
  >,
): HouseholdScopeReloadCoordinator {
  let nextRequestId = 0;
  let disposed = false;
  let active:
    | {
        request: HouseholdScopeReloadRequest;
        resolve: (success: boolean) => void;
      }
    | null = null;

  const settleActive = (
    request: HouseholdScopeReloadRequest,
    success: boolean,
  ) => {
    if (!active || active.request.id !== request.id) return;
    const pending = active;
    active = null;
    pending.resolve(success && lifecycle.isCurrent(request.token));
  };
  const cancelActive = () => {
    if (!active) return;
    const pending = active;
    active = null;
    pending.resolve(false);
  };

  return {
    requestReload(invalidateCurrentScope) {
      if (disposed) {
        const token = lifecycle.capture();
        return {
          id: ++nextRequestId,
          token,
          promise: Promise.resolve(false),
        };
      }
      cancelActive();
      const token = lifecycle.beginIdentityChange();
      // This callback is deliberately synchronous. CareContext uses it to
      // drop signed-in/sync refs before any React state update is scheduled.
      invalidateCurrentScope();
      let resolve!: (success: boolean) => void;
      const promise = new Promise<boolean>((resolvePromise) => {
        resolve = resolvePromise;
      });
      const request = {
        id: ++nextRequestId,
        token,
        promise,
      };
      active = { request, resolve };
      return request;
    },
    async settleFrom(request, result) {
      let success = false;
      try {
        success = await result;
      } catch {
        success = false;
      }
      settleActive(request, success);
    },
    cancelActive,
    activate() {
      disposed = false;
    },
    dispose() {
      disposed = true;
      cancelActive();
    },
  };
}

export async function collectCareWipeFailures(
  operations: CareWipeOperation[],
): Promise<CareWipeResult> {
  const settled = await Promise.allSettled(
    operations.map((operation) => operation.run()),
  );
  const failures = settled.flatMap((result, index) =>
    result.status === "rejected" ? [operations[index]!.target] : [],
  );
  return { ok: failures.length === 0, failures };
}
